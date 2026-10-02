package com.plms.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plms.common.ApiException;
import com.plms.common.PageResult;
import com.plms.entity.*;
import com.plms.support.*;
import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 通用资源服务：为所有资源提供列表（分页/筛选/排序/关键字）、详情、创建、更新、删除。
 * 具体资源的个性化逻辑（编号生成等）以钩子方法形式内聚在此。
 */
@Service
public class CrudService {

    /** 各资源的默认排序字段（默认 created_at desc） */
    private static final Map<String, String> DEFAULT_SORT = Map.of(
            "activities", "occurred_at",
            "topic-comments", "created_at"
    );

    /** 不参与筛选的保留查询参数 */
    private static final Set<String> RESERVED_PARAMS =
            Set.of("page", "pageSize", "keyword", "sort", "order", "ids");

    private final ResourceRegistry registry;
    private final Validator validator;
    private final CodeGen codeGen;
    private final ActivityLogger activityLogger;
    private final ObjectMapper objectMapper;

    public CrudService(ResourceRegistry registry, Validator validator, CodeGen codeGen,
                       ActivityLogger activityLogger, ObjectMapper objectMapper) {
        this.registry = registry;
        this.validator = validator;
        this.codeGen = codeGen;
        this.activityLogger = activityLogger;
        this.objectMapper = objectMapper;
    }

    /* ==================== 查询 ==================== */

    @SuppressWarnings({"unchecked", "rawtypes"})
    public PageResult<Object> list(String resource, Map<String, String> params) {
        requireResource(resource);
        long pageNo = parseLong(params.get("page"), 1);
        long pageSize = parseLong(params.get("pageSize"), 20);
        if (pageNo < 1) pageNo = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 500) pageSize = 500;

        QueryWrapper<Object> qw = new QueryWrapper<>();
        Set<String> filterable = Schemas.filterableFields(resource);
        filterable.add("id");

        for (Map.Entry<String, String> e : params.entrySet()) {
            String key = e.getKey();
            String val = e.getValue();
            if (RESERVED_PARAMS.contains(key) || val == null || val.isBlank()) continue;
            if (!filterable.contains(key)) continue;     // 非白名单字段直接忽略，避免 SQL 注入/报错
            qw.eq(snake(key), val);
        }

        String ids = params.get("ids");
        if (ids != null && !ids.isBlank()) {
            List<String> idList = Arrays.stream(ids.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (!idList.isEmpty()) qw.in("id", idList);
        }

        String keyword = params.get("keyword");
        String searchField = Schemas.searchField(resource);
        if (keyword != null && !keyword.isBlank() && searchField != null) {
            qw.like(snake(searchField), keyword.trim());
        }

        String sort = params.get("sort");
        String order = params.get("order");
        if (sort != null && !sort.isBlank() && filterable.contains(sort)) {
            qw.orderBy(true, "asc".equalsIgnoreCase(order), snake(sort));
        } else {
            qw.orderByDesc(DEFAULT_SORT.getOrDefault(resource, "created_at"));
        }

        BaseMapper mapper = registry.mapper(resource);
        Page<Object> page = new Page<>(pageNo, pageSize);
        IPage<?> result = (IPage<?>) mapper.selectPage(page, qw);
        return new PageResult<>((List<Object>) result.getRecords(), result.getTotal(), pageNo, pageSize);
    }

    public Object get(String resource, String id) {
        requireResource(resource);
        Object entity = registry.mapper(resource).selectById(id);
        if (entity == null) throw ApiException.notFound(registry.label(resource) + "不存在（id=" + id + "）");
        return entity;
    }

    /** 按条件统计（供领域服务复用） */
    @SuppressWarnings("rawtypes")
    public long count(String resource, Map<String, Object> eq) {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        if (eq != null) eq.forEach((k, v) -> { if (v != null) qw.eq(snake(k), v); });
        BaseMapper mapper = registry.mapper(resource);
        Long n = (Long) mapper.selectCount(qw);
        return n == null ? 0L : n;
    }

    /** 列表（不分页，供内部聚合使用） */
    @SuppressWarnings({"unchecked", "rawtypes"})
    public List<Object> listAll(String resource, Map<String, Object> eq) {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        if (eq != null) eq.forEach((k, v) -> { if (v != null) qw.eq(snake(k), v); });
        qw.orderByDesc(DEFAULT_SORT.getOrDefault(resource, "created_at"));
        BaseMapper mapper = registry.mapper(resource);
        return (List<Object>) mapper.selectList(qw);
    }

    /* ==================== 写入 ==================== */

