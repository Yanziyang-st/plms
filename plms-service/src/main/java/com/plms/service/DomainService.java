package com.plms.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plms.common.ApiException;
import com.plms.config.AuthContext;
import com.plms.entity.*;
import com.plms.support.ActivityLogger;
import com.plms.support.CodeGen;
import com.plms.support.PermissionService;
import com.plms.support.ResourceRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 领域服务：承载跨实体的业务规则与状态机。
 * 所有涉及多表一致性的写操作都在此以事务方式完成。
 */
@Service
public class DomainService {

    public static final List<String> WORK_ITEM_STATUSES = List.of("待处理", "进行中", "待测试", "已完成");
    public static final List<String> CASE_RESULTS = List.of("通过", "失败", "阻塞", "未执行");

    /** 工作项状态机：当前状态 → 允许流转到的状态 */
    private static final Map<String, List<String>> STATUS_TRANSITIONS = Map.of(
            "待处理", List.of("进行中", "已完成"),
            "进行中", List.of("待测试", "已完成", "待处理"),
            "待测试", List.of("已完成", "进行中", "待处理"),
            "已完成", List.of("进行中")            // 仅允许重新打开
    );

    /** 可被关联的实体类型 → 资源名 */
    private static final Map<String, String> LINK_TYPES = Map.of(
            "requirement", "requirements",
            "work-item", "work-items",
            "test-case", "test-cases"
    );

    private final ResourceRegistry registry;
    private final CrudService crud;
    private final CodeGen codeGen;
    private final ActivityLogger activityLogger;
    private final ObjectMapper objectMapper;
    private final PermissionService permissionService;

    public DomainService(ResourceRegistry registry, CrudService crud, CodeGen codeGen,
                         ActivityLogger activityLogger, ObjectMapper objectMapper,
                         PermissionService permissionService) {
        this.registry = registry;
        this.crud = crud;
        this.codeGen = codeGen;
        this.activityLogger = activityLogger;
        this.objectMapper = objectMapper;
        this.permissionService = permissionService;
    }

    /* ==================== 看板：工作项状态流转 ==================== */

    /** 查询某工作项当前可流转到的状态（供前端高亮可投放列） */
    public Map<String, Object> workItemTransitions(String id) {
        WorkItem item = (WorkItem) requireEntity("work-items", id);
        List<String> allowed = STATUS_TRANSITIONS.getOrDefault(item.getStatus(), List.of());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", id);
        data.put("current", item.getStatus());
        data.put("allowed", allowed);
        data.put("closed", allowed.isEmpty());
        return data;
    }

    /**
     * 变更工作项状态：
     * ① 校验状态机是否允许该流转；
     * ② 父项关闭前必须先完成全部子项；
     * ③ 联动重算所属项目进度；④ 记录活动日志。
     */
    @Transactional
    public Map<String, Object> changeWorkItemStatus(String id, String status) {
        if (status == null || !WORK_ITEM_STATUSES.contains(status)) {
            throw ApiException.badRequest("状态只能是：" + String.join(" / ", WORK_ITEM_STATUSES));
        }
        WorkItem item = (WorkItem) requireEntity("work-items", id);

        if (Objects.equals(item.getStatus(), status)) {
            throw ApiException.business("工作项已经处于「" + status + "」状态，无需重复变更");
        }
        List<String> allowed = STATUS_TRANSITIONS.getOrDefault(item.getStatus(), List.of());
        if (!allowed.contains(status)) {
            throw ApiException.business(String.format(
                    "不允许从「%s」直接流转到「%s」，可流转状态：%s",
                    item.getStatus(), status, allowed.isEmpty() ? "无" : String.join(" / ", allowed)));
        }

        // 父项约束：仍有未完成子项时不允许关闭
        if ("已完成".equals(status)) {
            List<WorkItem> pending = unfinishedChildren(id);
            if (!pending.isEmpty()) {
                throw ApiException.business(String.format(
                        "该工作项下仍有 %d 个未完成的子项，请先完成子项再关闭父项（如 %s）",
                        pending.size(), pending.get(0).getCode() + " " + pending.get(0).getTitle()));
            }
        }

        String from = item.getStatus();
        item.setStatus(status);
        item.setUpdatedAt(LocalDateTime.now());
        registry.mapper("work-items").updateById(item);

        Project project = refreshProjectProgress(item.getProjectId());

        activityLogger.log(AuthContext.userId(), "更新了工作项状态",
                item.getCode() + " " + item.getTitle() + "：" + from + " → " + status);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("item", registry.mapper("work-items").selectById(id));
        data.put("project", project);
        data.put("transitions", STATUS_TRANSITIONS.getOrDefault(status, List.of()));
        data.put("subtasks", subtaskSummary(id));
        return data;
    }

