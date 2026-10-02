package com.plms.service;

import com.plms.entity.*;
import com.plms.mapper.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 种子数据初始化：首次启动（用户表为空）时灌入演示数据；支持一键重置。
 * <p>{@code @Order(1)} 保证在 {@link com.plms.config.SchemaMigrator} 之后执行。</p>
 */
@Service
@Order(1)
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String DEFAULT_PASSWORD = "123456";

    private final UserMapper userMapper;
    private final ProductMapper productMapper;
    private final RequirementMapper requirementMapper;
    private final ProjectMapper projectMapper;
    private final SprintMapper sprintMapper;
    private final WorkItemMapper workItemMapper;
    private final TestLibraryMapper testLibraryMapper;
    private final TestCaseMapper testCaseMapper;
    private final TestPlanMapper testPlanMapper;
    private final WikiSpaceMapper wikiSpaceMapper;
    private final WikiPageMapper wikiPageMapper;
    private final TopicMapper topicMapper;
    private final CommentMapper commentMapper;
    private final EntityLinkMapper entityLinkMapper;
    private final AutomationMapper automationMapper;
    private final AgentMapper agentMapper;
    private final ActivityMapper activityMapper;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserMapper userMapper, ProductMapper productMapper, RequirementMapper requirementMapper,
                      ProjectMapper projectMapper, SprintMapper sprintMapper, WorkItemMapper workItemMapper,
                      TestLibraryMapper testLibraryMapper, TestCaseMapper testCaseMapper, TestPlanMapper testPlanMapper,
                      WikiSpaceMapper wikiSpaceMapper, WikiPageMapper wikiPageMapper, TopicMapper topicMapper,
                      CommentMapper commentMapper, EntityLinkMapper entityLinkMapper,
                      AutomationMapper automationMapper, AgentMapper agentMapper,
                      ActivityMapper activityMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.productMapper = productMapper;
        this.requirementMapper = requirementMapper;
        this.projectMapper = projectMapper;
        this.sprintMapper = sprintMapper;
        this.workItemMapper = workItemMapper;
        this.testLibraryMapper = testLibraryMapper;
        this.testCaseMapper = testCaseMapper;
        this.testPlanMapper = testPlanMapper;
        this.wikiSpaceMapper = wikiSpaceMapper;
        this.wikiPageMapper = wikiPageMapper;
        this.topicMapper = topicMapper;
        this.commentMapper = commentMapper;
        this.entityLinkMapper = entityLinkMapper;
        this.automationMapper = automationMapper;
        this.agentMapper = agentMapper;
        this.activityMapper = activityMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        Long count = userMapper.selectCount(null);
        if (count == null || count == 0) {
            log.info("检测到空数据库，开始灌入演示数据…");
            Map<String, Object> stat = seedAll();
            log.info("演示数据初始化完成：{}", stat);
        } else {
            log.info("数据库已有 {} 个用户，跳过初始化", count);
        }
    }

    /** 清空并重新灌入 */
    @Transactional
    public Map<String, Object> reset() {
        log.warn("收到重置请求，清空所有业务数据…");
        activityMapper.delete(null);
        commentMapper.delete(null);
        entityLinkMapper.delete(null);
        topicMapper.delete(null);
        wikiPageMapper.delete(null);
        wikiSpaceMapper.delete(null);
        testPlanMapper.delete(null);
        testCaseMapper.delete(null);
        testLibraryMapper.delete(null);
        workItemMapper.delete(null);
        sprintMapper.delete(null);
        projectMapper.delete(null);
        requirementMapper.delete(null);
        productMapper.delete(null);
        automationMapper.delete(null);
        agentMapper.delete(null);
        userMapper.delete(null);
        return seedAll();
    }

    @Transactional
    public Map<String, Object> seedAll() {
        String pwd = passwordEncoder.encode(DEFAULT_PASSWORD);
        LocalDateTime now = LocalDateTime.now();

        /* ---------------- 用户 ---------------- */
        seedUser("u1", "张伟", "demo_admin", "管理员", "研发一部", "zhangwei@demo.com", "#13a884", pwd, now);
        seedUser("u2", "李娜", "lina", "产品经理", "产品部", "lina@demo.com", "#f472b6", pwd, now);
        seedUser("u3", "王强", "wangqiang", "开发工程师", "研发一部", "wangqiang@demo.com", "#23d3a9", pwd, now);
        seedUser("u4", "赵敏", "zhaomin", "测试工程师", "测试部", "zhaomin@demo.com", "#ffb020", pwd, now);
        seedUser("u5", "陈晨", "chenchen", "开发工程师", "研发二部", "chenchen@demo.com", "#8b7cf6", pwd, now);
        seedUser("u6", "刘洋", "liuyang", "UI 设计师", "设计部", "liuyang@demo.com", "#46dfd0", pwd, now);
        seedUser("u7", "孙丽", "sunli", "项目经理", "项目部", "sunli@demo.com", "#38bdf8", pwd, now);
        seedUser("u8", "周涛", "zhoutao", "运维工程师", "运维部", "zhoutao@demo.com", "#ff7a6b", pwd, now);

        /* ---------------- 产品 ---------------- */
        product("p1", "智慧协同办公平台", "OA", "#23d3a9", "面向中型企业的协同办公与流程审批一体化平台。",
                "u2", "开发中", List.of("u2", "u3", "u5", "u6", "u4"), daysAgo(120));
        product("p2", "数据分析中台", "DATA", "#38bdf8", "统一数据采集、加工、服务化的企业级数据中台。",
                "u7", "规划中", List.of("u7", "u3", "u8"), daysAgo(60));
        product("p3", "移动端 App", "APP", "#8b7cf6", "iOS / Android 双端协同办公客户端。",
                "u2", "已发布", List.of("u2", "u6", "u4", "u5"), daysAgo(200));

        /* ---------------- 需求 ---------------- */
        String[] reqTitles = {
                "支持多级流程审批与抄送", "工作台自定义仪表盘部件", "移动端消息推送与免打扰",
                "组织架构与人员同步接口", "文档在线预览与协同编辑", "单点登录 SSO 集成",
                "数据导出 Excel / PDF", "操作日志与审计追溯", "待办中心统一聚合",
                "全文检索能力建设", "第三方 Webhook 事件订阅", "浅色 / 深色主题切换"};
        String[] reqStatus = {"待评审", "已排期", "开发中", "已完成", "开发中", "待评审", "已排期", "已完成", "开发中", "待评审", "已排期", "已完成"};
        String[] reqAssignee = {"u3", "u5", "u3", "u5", "u3", "u4", "u8", "u3", "u5", "u3", "u4", "u6"};
        int[] reqPoints = {5, 3, 8, 5, 13, 3, 2, 8, 5, 3, 5, 2};
        String[] reqPriority = {"高", "中", "低", "高", "中"};
        String[] reqSource = {"客户反馈", "产品规划", "内部需求", "客户反馈", "产品规划"};
        for (int i = 0; i < reqTitles.length; i++) {
            String pid = i < 6 ? "p1" : i < 9 ? "p2" : "p3";
            String prefix = i < 6 ? "OA" : i < 9 ? "DATA" : "APP";
            String type = (i % 5 == 0) ? "工单" : "需求";
            Requirement r = new Requirement();
            r.setId("r" + (i + 1));
            r.setProductId(pid);
            r.setCode(String.format("%s-%s-%03d", prefix, "工单".equals(type) ? "TKT" : "REQ", i + 1));
            r.setTitle(reqTitles[i]);
            r.setType(type);
            r.setPriority(reqPriority[i % 5]);
            r.setStatus(reqStatus[i]);
            r.setAssignee(reqAssignee[i]);
            r.setPoints(reqPoints[i]);
            r.setSource(reqSource[i % 5]);
            r.setDescription("");
            r.setCreatedAt(daysAgo(90 - i * 5).atStartOfDay());
            r.setUpdatedAt(r.getCreatedAt());
            requirementMapper.insert(r);
        }

        /* ---------------- 项目 ---------------- */
        project("proj1", "协同办公平台 V2.0", "OAV2", "Scrum", "进行中", "u7",
                List.of("u7", "u2", "u3", "u5", "u4", "u6"), "p1",
                dateAgo(45), dateAhead(45), 62, "#23d3a9", "重构工作台与流程引擎，交付 V2.0 版本。");
        project("proj2", "数据中台一期", "DATA1", "Kanban", "进行中", "u8",
                List.of("u8", "u3", "u7"), "p2",
                dateAgo(20), dateAhead(70), 28, "#38bdf8", "完成数据采集与治理基础能力建设。");
        project("proj3", "App 3.6 迭代", "APP36", "Scrum", "已完成", "u7",
                List.of("u7", "u5", "u4", "u6"), "p3",
                dateAgo(90), dateAgo(20), 100, "#8b7cf6", "移动端性能优化与新交互上线。");

        /* ---------------- 迭代 ---------------- */
        sprint("s1", "proj1", "Sprint 6 · 流程引擎", "完成多级审批引擎与抄送能力", dateAgo(14), dateAhead(7), "进行中");
        sprint("s2", "proj1", "Sprint 5 · 工作台重构", "完成新工作台仪表盘", dateAgo(42), dateAgo(15), "已完成");
        sprint("s3", "proj2", "迭代 1 · 采集", "打通 3 类数据源采集", dateAgo(18), dateAhead(12), "进行中");

        /* ---------------- 工作项 ---------------- */
        String[] wiTitles = {
                "设计审批流程引擎数据模型", "实现流程节点条件分支", "工作台仪表盘部件开发",
                "移动端推送通道接入", "组织架构同步定时任务", "文档预览服务选型与对接",
                "编写流程引擎单元测试", "修复审批历史记录乱序问题", "SSO 登录回调异常处理",
                "数据源采集插件开发", "数据质量校验规则配置", "仪表盘部件拖拽排序",
                "完善接口文档与示例", "性能压测与优化", "缺陷：导出超时"};
        String[] wiStatus = {"待处理", "进行中", "待测试", "已完成", "已完成", "待处理", "进行中", "待测试"};
        String[] wiAssignee = {"u3", "u1", "u6", "u1", "u5", "u1", "u4", "u5", "u3", "u1", "u8", "u3", "u5", "u3", "u3"};
        String[] wiPriority = {"高", "中", "紧急", "低", "中"};
        int[] wiPoints = {5, 8, 3, 5, 2, 8, 3, 2, 5, 13, 5, 3, 2, 5, 2};
        for (int i = 0; i < wiTitles.length; i++) {
            WorkItem w = new WorkItem();
            w.setId("w" + (i + 1));
            w.setProjectId(i < 8 ? "proj1" : i < 12 ? "proj2" : "proj1");
            w.setSprintId(i < 8 ? "s1" : i < 12 ? "s3" : "s1");
            w.setTitle(wiTitles[i]);
            w.setCode((i < 8 ? "OAV2" : i < 12 ? "DATA1" : "APP36") + "-" + (100 + i));
            w.setType(i == 14 ? "缺陷" : (i % 4 == 0 ? "需求" : "任务"));
            w.setPriority(wiPriority[i % 5]);
            w.setStatus(wiStatus[i % wiStatus.length]);
            w.setAssignee(wiAssignee[i]);
            w.setPoints(wiPoints[i]);
            w.setStartDate(dateAgo(Math.max(0, 12 - (i % 10))));
            w.setEndDate(dateAhead(Math.max(0, 8 - (i % 8))));
            w.setDescription("");
            w.setCreatedAt(daysAgo(Math.max(1, 20 - i)).atStartOfDay());
            w.setUpdatedAt(w.getCreatedAt());
            workItemMapper.insert(w);
        }

        /* ---------------- 子任务：挂在若干顶层工作项下，演示父子结构与汇总 ---------------- */
        // {父项, 标题, 负责人, 状态, 优先级, 点数}
        String[][] subtasks = {
                {"w1", "梳理审批节点字段与约束", "u3", "已完成", "高", "3"},
                {"w1", "编写数据模型迁移脚本", "u5", "进行中", "中", "2"},
                {"w2", "实现串行节点流转", "u3", "已完成", "高", "5"},
                {"w2", "实现并行节点与条件分支", "u5", "进行中", "高", "5"},
                {"w3", "设计仪表盘部件容器", "u6", "待测试", "中", "3"},
                {"w3", "实现部件数据绑定", "u5", "待处理", "中", "2"},
                {"w9", "采集插件接口定义", "u8", "已完成", "中", "2"},
        };
        Map<String, Integer> subSeq = new HashMap<>();
        for (int i = 0; i < subtasks.length; i++) {
            String parentId = subtasks[i][0];
            WorkItem parent = workItemMapper.selectById(parentId);
            if (parent == null) continue;
            int n = subSeq.merge(parentId, 1, Integer::sum);

            WorkItem s = new WorkItem();
            s.setId("ws" + (i + 1));
            s.setProjectId(parent.getProjectId());
            s.setSprintId(parent.getSprintId());
            s.setParentId(parentId);
            s.setTitle(subtasks[i][1]);
            s.setCode(parent.getCode() + "-S" + n);
            s.setType("子任务");
            s.setPriority(subtasks[i][4]);
            s.setStatus(subtasks[i][3]);
            s.setAssignee(subtasks[i][2]);
            s.setPoints(Integer.parseInt(subtasks[i][5]));
            s.setStartDate(parent.getStartDate());
            s.setEndDate(parent.getEndDate());
            s.setDescription("由父项「" + parent.getTitle() + "」拆解而来。");
            s.setCreatedAt(parent.getCreatedAt());
            s.setUpdatedAt(parent.getCreatedAt());
            workItemMapper.insert(s);
        }

        /* ---------------- 测试库 / 用例 ---------------- */
        testLibrary("tl1", "协同办公平台测试库", "OA 平台功能与接口用例", "u4", "p1");
        testLibrary("tl2", "数据中台测试库", "数据采集与治理用例", "u4", "p2");

        String[] tcTitles = {
                "多级审批节点顺序流转", "审批抄送通知下发", "仪表盘部件新增与保存", "移动端推送到达率",
                "SSO 登录成功跳转", "SSO 票据过期处理", "数据源连接测试", "数据质量校验告警",
                "文档在线预览加载", "导出 Excel 数据完整", "全文检索结果排序", "主题切换状态保持"};
        String[] tcModule = {"流程引擎", "通知中心", "工作台", "移动端", "认证", "认证", "数据采集", "数据质量", "文档中心", "报表", "检索", "主题"};
        String[] tcPriority = {"高", "中", "高", "中", "高", "低", "中", "高", "中", "高", "低", "低"};
        String[] tcResult = {"通过", "通过", "失败", "通过", "通过", "阻塞", "通过", "通过", "未执行", "通过", "未执行", "通过"};
        for (int i = 0; i < tcTitles.length; i++) {
            TestCase c = new TestCase();
            c.setId("tc" + (i + 1));
            c.setLibraryId(i < 10 ? "tl1" : "tl2");
            c.setCode(String.format("%s-TC-%03d", i < 10 ? "OA" : "DATA", i + 1));
            c.setTitle(tcTitles[i]);
            c.setModule(tcModule[i]);
            c.setPriority(tcPriority[i]);
            c.setType(i % 3 == 0 ? "接口" : "功能");
            c.setPrecondition("用户已登录且拥有对应权限");
            c.setSteps(List.of("进入目标页面", "按照用例描述执行操作", "观察系统响应与结果"));
            c.setExpected("系统按预期返回结果，数据一致且无异常。");
            c.setMaintainer("u4");
            c.setLastResult(tcResult[i]);
            c.setCreatedAt(daysAgo(i + 1).atStartOfDay());
            c.setUpdatedAt(c.getCreatedAt());
            testCaseMapper.insert(c);
        }

        testPlan("tp1", "V2.0 迭代回归测试", "tl1", "proj1", "u4", dateAgo(6), dateAhead(6), "进行中",
                List.of("tc1", "tc2", "tc3", "tc4", "tc5"));
        testPlan("tp2", "数据中台冒烟测试", "tl2", "proj2", "u4", dateAgo(3), dateAhead(3), "进行中",
                List.of("tc7", "tc8"));

        /* ---------------- 实体关联：需求 → 工作项 → 用例 ---------------- */
        // 产品 OA（r1..r6）→ 项目 OAV2 的工作项 w1..w6
        for (int i = 1; i <= 6; i++) {
            link("r" + i, "work-item", "w" + i, "requirement", "implements");
        }
        // 产品 DATA（r7..r9）→ 项目 DATA1 的工作项 w9..w11
        int[] dataReqToItem = {7, 8, 9};
        int[] dataItems = {9, 10, 11};
        for (int i = 0; i < dataReqToItem.length; i++) {
            link("r" + dataReqToItem[i], "work-item", "w" + dataItems[i], "requirement", "implements");
        }
        // 产品 APP（r10..r12）→ 项目 APP36 的工作项
        link("r10", "work-item", "w12", "requirement", "implements");
        link("r11", "work-item", "w13", "requirement", "implements");
        link("r12", "work-item", "w14", "requirement", "implements");

        // 工作项 → 测试用例（verifies）：OA 侧 w1..w6 ↔ tc1..tc6
        for (int i = 1; i <= 6; i++) {
            link("w" + i, "test-case", "tc" + i, "work-item", "verifies");
        }
        // DATA 侧 w9、w10 ↔ tc7、tc8
        link("w9", "test-case", "tc7", "work-item", "verifies");
        link("w10", "test-case", "tc8", "work-item", "verifies");
        // APP 侧 w12 ↔ tc9
        link("w12", "test-case", "tc9", "work-item", "verifies");

        // 需求直接关联用例（verifies），用于覆盖「需求→用例」直连场景
        link("r1", "test-case", "tc1", "requirement", "verifies");
        link("r2", "test-case", "tc2", "requirement", "verifies");
        link("r3", "test-case", "tc3", "requirement", "verifies");
        link("r7", "test-case", "tc7", "requirement", "verifies");
        link("r8", "test-case", "tc8", "requirement", "verifies");
        link("r10", "test-case", "tc9", "requirement", "verifies");

        /* ---------------- 知识空间 / 页面 ---------------- */
        wikiSpace("sp1", "产品知识库", "📘", "#23d3a9", "产品需求、原型、竞品与业务规则沉淀。", "u2", List.of("u2", "u3", "u5", "u7"));
        wikiSpace("sp2", "研发规范中心", "🛠️", "#38bdf8", "编码规范、架构设计、部署运维文档。", "u3", List.of("u3", "u5", "u8"));
        wikiSpace("sp3", "测试知识库", "🧪", "#ffb020", "测试策略、用例规范与环境说明。", "u4", List.of("u4", "u3"));

        wikiPage("pg1", "sp1", null, "产品概述", "u2", daysAgo(3),
                "# 产品概述\n\n本产品面向中型企业提供一体化的**协同办公**与流程审批能力。\n\n## 核心价值\n\n- 审批流程自动化，减少人工环节\n- 统一待办，提升响应效率\n- 数据可视化，支撑管理决策\n\n> 目标客户：100 - 2000 人规模的企业组织。");
        wikiPage("pg2", "sp1", null, "需求管理规范", "u2", daysAgo(6),
                "# 需求管理规范\n\n## 需求来源\n\n1. 客户反馈工单\n2. 产品规划\n3. 内部改进需求\n\n## 优先级定义\n\n| 级别 | 说明 | 响应时长 |\n| --- | --- | --- |\n| 高 | 阻塞核心流程 | 1 个迭代内 |\n| 中 | 影响体验 | 2 个迭代内 |\n| 低 | 体验优化 | 排期视资源 |");
        wikiPage("pg3", "sp1", "pg1", "竞品分析", "u2", daysAgo(9),
                "# 竞品分析\n\n对主流协同办公产品在流程引擎与集成能力上的对比分析。\n\n- 流程引擎灵活性\n- 开放集成能力\n- 移动端体验");
        wikiPage("pg4", "sp2", null, "前端编码规范", "u3", daysAgo(2),
                "# 前端编码规范\n\n## 命名\n\n组件使用 `PascalCase`，变量使用 `camelCase`。\n\n```js\nfunction fetchWorkItems(projectId) {\n  return api.get(`/projects/${projectId}/items`);\n}\n```\n\n## 提交规范\n\n- `feat`: 新功能\n- `fix`: 缺陷修复\n- `docs`: 文档");
        wikiPage("pg5", "sp2", null, "后端架构设计", "u5", daysAgo(5),
                "# 后端架构设计\n\n采用分层架构：接入层 / 应用层 / 领域层 / 基础设施层。\n\n## 关键技术选型\n\n- 服务框架：Spring Boot\n- 持久层：MyBatis-Plus\n- 服务发现：Nacos");
        wikiPage("pg6", "sp3", null, "测试环境说明", "u4", daysAgo(4),
                "# 测试环境说明\n\n| 环境 | 地址 | 说明 |\n| --- | --- | --- |\n| 集成 | test-int.demo.com | 每日构建 |\n| 预发 | pre.demo.com | 发布前回归 |");

        /* ---------------- 协作话题 + 评论 ---------------- */
        topic("t1", "V2.0 发布节奏与灰度策略讨论", "u7", List.of("发布", "决策"),
                "V2.0 计划于下月中旬发布，需要确定灰度比例与回滚方案。欢迎大家提出建议。", daysAgo(1));
        topic("t2", "工作台仪表盘交互方案征集", "u2", List.of("产品", "设计"),
                "仪表盘部件是否支持自由拖拽？大家更倾向固定布局还是可配置布局？", daysAgo(3));
        topic("t3", "接口性能压测结果同步", "u3", List.of("技术", "性能"),
                "核心接口在 500 并发下 P99 为 210ms，满足预期，瓶颈主要在列表查询。", daysAgo(5));

        comment("c1", "topic", "t1", "u3", "建议先灰度 5% 内部用户，观察 3 天无异常再扩到 30%。", daysAgo(1));
        comment("c2", "topic", "t1", "u4", "测试侧已完成回归，可以支持发布，建议补充线上监控告警。", daysAgo(1));
        comment("c3", "topic", "t2", "u6", "推荐可配置 + 预设模板，兼顾新手上手与老用户定制。", daysAgo(3));
        // 工作项评论
        comment("c4", "work-item", "w1", "u3", "数据模型已与架构师确认，字段命名遵循领域语言。", daysAgo(2));
        comment("c5", "work-item", "w1", "u7", "注意与 SSO 的字段映射保持一致。", daysAgo(1));
        comment("c6", "work-item", "w3", "u6", "仪表盘部件拖拽排序已实现，正在补充动效。", daysAgo(1));

        /* ---------------- 自动化 ---------------- */
        automation("a1", "新任务自动设置优先级", true, "工作项创建时", "项目 · 协同办公平台 V2.0",
                "工作项类型 = 任务", List.of("将优先级设置为「中」"), 42, daysAgo(0));
        automation("a2", "缺陷创建通知负责人", true, "工作项创建时", "全部项目",
                "工作项类型 = 缺陷", List.of("通知工作项负责人", "添加标签「待处理」"), 17, daysAgo(1));
        automation("a3", "测试失败自动创建缺陷", true, "用例执行失败时", "测试 · 协同办公平台测试库",
                "执行结果 = 失败", List.of("创建缺陷工作项", "指派给用例维护人"), 6, daysAgo(2));
        automation("a4", "迭代结束归档未完成项", false, "迭代状态变更时", "项目 · 协同办公平台 V2.0",
                "迭代状态 = 已完成", List.of("将未完成工作项移至下一迭代"), 3, daysAgo(15));

        /* ---------------- 智能体 ---------------- */
        agent("ag1", "需求分析师", "🧭", "#23d3a9", "需求", "具备需求拆解、优先级评估、验收标准编写能力，可将原始需求转化为结构化用户故事。",
                List.of("需求拆解", "用户故事", "优先级评估", "验收标准"));
        agent("ag2", "架构设计师", "🏗️", "#13a884", "设计", "基于业务需求输出技术选型、领域模型与接口设计建议，识别架构风险。",
                List.of("技术选型", "领域建模", "接口设计", "风险评估"));
        agent("ag3", "开发工程师", "💻", "#38bdf8", "开发", "生成代码骨架、单元测试与重构建议，协助定位缺陷根因。",
                List.of("代码生成", "单元测试", "缺陷定位", "代码审查"));
        agent("ag4", "测试工程师", "🧪", "#ffb020", "测试", "根据需求自动生成测试用例、边界值分析与测试报告。",
                List.of("用例生成", "边界分析", "测试报告", "缺陷复现"));
        agent("ag5", "项目经理", "📊", "#8b7cf6", "管理", "跟踪迭代进展、识别风险、生成站会纪要与周报。",
                List.of("进度跟踪", "风险预警", "站会纪要", "周报生成"));
        agent("ag6", "技术文档工程师", "📝", "#f472b6", "协作", "将讨论与代码沉淀为规范文档，维护知识库结构。",
                List.of("文档撰写", "知识沉淀", "术语统一", "结构梳理"));

        /* ---------------- 活动日志 ---------------- */
        activity("ac1", "u3", "完成了工作项", "OAV2-101 设计审批流程引擎数据模型", daysAgo(0));
        activity("ac2", "u4", "提交了测试结果", "OA-TC-001 多级审批节点顺序流转 · 通过", daysAgo(0));
        activity("ac3", "u5", "更新了工作项状态", "OAV2-102 实现流程节点条件分支 → 待测试", daysAgo(1));
        activity("ac4", "u2", "创建了需求", "OA-REQ-001 支持多级流程审批与抄送", daysAgo(1));
        activity("ac5", "u7", "发起了话题", "V2.0 发布节奏与灰度策略讨论", daysAgo(1));
        activity("ac6", "u6", "评论了工作项", "OAV2-103 工作台仪表盘部件开发", daysAgo(2));

        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("users", userMapper.selectCount(null));
        stat.put("products", productMapper.selectCount(null));
        stat.put("requirements", requirementMapper.selectCount(null));
        stat.put("projects", projectMapper.selectCount(null));
        stat.put("workItems", workItemMapper.selectCount(null));
        stat.put("subtasks", 7);
        stat.put("testCases", testCaseMapper.selectCount(null));
        stat.put("wikiPages", wikiPageMapper.selectCount(null));
        stat.put("topics", topicMapper.selectCount(null));
        stat.put("comments", commentMapper.selectCount(null));
        stat.put("links", entityLinkMapper.selectCount(null));
        stat.put("automations", automationMapper.selectCount(null));
        stat.put("agents", agentMapper.selectCount(null));
        return stat;
    }

    /* ==================== 插入辅助 ==================== */

    private LocalDate daysAgo(int n) { return LocalDate.now().minusDays(n); }
    private LocalDate dateAgo(int n) { return LocalDate.now().minusDays(n); }
    private LocalDate dateAhead(int n) { return LocalDate.now().plusDays(n); }

    private void seedUser(String id, String name, String username, String role, String dept,
                          String email, String color, String pwd, LocalDateTime now) {
        User u = new User();
        u.setId(id); u.setName(name); u.setUsername(username); u.setPassword(pwd);
        u.setRole(role); u.setDept(dept); u.setEmail(email); u.setColor(color);
        u.setEnabled(true);
        u.setCreatedAt(now); u.setUpdatedAt(now);
        userMapper.insert(u);
    }

    private void product(String id, String name, String identifier, String color, String desc,
                         String owner, String status, List<String> members, LocalDate created) {
        Product p = new Product();
        p.setId(id); p.setName(name); p.setIdentifier(identifier); p.setColor(color);
        p.setDescription(desc); p.setOwner(owner); p.setStatus(status);
        p.setCreatedAt(created.atStartOfDay()); p.setUpdatedAt(p.getCreatedAt());
        productMapper.insert(p);
    }

    private void project(String id, String name, String identifier, String type, String status, String owner,
                         List<String> members, String productId, LocalDate start, LocalDate end,
                         int progress, String color, String desc) {
        Project p = new Project();
        p.setId(id); p.setName(name); p.setIdentifier(identifier); p.setType(type); p.setStatus(status);
        p.setOwner(owner); p.setMembers(members); p.setProductId(productId);
        p.setStartDate(start); p.setEndDate(end); p.setProgress(progress); p.setColor(color);
        p.setDescription(desc);
        p.setCreatedAt(start.atStartOfDay()); p.setUpdatedAt(LocalDateTime.now());
        projectMapper.insert(p);
    }

    private void sprint(String id, String projectId, String name, String goal,
                        LocalDate start, LocalDate end, String status) {
        Sprint s = new Sprint();
        s.setId(id); s.setProjectId(projectId); s.setName(name); s.setGoal(goal);
        s.setStartDate(start); s.setEndDate(end); s.setStatus(status);
        s.setCreatedAt(start.atStartOfDay()); s.setUpdatedAt(LocalDateTime.now());
        sprintMapper.insert(s);
    }

    private void testLibrary(String id, String name, String desc, String owner, String productId) {
        TestLibrary t = new TestLibrary();
        t.setId(id); t.setName(name); t.setDescription(desc); t.setOwner(owner); t.setProductId(productId);
        t.setCreatedAt(LocalDateTime.now()); t.setUpdatedAt(LocalDateTime.now());
        testLibraryMapper.insert(t);
    }

    private void testPlan(String id, String name, String libraryId, String projectId, String owner,
                          LocalDate start, LocalDate end, String status, List<String> caseIds) {
        TestPlan p = new TestPlan();
        p.setId(id); p.setName(name); p.setLibraryId(libraryId); p.setProjectId(projectId); p.setOwner(owner);
        p.setStartDate(start); p.setEndDate(end); p.setStatus(status);
        p.setCaseIds(caseIds); p.setResults(new LinkedHashMap<>());
        p.setCreatedAt(start.atStartOfDay()); p.setUpdatedAt(LocalDateTime.now());
        testPlanMapper.insert(p);
    }

    private void wikiSpace(String id, String name, String icon, String color, String desc,
                           String owner, List<String> members) {
        WikiSpace s = new WikiSpace();
        s.setId(id); s.setName(name); s.setIcon(icon); s.setColor(color);
        s.setDescription(desc); s.setOwner(owner); s.setMembers(members);
        s.setCreatedAt(LocalDateTime.now()); s.setUpdatedAt(LocalDateTime.now());
        wikiSpaceMapper.insert(s);
    }

    private void wikiPage(String id, String spaceId, String parentId, String title, String author,
                          LocalDate updated, String content) {
        WikiPage p = new WikiPage();
        p.setId(id); p.setSpaceId(spaceId); p.setParentId(parentId); p.setTitle(title);
        p.setAuthor(author); p.setContent(content);
        p.setCreatedAt(updated.atStartOfDay()); p.setUpdatedAt(updated.atStartOfDay());
        wikiPageMapper.insert(p);
    }

    private void topic(String id, String title, String author, List<String> tags, String content, LocalDate created) {
        Topic t = new Topic();
        t.setId(id); t.setTitle(title); t.setAuthor(author); t.setTags(tags); t.setContent(content);
        t.setCreatedAt(created.atStartOfDay()); t.setUpdatedAt(created.atStartOfDay());
        topicMapper.insert(t);
    }

    /** @param sourceId 与 sourceType 对应；targetType/targetId 同理 */
    private void link(String sourceId, String targetType, String targetId, String sourceType, String linkType) {
        EntityLink l = new EntityLink();
        l.setId("ln_" + sourceType.substring(0, 2) + sourceId + "_" + targetType.substring(0, 2) + targetId);
        l.setSourceType(sourceType);
        l.setSourceId(sourceId);
        l.setTargetType(targetType);
        l.setTargetId(targetId);
        l.setLinkType(linkType);
        l.setCreatedAt(LocalDateTime.now());
        entityLinkMapper.insert(l);
    }

    private void comment(String id, String targetType, String targetId, String author, String content, LocalDate created) {
        Comment c = new Comment();
        c.setId(id); c.setTargetType(targetType); c.setTargetId(targetId);
        c.setAuthor(author); c.setContent(content);
        c.setCreatedAt(created.atStartOfDay());
        commentMapper.insert(c);
    }

    private void automation(String id, String name, boolean enabled, String trigger, String scope,
                            String condition, List<String> actions, int runs, LocalDate lastRun) {
        Automation a = new Automation();
        a.setId(id); a.setName(name); a.setEnabled(enabled); a.setTriggerEvent(trigger);
        a.setScope(scope); a.setConditionExpr(condition); a.setActions(actions);
        a.setRuns(runs); a.setLastRun(lastRun.atStartOfDay());
        a.setCreatedAt(LocalDateTime.now()); a.setUpdatedAt(LocalDateTime.now());
        automationMapper.insert(a);
    }

    private void agent(String id, String name, String emoji, String color, String role,
                       String desc, List<String> skills) {
        Agent a = new Agent();
        a.setId(id); a.setName(name); a.setEmoji(emoji); a.setColor(color);
        a.setRole(role); a.setDescription(desc); a.setSkills(skills);
        a.setCreatedAt(LocalDateTime.now());
        agentMapper.insert(a);
    }

    private void activity(String id, String userId, String action, String target, LocalDate time) {
        Activity a = new Activity();
        a.setId(id); a.setUserId(userId); a.setAction(action); a.setTarget(target);
        a.setOccurredAt(time.atStartOfDay()); a.setCreatedAt(time.atStartOfDay());
        activityMapper.insert(a);
    }
}