    @Transactional
    public Object create(String resource, Map<String, Object> body) {
        requireResource(resource);
        Map<String, Object> clean = validator.validate(resource, body, false);

        Class<?> type = registry.entityType(resource);
        Object entity = objectMapper.convertValue(clean, type);

        // 主键
        setIfWritable(entity, "id", codeGen.id(resource.substring(0, Math.min(2, resource.length()))));
        // 时间戳
        LocalDateTime now = LocalDateTime.now();
        setIfWritable(entity, "createdAt", now);
        setIfWritable(entity, "updatedAt", now);

        // 资源个性化：业务编号、默认值
        applyCreateHooks(resource, entity, clean);
        // 跨字段业务校验（日期先后、父子约束、引用集合等）
        crossCheck(resource, entity);

        registry.mapper(resource).insert(entity);

        Object created = registry.mapper(resource).selectById(readString(entity, "id"));
        activityLogger.log(AuthContextUserId(), "创建了" + registry.label(resource), describe(created, clean));
        return created;
    }

    @Transactional
    public Object update(String resource, String id, Map<String, Object> body) {
        requireResource(resource);
        Object existing = registry.mapper(resource).selectById(id);
        if (existing == null) throw ApiException.notFound(registry.label(resource) + "不存在（id=" + id + "）");

        Map<String, Object> clean = validator.validate(resource, body, true);

        BeanWrapper bw = new BeanWrapperImpl(existing);
        bw.setAutoGrowNestedPaths(false);
        List<String> clearedColumns = new ArrayList<>();
        for (Map.Entry<String, Object> e : clean.entrySet()) {
            if (!bw.isWritableProperty(e.getKey())) continue;
            Class<?> propType = bw.getPropertyType(e.getKey());
            Object converted = objectMapper.convertValue(e.getValue(), propType);
            bw.setPropertyValue(e.getKey(), converted);
            // 记录被显式清空的字段：updateById 采用 NOT_NULL 策略会跳过 null，
            // 必须单独用 UpdateWrapper 置 NULL，否则无法解除关联（如移出子任务）。
            if (converted == null) clearedColumns.add(snake(e.getKey()));
        }
        setIfWritable(existing, "updatedAt", LocalDateTime.now());
        crossCheck(resource, existing);

        registry.mapper(resource).updateById(existing);
        if (!clearedColumns.isEmpty()) {
            UpdateWrapper<Object> uw = new UpdateWrapper<>();
            uw.eq("id", id);
            for (String col : clearedColumns) uw.set(col, null);
            registry.mapper(resource).update(null, uw);
        }

        Object updated = registry.mapper(resource).selectById(id);
        activityLogger.log(AuthContextUserId(), "更新了" + registry.label(resource), describe(updated, clean));
        return updated;
    }

    @Transactional
    public void delete(String resource, String id) {
        requireResource(resource);
        Object existing = registry.mapper(resource).selectById(id);
        if (existing == null) throw ApiException.notFound(registry.label(resource) + "不存在（id=" + id + "）");
        checkDeleteConstraints(resource, id);
        registry.mapper(resource).deleteById(id);
        cascadeCleanup(resource, id);
        activityLogger.log(AuthContextUserId(), "删除了" + registry.label(resource), describe(existing, null));
    }

    /* ==================== 钩子 ==================== */

    /** 创建时的资源专属处理 */
    private void applyCreateHooks(String resource, Object entity, Map<String, Object> clean) {
        switch (resource) {
            case "requirements" -> {
                Requirement r = (Requirement) entity;
                Product p = (Product) registry.mapper("products").selectById(r.getProductId());
                String prefix = p == null ? "GEN" : p.getIdentifier();
                String segment = "工单".equals(r.getType()) ? "TKT" : "REQ";
                long next = registry.mapper("requirements").selectCount(null) + 1;
                r.setCode(codeGen.bizCode(prefix, segment, next));
                if (r.getDescription() == null) r.setDescription("");
            }
            case "work-items" -> {
                WorkItem w = (WorkItem) entity;
                Project p = (Project) registry.mapper("projects").selectById(w.getProjectId());
                String prefix = p == null ? "GEN" : p.getIdentifier();
                long next = registry.mapper("work-items").selectCount(null) + 100;
                w.setCode(prefix + "-" + next);
                if (w.getDescription() == null) w.setDescription("");
            }
            case "test-cases" -> {
                TestCase c = (TestCase) entity;
                TestLibrary lib = (TestLibrary) registry.mapper("test-libraries").selectById(c.getLibraryId());
                String prefix = (lib != null && lib.getName().contains("数据")) ? "DATA" : "OA";
                long next = registry.mapper("test-cases").selectCount(null) + 1;
                c.setCode(codeGen.bizCode(prefix, "TC", next));
            }
            case "test-plans" -> {
                TestPlan p = (TestPlan) entity;
                if (p.getResults() == null) p.setResults(new LinkedHashMap<>());
                if (p.getLibraryId() == null && p.getCaseIds() != null && !p.getCaseIds().isEmpty()) {
                    TestCase first = (TestCase) registry.mapper("test-cases").selectById(p.getCaseIds().get(0));
                    if (first != null) p.setLibraryId(first.getLibraryId());
                }
            }
            case "automations" -> {
                Automation a = (Automation) entity;
                if (a.getRuns() == null) a.setRuns(0);
            }
            default -> { }
        }
    }