    /* ==================== 工作项父子结构 ==================== */

    /** 某工作项的直接子项，按创建时间排序 */
    public List<WorkItem> childrenOf(String parentId) {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        qw.eq("parent_id", parentId).orderByAsc("created_at");
        List<Object> rows = registry.mapper("work-items").selectList(qw);
        List<WorkItem> list = new ArrayList<>();
        rows.forEach(o -> list.add((WorkItem) o));
        return list;
    }

    /** 未完成的直接子项 */
    private List<WorkItem> unfinishedChildren(String parentId) {
        List<WorkItem> out = new ArrayList<>();
        for (WorkItem c : childrenOf(parentId)) {
            if (!"已完成".equals(c.getStatus())) out.add(c);
        }
        return out;
    }

    /** 子项汇总：总数、已完成数、完成率、故事点 */
    public Map<String, Object> subtaskSummary(String parentId) {
        List<WorkItem> children = childrenOf(parentId);
        long done = children.stream().filter(c -> "已完成".equals(c.getStatus())).count();
        long points = 0;
        for (WorkItem c : children) points += c.getPoints() == null ? 0 : c.getPoints();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("parentId", parentId);
        data.put("total", children.size());
        data.put("done", done);
        data.put("pending", children.size() - done);
        data.put("progress", children.isEmpty() ? 0 : (int) Math.round(done * 100.0 / children.size()));
        data.put("points", points);
        data.put("allDone", !children.isEmpty() && done == children.size());
        return data;
    }