    /** 删除前的引用约束检查 */
    private void checkDeleteConstraints(String resource, String id) {
        switch (resource) {
            case "products" -> {
                if (count("requirements", Map.of("productId", id)) > 0)
                    throw ApiException.conflict("该产品下仍有需求/工单，无法删除");
            }
            case "projects" -> {
                if (count("work-items", Map.of("projectId", id)) > 0)
                    throw ApiException.conflict("该项目下仍有工作项，无法删除");
                if (count("sprints", Map.of("projectId", id)) > 0)
                    throw ApiException.conflict("该项目下仍有迭代，请先删除迭代");
            }
            case "sprints" -> {
                if (count("work-items", Map.of("sprintId", id)) > 0)
                    throw ApiException.conflict("该迭代下仍有工作项，无法删除");
            }
            case "work-items" -> {
                long children = countChildren(id);
                if (children > 0)
                    throw ApiException.conflict("该工作项下仍有 " + children + " 个子项，请先删除子项");
            }
            case "test-libraries" -> {
                if (count("test-cases", Map.of("libraryId", id)) > 0)
                    throw ApiException.conflict("该测试库下仍有用例，无法删除");
            }
            case "test-cases" -> {
                long used = countPlansUsingCase(id);
                if (used > 0) throw ApiException.conflict("该用例仍被 " + used + " 个测试计划引用，请先从计划中移除");
            }
            case "wiki-spaces" -> {
                if (count("wiki-pages", Map.of("spaceId", id)) > 0)
                    throw ApiException.conflict("该空间下仍有页面，无法删除");
            }
            case "wiki-pages" -> {
                if (count("wiki-pages", Map.of("parentId", id)) > 0)
                    throw ApiException.conflict("该页面下仍有子页面，请先删除子页面");
            }
            case "users" -> {
                Object target = registry.mapper("users").selectById(id);
                if (target instanceof User u) {
                    if (id.equals(com.plms.config.AuthContext.userId()))
                        throw ApiException.business("不能删除当前登录的账号");
                    if ("管理员".equals(u.getRole()) && countAdmins() <= 1)
                        throw ApiException.business("系统至少需要保留一名管理员");
                    if (count("work-items", Map.of("assignee", id)) > 0)
                        throw ApiException.conflict("该成员名下仍有工作项，请先转移后再删除");
                }
            }
            default -> { }
        }
    }

    /** 删除后清理关联数据（关联关系、评论、活动引用） */
    private void cascadeCleanup(String resource, String id) {
        String linkType = switch (resource) {
            case "requirements" -> "requirement";
            case "work-items" -> "work-item";
            case "test-cases" -> "test-case";
            default -> null;
        };
        if (linkType != null) {
            QueryWrapper<Object> qw = new QueryWrapper<>();
            qw.eq("source_type", linkType).eq("source_id", id);
            registry.mapper("links").delete(qw);
            QueryWrapper<Object> qw2 = new QueryWrapper<>();
            qw2.eq("target_type", linkType).eq("target_id", id);
            registry.mapper("links").delete(qw2);

            QueryWrapper<Object> qw3 = new QueryWrapper<>();
            qw3.eq("target_type", linkType).eq("target_id", id);
            registry.mapper("comments").delete(qw3);
        }
        if ("topics".equals(resource)) {
            QueryWrapper<Object> qw = new QueryWrapper<>();
            qw.eq("target_type", "topic").eq("target_id", id);
            registry.mapper("comments").delete(qw);
        }
    }

    private long countPlansUsingCase(String caseId) {
        long n = 0;
        for (Object o : listAll("test-plans", null)) {
            TestPlan p = (TestPlan) o;
            if (p.getCaseIds() != null && p.getCaseIds().contains(caseId)) n++;
        }
        return n;
    }