    /** 单棵子树：父项 + 子项（含每个子项的汇总） */
    public Map<String, Object> workItemTree(String id) {
        WorkItem root = (WorkItem) requireEntity("work-items", id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("item", root);
        data.put("children", childrenOf(id));
        data.put("summary", subtaskSummary(id));

        if (root.getParentId() != null && !root.getParentId().isBlank()) {
            data.put("parent", registry.mapper("work-items").selectById(root.getParentId()));
            data.put("siblings", childrenOf(root.getParentId()));
        }
        return data;
    }

    /**
     * 项目工作项树：顶层工作项 + 其子项，并附带每个工作项的子项汇总。
     * 看板与列表用它一次拿到完整层级，避免逐条请求。
     */
    public Map<String, Object> projectTree(String projectId) {
        if (registry.mapper("projects").selectById(projectId) == null) {
            throw ApiException.notFound("项目不存在（id=" + projectId + "）");
        }
        List<Object> all = crud.listAll("work-items", Map.of("projectId", projectId));

        Map<String, List<WorkItem>> byParent = new LinkedHashMap<>();
        List<WorkItem> roots = new ArrayList<>();
        for (Object o : all) {
            WorkItem w = (WorkItem) o;
            if (w.getParentId() == null || w.getParentId().isBlank()) {
                roots.add(w);
            } else {
                byParent.computeIfAbsent(w.getParentId(), k -> new ArrayList<>()).add(w);
            }
        }

        List<Map<String, Object>> nodes = new ArrayList<>();
        for (WorkItem r : roots) {
            List<WorkItem> children = byParent.getOrDefault(r.getId(), List.of());
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("item", r);
            node.put("children", children);
            node.put("summary", summaryOf(children));
            nodes.add(node);
        }

        // 兜底：父项已不存在（历史脏数据）的子项不能静默丢失，单独作为节点返回并标记
        int orphan = 0;
        for (Object o : all) {
            WorkItem w = (WorkItem) o;
            if (w.getParentId() == null || w.getParentId().isBlank()) continue;
            if (registry.mapper("work-items").selectById(w.getParentId()) != null) continue;
            orphan++;
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("item", w);
            node.put("children", List.of());
            node.put("summary", summaryOf(List.of()));
            node.put("orphan", true);
            nodes.add(node);
        }

        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("topLevel", roots.size());
        stat.put("subtasks", all.size() - roots.size());
        stat.put("orphan", orphan);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("projectId", projectId);
        data.put("nodes", nodes);
        data.put("stat", stat);
        return data;
    }

    private Map<String, Object> summaryOf(List<WorkItem> children) {
        long done = children.stream().filter(c -> "已完成".equals(c.getStatus())).count();
        long points = 0;
        for (WorkItem c : children) points += c.getPoints() == null ? 0 : c.getPoints();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", children.size());
        m.put("done", done);
        m.put("pending", children.size() - done);
        m.put("progress", children.isEmpty() ? 0 : (int) Math.round(done * 100.0 / children.size()));
        m.put("points", points);
        m.put("allDone", !children.isEmpty() && done == children.size());
        return m;
    }

    /** 重算项目进度（**只统计顶层工作项**，避免父项与子项重复计入） */
    public Project refreshProjectProgress(String projectId) {
        if (projectId == null) return null;
        Project project = (Project) registry.mapper("projects").selectById(projectId);
        if (project == null) return null;

        long total = 0, done = 0;
        for (Object o : crud.listAll("work-items", Map.of("projectId", projectId))) {
            WorkItem w = (WorkItem) o;
            if (w.getParentId() != null && !w.getParentId().isBlank()) continue;   // 子项不单独计入
            total++;
            if ("已完成".equals(w.getStatus())) done++;
        }
        project.setProgress(total == 0 ? 0 : (int) Math.round(done * 100.0 / total));
        project.setUpdatedAt(LocalDateTime.now());
        registry.mapper("projects").updateById(project);
        return project;
    }

    /* ==================== 测试 ==================== */

    @Transactional
    public TestCase recordCaseResult(String caseId, String result) {
        if (result == null || !CASE_RESULTS.contains(result)) {
            throw ApiException.badRequest("执行结果只能是：" + String.join(" / ", CASE_RESULTS));
        }
        TestCase tc = (TestCase) requireEntity("test-cases", caseId);
        tc.setLastResult(result);
        tc.setUpdatedAt(LocalDateTime.now());
        registry.mapper("test-cases").updateById(tc);
        activityLogger.log(AuthContext.userId(), "提交了测试结果", tc.getCode() + " " + tc.getTitle() + " · " + result);
        return (TestCase) registry.mapper("test-cases").selectById(caseId);
    }

    /**
     * 执行测试计划中的一条用例。
     * 结果为「失败」且自动化规则 a3 启用时，自动创建缺陷工作项并指派给用例维护人。
     */
    @Transactional
    public Map<String, Object> executeTestPlan(String planId, String caseId, String result) {
        if (caseId == null || caseId.isBlank()) throw ApiException.badRequest("caseId 不能为空");
        if (result == null || !CASE_RESULTS.contains(result)) {
            throw ApiException.badRequest("执行结果只能是：" + String.join(" / ", CASE_RESULTS));
        }
        TestPlan plan = (TestPlan) requireEntity("test-plans", planId);
        if (plan.getCaseIds() == null || !plan.getCaseIds().contains(caseId)) {
            throw ApiException.business("用例 " + caseId + " 不在该测试计划范围内");
        }

        Map<String, String> results = plan.getResults() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(plan.getResults());
        results.put(caseId, result);
        plan.setResults(results);

        boolean allDone = plan.getCaseIds().stream().allMatch(cid -> {
            String r = results.get(cid);
            return r != null && !"未执行".equals(r);
        });
        if (allDone) plan.setStatus("已完成");
        plan.setUpdatedAt(LocalDateTime.now());
        registry.mapper("test-plans").updateById(plan);

        TestCase tc = recordCaseResult(caseId, result);

        WorkItem autoDefect = null;
        if ("失败".equals(result)) {
            Automation rule = (Automation) registry.mapper("automations").selectById("a3");
            boolean ruleOn = rule == null || Boolean.TRUE.equals(rule.getEnabled());
            if (ruleOn) {
                autoDefect = createDefectFromFailure(tc, plan);
                if (rule != null) {
                    rule.setRuns((rule.getRuns() == null ? 0 : rule.getRuns()) + 1);
                    rule.setLastRun(LocalDateTime.now());
                    registry.mapper("automations").updateById(rule);
                }
            }
        }

        activityLogger.log(AuthContext.userId(), "执行了测试计划",
                plan.getName() + " · " + tc.getCode() + " → " + result);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("plan", registry.mapper("test-plans").selectById(planId));
        data.put("case", tc);
        data.put("autoCreatedDefect", autoDefect);
        return data;
    }

    private WorkItem createDefectFromFailure(TestCase tc, TestPlan plan) {
        WorkItem defect = new WorkItem();
        defect.setId(codeGen.id("wi"));
        defect.setProjectId(plan.getProjectId() == null ? "proj1" : plan.getProjectId());
        defect.setTitle("【缺陷】" + tc.getTitle() + " 执行失败");
        defect.setType("缺陷");
        defect.setPriority("高");
        defect.setStatus("待处理");
        defect.setAssignee(tc.getMaintainer());
        defect.setPoints(2);
        defect.setDescription("由测试计划「" + plan.getName() + "」自动创建；用例编号 " + tc.getCode());
        defect.setStartDate(LocalDate.now());
        defect.setEndDate(LocalDate.now().plusDays(3));
        long next = registry.mapper("work-items").selectCount(null) + 100;
        Project p = (Project) registry.mapper("projects").selectById(defect.getProjectId());
        defect.setCode((p == null ? "GEN" : p.getIdentifier()) + "-" + next);
        defect.setCreatedAt(LocalDateTime.now());
        defect.setUpdatedAt(LocalDateTime.now());
        registry.mapper("work-items").insert(defect);
        refreshProjectProgress(defect.getProjectId());
        return defect;
    }

    /* ==================== 测试计划：用例增删 ==================== */

    @Transactional
    public TestPlan addPlanCases(String planId, List<String> caseIds) {
        TestPlan plan = (TestPlan) requireEntity("test-plans", planId);
        if (caseIds == null || caseIds.isEmpty()) throw ApiException.badRequest("请至少选择一条用例");

        for (String cid : caseIds) {
            if (registry.mapper("test-cases").selectById(cid) == null) {
                throw ApiException.badRequest("用例不存在：" + cid);
            }
        }
        List<String> merged = new ArrayList<>(plan.getCaseIds() == null ? List.of() : plan.getCaseIds());
        int added = 0;
        for (String cid : caseIds) {
            if (!merged.contains(cid)) { merged.add(cid); added++; }
        }
        if (added == 0) throw ApiException.business("所选用例均已包含在该计划中");

        plan.setCaseIds(merged);
        if ("已完成".equals(plan.getStatus())) plan.setStatus("进行中");   // 重新打开
        plan.setUpdatedAt(LocalDateTime.now());
        registry.mapper("test-plans").updateById(plan);
        activityLogger.log(AuthContext.userId(), "向测试计划添加了用例", plan.getName() + "（+" + added + "）");
        return (TestPlan) registry.mapper("test-plans").selectById(planId);
    }

    @Transactional
    public TestPlan removePlanCase(String planId, String caseId) {
        TestPlan plan = (TestPlan) requireEntity("test-plans", planId);
        List<String> list = new ArrayList<>(plan.getCaseIds() == null ? List.of() : plan.getCaseIds());
        if (!list.remove(caseId)) throw ApiException.business("该用例不在此测试计划中");
        if (list.isEmpty()) throw ApiException.business("测试计划至少需要保留一条用例");

        Map<String, String> results = plan.getResults() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(plan.getResults());
        results.remove(caseId);
        plan.setCaseIds(list);
        plan.setResults(results);
        if ("已完成".equals(plan.getStatus())) plan.setStatus("进行中");
        plan.setUpdatedAt(LocalDateTime.now());
        registry.mapper("test-plans").updateById(plan);
        activityLogger.log(AuthContext.userId(), "从测试计划移除了用例", plan.getName());
        return (TestPlan) registry.mapper("test-plans").selectById(planId);
    }

    /* ==================== 通用评论 ==================== */

    @Transactional
    public Comment addComment(String targetType, String targetId, String content) {
        if (targetType == null || (!LINK_TYPES.containsKey(targetType) && !"topic".equals(targetType))) {
            throw ApiException.badRequest("评论对象类型只能是：work-item / requirement / test-case / topic");
        }
        if (content == null || content.trim().isEmpty()) throw ApiException.badRequest("评论内容不能为空");
        if (content.length() > 1000) throw ApiException.badRequest("评论内容不能超过 1000 个字符");

        String resource = "topic".equals(targetType) ? "topics" : LINK_TYPES.get(targetType);
        Object target = registry.mapper(resource).selectById(targetId);
        if (target == null) throw ApiException.notFound("评论对象不存在（" + targetType + "#" + targetId + "）");

        Comment c = new Comment();
        c.setId(codeGen.id("cm"));
        c.setTargetType(targetType);
        c.setTargetId(targetId);
        c.setAuthor(AuthContext.userId());
        c.setContent(content.trim());
        c.setCreatedAt(LocalDateTime.now());
        registry.mapper("comments").insert(c);

        activityLogger.log(AuthContext.userId(), "发表了评论", describeEntity(resource, target));
        return c;
    }

    public List<Comment> listComments(String targetType, String targetId) {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        qw.eq("target_type", targetType).eq("target_id", targetId).orderByAsc("created_at");
        List<Object> rows = registry.mapper("comments").selectList(qw);
        List<Comment> list = new ArrayList<>();
        rows.forEach(o -> list.add((Comment) o));
        return list;
    }

    /** 删除评论：仅作者本人或管理员可删 */
    @Transactional
    public void deleteComment(String id, String role) {
        Comment c = (Comment) registry.mapper("comments").selectById(id);
        if (c == null) throw ApiException.notFound("评论不存在");
        if (!permissionService.isAdmin(role) && !Objects.equals(c.getAuthor(), AuthContext.userId())) {
            throw ApiException.forbidden("只能删除自己发表的评论");
        }
        registry.mapper("comments").deleteById(id);
    }

    /* ==================== 实体关联 / 需求追踪 ==================== */

    @Transactional
    public EntityLink createLink(String sourceType, String sourceId, String targetType, String targetId, String linkType) {
        if (!LINK_TYPES.containsKey(sourceType)) throw ApiException.badRequest("无效的源类型：" + sourceType);
        if (!LINK_TYPES.containsKey(targetType)) throw ApiException.badRequest("无效的目标类型：" + targetType);
        if (Objects.equals(sourceType, targetType) && Objects.equals(sourceId, targetId)) {
            throw ApiException.badRequest("不能关联到自身");
        }
        if (registry.mapper(LINK_TYPES.get(sourceType)).selectById(sourceId) == null) {
            throw ApiException.notFound("源对象不存在（" + sourceType + "#" + sourceId + "）");
        }
        if (registry.mapper(LINK_TYPES.get(targetType)).selectById(targetId) == null) {
            throw ApiException.notFound("目标对象不存在（" + targetType + "#" + targetId + "）");
        }
        String type = (linkType == null || linkType.isBlank()) ? "relates" : linkType;

        QueryWrapper<Object> qw = new QueryWrapper<>();
        qw.eq("source_type", sourceType).eq("source_id", sourceId)
                .eq("target_type", targetType).eq("target_id", targetId).eq("link_type", type);
        Long exist = registry.mapper("links").selectCount(qw);
        if (exist != null && exist > 0) {
            throw ApiException.conflict("该关联已存在，无需重复建立");
        }

        EntityLink link = new EntityLink();
        link.setId(codeGen.id("ln"));
        link.setSourceType(sourceType);
        link.setSourceId(sourceId);
        link.setTargetType(targetType);
        link.setTargetId(targetId);
        link.setLinkType(type);
        link.setCreatedAt(LocalDateTime.now());
        registry.mapper("links").insert(link);

        activityLogger.log(AuthContext.userId(), "建立了关联",
                describeEntity(LINK_TYPES.get(sourceType), registry.mapper(LINK_TYPES.get(sourceType)).selectById(sourceId))
                        + " → " + describeEntity(LINK_TYPES.get(targetType), registry.mapper(LINK_TYPES.get(targetType)).selectById(targetId)));
        return link;
    }

    @Transactional
    public void deleteLink(String id) {
        EntityLink link = (EntityLink) registry.mapper("links").selectById(id);
        if (link == null) throw ApiException.notFound("关联不存在");
        registry.mapper("links").deleteById(id);
    }

    /** 查询某实体的全部关联（双向） */
    public Map<String, Object> linksOf(String entityType, String entityId) {
        List<Map<String, Object>> out = new ArrayList<>();
        out.addAll(linkRows(entityType, entityId, true));
        out.addAll(linkRows(entityType, entityId, false));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("entityType", entityType);
        data.put("entityId", entityId);
        data.put("links", out);
        return data;
    }

    private List<Map<String, Object>> linkRows(String type, String id, boolean asSource) {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        qw.eq(asSource ? "source_type" : "target_type", type)
                .eq(asSource ? "source_id" : "target_id", id);
        List<Object> rows = registry.mapper("links").selectList(qw);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : rows) {
            EntityLink l = (EntityLink) o;
            String otherType = asSource ? l.getTargetType() : l.getSourceType();
            String otherId = asSource ? l.getTargetId() : l.getSourceId();
            Object entity = registry.mapper(LINK_TYPES.get(otherType)).selectById(otherId);
            if (entity == null) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("linkId", l.getId());
            row.put("linkType", l.getLinkType());
            row.put("direction", asSource ? "out" : "in");
            row.put("entityType", otherType);
            row.put("entity", entity);
            out.add(row);
        }
        return out;
    }