    private long countAdmins() {
        QueryWrapper<Object> qw = new QueryWrapper<>();
        qw.eq("role", "管理员");
        Long n = (Long) registry.mapper("users").selectCount(qw);
        return n == null ? 0 : n;
    }

    /* ==================== 跨字段业务校验 ==================== */

    /**
     * 字段级校验（{@link Validator}）之外的跨字段规则。
     * 覆盖：日期先后顺序、父子页面约束与环检测、集合元素存在性。
     */
    void crossCheck(String resource, Object entity) {
        switch (resource) {
            case "projects" -> {
                Project p = (Project) entity;
                checkDateRange(p.getStartDate(), p.getEndDate(), "项目");
            }
            case "sprints" -> {
                Sprint s = (Sprint) entity;
                checkDateRange(s.getStartDate(), s.getEndDate(), "迭代");
            }
            case "work-items" -> {
                WorkItem w = (WorkItem) entity;
                checkDateRange(w.getStartDate(), w.getEndDate(), "工作项");
                checkWorkItemParent(w);
            }
            case "test-plans" -> {
                TestPlan p = (TestPlan) entity;
                checkDateRange(p.getStartDate(), p.getEndDate(), "测试计划");
                if (p.getCaseIds() != null) {
                    for (String cid : p.getCaseIds()) {
                        if (registry.mapper("test-cases").selectById(cid) == null) {
                            throw ApiException.badRequest("所选用例不存在：" + cid);
                        }
                    }
                }
            }
            case "wiki-pages" -> {
                WikiPage page = (WikiPage) entity;
                String parentId = page.getParentId();
                if (parentId == null || parentId.isBlank()) return;
                if (parentId.equals(page.getId())) throw ApiException.badRequest("父页面不能是自身");
                Object parentObj = registry.mapper("wiki-pages").selectById(parentId);
                if (parentObj == null) throw ApiException.badRequest("父页面不存在：" + parentId);
                WikiPage parent = (WikiPage) parentObj;
                if (!parent.getSpaceId().equals(page.getSpaceId()))
                    throw ApiException.badRequest("父页面必须与当前页面属于同一知识空间");
                // 环检测：沿父链向上，若回到自身则非法
                String cursor = parentId;
                int guard = 0;
                while (cursor != null && guard++ < 50) {
                    if (cursor.equals(page.getId())) throw ApiException.badRequest("父子关系存在循环，请检查层级设置");
                    Object up = registry.mapper("wiki-pages").selectById(cursor);
                    cursor = up == null ? null : ((WikiPage) up).getParentId();
                }
            }
            default -> { }
        }
    }

    private void checkDateRange(LocalDate start, LocalDate end, String label) {
        if (start != null && end != null && start.isAfter(end)) {
            throw ApiException.badRequest(label + "的开始日期不能晚于结束日期");
        }
    }

    /**
     * 工作项父子结构校验与归一化。
     * <p>规则：① 父项不能是自身；② 父项必须存在；③ 父项必须在同一项目下；
     * ④ 父项不能是「子任务」（即最多两层，子任务为叶子节点）；⑤ 沿父链检测环路。</p>
     * <p>归一化：有父项 ⇔ 类型为「子任务」，两者保持一致，避免出现
     * "无父项的子任务" 或 "有父项却不是子任务" 这类矛盾数据。</p>
     */
    private void checkWorkItemParent(WorkItem w) {
        String parentId = w.getParentId();

        if (parentId == null || parentId.isBlank()) {
            // 顶层工作项：清掉空串，并把遗留的「子任务」类型归一化
            w.setParentId(null);
            if ("子任务".equals(w.getType())) w.setType("任务");
            return;
        }

        if (parentId.equals(w.getId())) {
            throw ApiException.badRequest("父工作项不能是自身");
        }
        Object parentObj = registry.mapper("work-items").selectById(parentId);
        if (parentObj == null) {
            throw ApiException.badRequest("父工作项不存在：" + parentId);
        }
        WorkItem parent = (WorkItem) parentObj;

        if (!parent.getProjectId().equals(w.getProjectId())) {
            throw ApiException.badRequest("父工作项必须与当前工作项属于同一项目");
        }
        if ("子任务".equals(parent.getType())) {
            throw ApiException.badRequest("「子任务」不能再挂子项（工作项层级最多两层）");
        }
        // 环路检测：沿父链向上，若回到自身则非法
        String cursor = parent.getParentId();
        int guard = 0;
        while (cursor != null && guard++ < 50) {
            if (cursor.equals(w.getId())) {
                throw ApiException.badRequest("父工作项设置形成了循环引用");
            }
            Object up = registry.mapper("work-items").selectById(cursor);
            cursor = up == null ? null : ((WorkItem) up).getParentId();
        }

        // 有父项 → 类型归一化为「子任务」
        w.setType("子任务");
    }