    /**
     * 需求追踪：需求 → 工作项（implements）→ 测试用例（verifies，含经工作项间接关联）。
     */
    public Map<String, Object> traceRequirement(String requirementId) {
        Requirement req = (Requirement) requireEntity("requirements", requirementId);

        List<Object> workItems = new ArrayList<>();
        List<Object> testCases = new ArrayList<>();

        for (Map<String, Object> row : linkRows("requirement", requirementId, true)) {
            Object entity = row.get("entity");
            if ("work-item".equals(row.get("entityType"))) workItems.add(entity);
            if ("test-case".equals(row.get("entityType"))) testCases.add(entity);
        }
        // 间接：需求 → 工作项 → 用例
        for (Object wi : new ArrayList<>(workItems)) {
            for (Map<String, Object> row : linkRows("work-item", ((WorkItem) wi).getId(), true)) {
                if ("test-case".equals(row.get("entityType"))) {
                    Object tc = row.get("entity");
                    String tcId = ((TestCase) tc).getId();
                    boolean dup = false;
                    for (Object x : testCases) if (((TestCase) x).getId().equals(tcId)) { dup = true; break; }
                    if (!dup) testCases.add(tc);
                }
            }
        }

        int executed = 0, passed = 0;
        for (Object t : testCases) {
            String r = ((TestCase) t).getLastResult();
            if (!"未执行".equals(r)) executed++;
            if ("通过".equals(r)) passed++;
        }

        Map<String, Object> coverage = new LinkedHashMap<>();
        coverage.put("hasWorkItem", !workItems.isEmpty());
        coverage.put("hasTestCase", !testCases.isEmpty());
        coverage.put("fullyCovered", !workItems.isEmpty() && !testCases.isEmpty());
        coverage.put("executed", executed);
        coverage.put("passed", passed);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requirement", req);
        data.put("workItems", workItems);
        data.put("testCases", testCases);
        data.put("coverage", coverage);
        return data;
    }

    /** 需求追踪矩阵（RTM）：按产品汇总每个需求的实现与验证情况 */
    public Map<String, Object> traceMatrix(String productId) {
        List<Object> requirements = (productId == null || productId.isBlank())
                ? crud.listAll("requirements", null)
                : crud.listAll("requirements", Map.of("productId", productId));

        List<Map<String, Object>> rows = new ArrayList<>();
        int covered = 0;
        for (Object o : requirements) {
            Requirement r = (Requirement) o;
            Map<String, Object> trace = traceRequirement(r.getId());
            @SuppressWarnings("unchecked")
            List<Object> wi = (List<Object>) trace.get("workItems");
            @SuppressWarnings("unchecked")
            List<Object> tc = (List<Object>) trace.get("testCases");
            @SuppressWarnings("unchecked")
            Map<String, Object> cov = (Map<String, Object>) trace.get("coverage");

            if (Boolean.TRUE.equals(cov.get("fullyCovered"))) covered++;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("requirement", r);
            row.put("workItems", wi);
            row.put("testCases", tc);
            row.put("coverage", cov);
            rows.add(row);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", rows.size());
        summary.put("fullyCovered", covered);
        summary.put("coverageRate", rows.isEmpty() ? 0 : Math.round(covered * 100.0 / rows.size()));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rows", rows);
        data.put("summary", summary);
        return data;
    }

    /* ==================== 自动化 ==================== */

    @Transactional
    public Automation toggleAutomation(String id) {
        Automation a = (Automation) requireEntity("automations", id);
        a.setEnabled(!Boolean.TRUE.equals(a.getEnabled()));
        a.setUpdatedAt(LocalDateTime.now());
        registry.mapper("automations").updateById(a);
        activityLogger.log(AuthContext.userId(), a.getEnabled() ? "启用了自动化规则" : "停用了自动化规则", a.getName());
        return (Automation) registry.mapper("automations").selectById(id);
    }

    @Transactional
    public Automation runAutomation(String id) {
        Automation a = (Automation) requireEntity("automations", id);
        a.setRuns((a.getRuns() == null ? 0 : a.getRuns()) + 1);
        a.setLastRun(LocalDateTime.now());
        a.setUpdatedAt(LocalDateTime.now());
        registry.mapper("automations").updateById(a);
        activityLogger.log(AuthContext.userId(), "手动执行了自动化规则", a.getName());
        return (Automation) registry.mapper("automations").selectById(id);
    }

    /* ==================== 效能度量 ==================== */

    public Map<String, Object> metricsOverview() {
        List<Object> workItems = crud.listAll("work-items", null);
        List<Object> requirements = crud.listAll("requirements", null);
        List<Object> projects = crud.listAll("projects", null);
        List<Object> cases = crud.listAll("test-cases", null);

        Map<String, Long> wiByStatus = groupCount(workItems, "status");
        Map<String, Long> wiByType = groupCount(workItems, "type");
        Map<String, Long> reqByStatus = groupCount(requirements, "status");
        Map<String, Long> caseByResult = groupCount(cases, "lastResult");

        // 故事点只统计顶层工作项：子任务不单独估算，否则父子会重复计入速率
        long totalPoints = 0, donePoints = 0;
        long topLevel = 0, subtasks = 0;
        for (Object o : workItems) {
            WorkItem w = (WorkItem) o;
            boolean isSub = w.getParentId() != null && !w.getParentId().isBlank();
            if (isSub) { subtasks++; continue; }
            topLevel++;
            int p = w.getPoints() == null ? 0 : w.getPoints();
            totalPoints += p;
            if ("已完成".equals(w.getStatus())) donePoints += p;
        }

        long pass = caseByResult.getOrDefault("通过", 0L);
        long activeProjects = 0;
        int progressSum = 0;
        for (Object o : projects) {
            Project p = (Project) o;
            if ("进行中".equals(p.getStatus())) activeProjects++;
            progressSum += p.getProgress() == null ? 0 : p.getProgress();
        }

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("workItems", Map.of(
                "total", workItems.size(),
                "topLevel", topLevel,
                "subtasks", subtasks,
                "byStatus", wiByStatus,
                "byType", wiByType,
                "totalPoints", totalPoints,
                "donePoints", donePoints));
        metrics.put("requirements", Map.of(
                "total", requirements.size(),
                "byStatus", reqByStatus));
        metrics.put("projects", Map.of(
                "total", projects.size(),
                "active", activeProjects,
                "avgProgress", projects.isEmpty() ? 0 : Math.round((float) progressSum / projects.size())));
        metrics.put("tests", Map.of(
                "cases", cases.size(),
                "byResult", caseByResult,
                "passRate", cases.isEmpty() ? 0 : Math.round(pass * 100.0 / cases.size())));
        metrics.put("delivery", Map.of(
                "velocity", List.of(32, 41, 38, 52, 47, 61),
                "velocityLabels", List.of("S1", "S2", "S3", "S4", "S5", "S6"),
                "burndown", List.of(120, 118, 104, 96, 96, 78, 70, 52, 44, 30)));
        return metrics;
    }

    public List<Map<String, Object>> metricsMembers() {
        List<Object> users = crud.listAll("users", null);
        List<Object> workItems = crud.listAll("work-items", null);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object u : users) {
            User user = (User) u;
            long total = 0, done = 0, points = 0, subs = 0, subsDone = 0;
            for (Object o : workItems) {
                WorkItem w = (WorkItem) o;
                if (!user.getId().equals(w.getAssignee())) continue;
                boolean isSub = w.getParentId() != null && !w.getParentId().isBlank();
                if (isSub) {
                    subs++;
                    if ("已完成".equals(w.getStatus())) subsDone++;
                    continue;                       // 子任务不计分，避免与父项重复
                }
                total++;
                if ("已完成".equals(w.getStatus())) {
                    done++;
                    points += w.getPoints() == null ? 0 : w.getPoints();
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("user", user);
            row.put("total", total);
            row.put("done", done);
            row.put("points", points);
            row.put("subtasks", subs);
            row.put("subtasksDone", subsDone);
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare((long) b.get("points"), (long) a.get("points")));
        return rows;
    }

    /* ==================== 全局搜索 ==================== */

    public Map<String, Object> search(String q, List<String> types, int limit) {
        if (q == null || q.trim().isEmpty()) throw ApiException.badRequest("搜索关键字不能为空");
        String kw = q.trim();
        int max = limit <= 0 ? 30 : Math.min(limit, 100);

        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Integer> countByType = new LinkedHashMap<>();
        boolean all = types == null || types.isEmpty();

        if (all || types.contains("requirement")) collect(out, countByType, "requirements", "需求", "title", "code", kw);
        if (all || types.contains("work-item")) collect(out, countByType, "work-items", "工作项", "title", "code", kw);
        if (all || types.contains("test-case")) collect(out, countByType, "test-cases", "用例", "title", "code", kw);
        if (all || types.contains("wiki-page")) collect(out, countByType, "wiki-pages", "文档", "title", "id", kw);
        if (all || types.contains("project")) collect(out, countByType, "projects", "项目", "name", "identifier", kw);
        if (all || types.contains("product")) collect(out, countByType, "products", "产品", "name", "identifier", kw);
        if (all || types.contains("topic")) collect(out, countByType, "topics", "话题", "title", "id", kw);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("keyword", kw);
        data.put("total", out.size());
        data.put("countByType", countByType);
        data.put("list", new ArrayList<>(out.subList(0, Math.min(out.size(), max))));
        return data;
    }

    private void collect(List<Map<String, Object>> out, Map<String, Integer> countByType,
                         String resource, String typeLabel, String field1, String field2, String kw) {
        for (Object o : crud.listAll(resource, null)) {
            String v1 = str(CrudService.readValue(o, field1));
            String v2 = str(CrudService.readValue(o, field2));
            if (v1.contains(kw) || v2.contains(kw)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("type", typeLabel);
                m.put("typeKey", resource);
                m.put("resource", resource);
                m.put("id", CrudService.readValue(o, "id"));
                m.put("title", v1);
                m.put("sub", (v2.isEmpty() ? "" : v2 + " · ") + str(CrudService.readValue(o, "status")));
                out.add(m);
                countByType.merge(typeLabel, 1, Integer::sum);
            }
        }
    }

    /* ==================== 首屏水合（按权限过滤） ==================== */

    /** 一次性返回前端渲染所需的全部数据；按当前角色的读权限过滤集合，越权数据不下发。 */
    public Map<String, Object> bootstrap(String role) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("users", crud.listAll("users", null));
        if (canRead(role, "product")) {
            data.put("products", crud.listAll("products", null));
            data.put("requirements", crud.listAll("requirements", null));
        }
        if (canRead(role, "project")) {
            data.put("projects", crud.listAll("projects", null));
            data.put("sprints", crud.listAll("sprints", null));
            data.put("workItems", crud.listAll("work-items", null));
        }
        if (canRead(role, "test")) {
            data.put("testLibraries", crud.listAll("test-libraries", null));
            data.put("testCases", crud.listAll("test-cases", null));
            data.put("testPlans", crud.listAll("test-plans", null));
        }
        if (canRead(role, "knowledge")) {
            data.put("wikiSpaces", crud.listAll("wiki-spaces", null));
            data.put("wikiPages", crud.listAll("wiki-pages", null));
        }
        if (canRead(role, "automation")) data.put("automations", crud.listAll("automations", null));
        if (canRead(role, "ai")) data.put("agents", crud.listAll("agents", null));
        data.put("activities", crud.listAll("activities", null));
        data.put("links", crud.listAll("links", null));
        data.put("comments", crud.listAll("comments", null));

        List<Map<String, Object>> topics = new ArrayList<>();
        if (canRead(role, "collab")) {
            for (Object o : crud.listAll("topics", null)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> t = objectMapper.convertValue(o, Map.class);
                t.put("comments", listComments("topic", ((Topic) o).getId()));
                topics.add(t);
            }
        }
        data.put("topics", topics);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("serverTime", LocalDateTime.now().toString());
        meta.put("schemaVersion", 2);
        meta.put("role", role);
        meta.put("permissions", permissionService.permissionsOf(role));
        data.put("meta", meta);
        return data;
    }

    private boolean canRead(String role, String module) {
        return permissionService.isAdmin(role) || permissionService.has(role, module, "read");
    }

    /* ==================== 工具 ==================== */

    private Object requireEntity(String resource, String id) {
        Object e = registry.mapper(resource).selectById(id);
        if (e == null) throw ApiException.notFound(registry.label(resource) + "不存在（id=" + id + "）");
        return e;
    }

    private String describeEntity(String resource, Object entity) {
        if (entity == null) return resource;
        Object title = CrudService.readValue(entity, "title");
        if (title == null) title = CrudService.readValue(entity, "name");
        Object code = CrudService.readValue(entity, "code");
        return ((code == null ? "" : code + " ") + str(title)).trim();
    }

    private Map<String, Long> groupCount(List<Object> list, String field) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (Object o : list) {
            String k = str(CrudService.readValue(o, field));
            if (k.isEmpty()) k = "未设置";
            map.merge(k, 1L, Long::sum);
        }
        return map;
    }

    private String str(Object o) { return o == null ? "" : String.valueOf(o); }
}