    /** 某工作项的直接子项数量 */
    public long countChildren(String workItemId) {
        return count("work-items", Map.of("parentId", workItemId));
    }

    /* ==================== 批量操作 ==================== */

    /** 批量删除：逐条校验约束，部分失败时返回明细（整体事务） */
    @Transactional
    public Map<String, Object> batchDelete(String resource, List<String> ids) {
        requireResource(resource);
        if (ids == null || ids.isEmpty()) throw ApiException.badRequest("请至少选择一条记录");
        if (ids.size() > 100) throw ApiException.badRequest("单次批量删除不能超过 100 条");

        int success = 0;
        List<Map<String, String>> failures = new ArrayList<>();
        for (String id : ids) {
            try {
                delete(resource, id);
                success++;
            } catch (ApiException e) {
                Map<String, String> f = new LinkedHashMap<>();
                f.put("id", id);
                f.put("message", e.getMessage());
                failures.add(f);
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requested", ids.size());
        data.put("success", success);
        data.put("failed", failures.size());
        data.put("failures", failures);
        if (success == 0) throw ApiException.business("全部 " + ids.size() + " 条记录均无法删除：" +
                (failures.isEmpty() ? "" : failures.get(0).get("message")));
        return data;
    }

    /** 批量更新（仅白名单字段），用于批量改状态 / 负责人 / 优先级 */
    @Transactional
    public Map<String, Object> batchUpdate(String resource, List<String> ids, Map<String, Object> patch) {
        requireResource(resource);
        if (ids == null || ids.isEmpty()) throw ApiException.badRequest("请至少选择一条记录");
        if (ids.size() > 100) throw ApiException.badRequest("单次批量更新不能超过 100 条");
        if (patch == null || patch.isEmpty()) throw ApiException.badRequest("请指定要批量修改的字段");

        int success = 0;
        List<Map<String, String>> failures = new ArrayList<>();
        List<Object> updated = new ArrayList<>();
        for (String id : ids) {
            try {
                updated.add(update(resource, id, patch));
                success++;
            } catch (ApiException e) {
                Map<String, String> f = new LinkedHashMap<>();
                f.put("id", id);
                f.put("message", e.getMessage());
                failures.add(f);
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requested", ids.size());
        data.put("success", success);
        data.put("failed", failures.size());
        data.put("failures", failures);
        data.put("updated", updated);
        if (success == 0) throw ApiException.business("全部 " + ids.size() + " 条记录均无法更新：" +
                (failures.isEmpty() ? "" : failures.get(0).get("message")));
        return data;
    }

    /* ==================== 工具 ==================== */

    private void requireResource(String resource) {
        if (!registry.exists(resource)) throw ApiException.notFound("未知资源：" + resource);
    }

    private static String AuthContextUserId() {
        return com.plms.config.AuthContext.userId();
    }

    /** 反射写入字段（存在 setter 才写） */
    static void setIfWritable(Object target, String prop, Object value) {
        BeanWrapper bw = new BeanWrapperImpl(target);
        if (bw.isWritableProperty(prop) && bw.getPropertyValue(prop) == null) {
            bw.setPropertyValue(prop, value);
        }
    }

    public static Object readValue(Object target, String prop) {
        BeanWrapper bw = new BeanWrapperImpl(target);
        return bw.isReadableProperty(prop) ? bw.getPropertyValue(prop) : null;
    }

    public static String readString(Object target, String prop) {
        Object v = readValue(target, prop);
        return v == null ? null : String.valueOf(v);
    }

    /** 生成活动日志中的可读描述 */
    private String describe(Object entity, Map<String, Object> fallback) {
        Object title = readValue(entity, "title");
        if (title == null) title = readValue(entity, "name");
        if (title == null && fallback != null) title = fallback.get("title");
        if (title == null && fallback != null) title = fallback.get("name");
        Object code = readValue(entity, "code");
        String s = (code == null ? "" : code + " ") + (title == null ? "" : title);
        return s.isBlank() ? String.valueOf(readValue(entity, "id")) : s.trim();
    }

    static String snake(String camel) {
        StringBuilder sb = new StringBuilder();
        for (char c : camel.toCharArray()) {
            if (Character.isUpperCase(c)) sb.append('_').append(Character.toLowerCase(c));
            else sb.append(c);
        }
        return sb.toString();
    }

    private long parseLong(String s, long def) {
        if (s == null || s.isBlank()) return def;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return def; }
    }
}
