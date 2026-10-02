package com.plms.support;

import java.util.*;
import java.util.regex.Pattern;

/**
 * 资源字段校验规则表。
 * 规则同时用于：① 入参校验；② 列表接口的可筛选字段白名单；③ 关键字检索字段。
 */
public final class Schemas {

    private Schemas() {}

    /* ==================== 字段规则 ==================== */
    public static final class Rule {
        final String field;      // Java 字段名（camelCase）
        final String label;      // 中文名，用于错误提示
        final String type;       // string | int | bool | enum | ref | array | date
        boolean required;
        boolean readonly;
        List<String> values;
        Pattern pattern;
        String patternMsg;
        Integer min, max, minItems, maxItems;
        Object def;
        boolean hasDef;
        String ref;

        private Rule(String field, String type, String label) {
            this.field = field; this.type = type; this.label = label;
        }

        public static Rule of(String field, String type, String label) { return new Rule(field, type, label); }

        public Rule required() { this.required = true; return this; }
        public Rule readonly() { this.readonly = true; return this; }
        public Rule len(int min, int max) { this.min = min; this.max = max; return this; }
        public Rule range(int min, int max) { this.min = min; this.max = max; return this; }
        public Rule minItems(int n) { this.minItems = n; return this; }
        public Rule in(String... v) { this.values = Arrays.asList(v); return this; }
        public Rule pattern(String p) { this.pattern = Pattern.compile(p); return this; }
        public Rule pattern(String p, String message) { this.pattern = Pattern.compile(p); this.patternMsg = message; return this; }
        public Rule def(Object d) { this.def = d; this.hasDef = true; return this; }
        public Rule ref(String collection) { this.ref = collection; return this; }

        public String field() { return field; }
        public String label() { return label; }
        public String type() { return type; }
        public boolean isRequired() { return required; }
        public boolean isReadonly() { return readonly; }
        public List<String> values() { return values; }
        public Pattern pattern() { return pattern; }
        public String patternMsg() { return patternMsg; }
        public Integer min() { return min; }
        public Integer max() { return max; }
        public Integer minItems() { return minItems; }
        public Integer maxItems() { return maxItems; }
        public Object def() { return def; }
        public boolean hasDef() { return hasDef; }
        public String ref() { return ref; }
    }

    /* ==================== 规则表 ==================== */
    private static final Map<String, List<Rule>> RULES = new LinkedHashMap<>();
    private static final Map<String, String> SEARCH_FIELD = new LinkedHashMap<>();

    static {
        RULES.put("products", List.of(
                Rule.of("name", "string", "产品名称").required().len(2, 60),
                Rule.of("identifier", "string", "标识符").required().len(2, 6).pattern("^[A-Za-z][A-Za-z0-9]*$", "标识符仅允许字母与数字，且必须以字母开头"),
                Rule.of("description", "string", "产品描述").len(0, 300).def(""),
                Rule.of("owner", "ref", "负责人").ref("users").def("u1"),
                Rule.of("status", "enum", "状态").in("规划中", "开发中", "已发布", "已归档").def("规划中"),
                Rule.of("color", "string", "标识色").len(0, 20).def("#23d3a9"),
                Rule.of("members", "array", "成员").def(List.of())
        ));
        SEARCH_FIELD.put("products", "name");

        RULES.put("requirements", List.of(
                Rule.of("title", "string", "标题").required().len(2, 120),
                Rule.of("productId", "ref", "所属产品").required().ref("products"),
                Rule.of("type", "enum", "类型").in("需求", "工单").def("需求"),
                Rule.of("priority", "enum", "优先级").in("高", "中", "低").def("中"),
                Rule.of("status", "enum", "状态").in("待评审", "已排期", "开发中", "已完成").def("待评审"),
                Rule.of("assignee", "ref", "负责人").ref("users").def("u1"),
                Rule.of("points", "int", "故事点").range(0, 100).def(3),
                Rule.of("source", "enum", "来源").in("客户反馈", "产品规划", "内部需求", "数据分析").def("内部需求"),
                Rule.of("description", "string", "描述").len(0, 1000).def(""),
                Rule.of("code", "string", "编号").readonly()
        ));
        SEARCH_FIELD.put("requirements", "title");

        RULES.put("projects", List.of(
                Rule.of("name", "string", "项目名称").required().len(2, 60),
                Rule.of("identifier", "string", "标识符").required().len(2, 8).pattern("^[A-Za-z][A-Za-z0-9]*$", "标识符仅允许字母与数字，且必须以字母开头"),
                Rule.of("type", "enum", "开发模型").in("Scrum", "Kanban", "瀑布").def("Scrum"),
                Rule.of("status", "enum", "状态").in("进行中", "已完成", "已暂停").def("进行中"),
                Rule.of("owner", "ref", "负责人").ref("users").def("u1"),
                Rule.of("productId", "ref", "关联产品").ref("products").def(null),
                Rule.of("startDate", "date", "开始日期").def(null),
                Rule.of("endDate", "date", "结束日期").def(null),
                Rule.of("progress", "int", "进度").range(0, 100).def(0),
                Rule.of("color", "string", "标识色").len(0, 20).def("#23d3a9"),
                Rule.of("description", "string", "项目描述").len(0, 300).def(""),
                Rule.of("members", "array", "成员").def(List.of())
        ));
        SEARCH_FIELD.put("projects", "name");

        RULES.put("sprints", List.of(
                Rule.of("name", "string", "迭代名称").required().len(2, 60),
                Rule.of("projectId", "ref", "所属项目").required().ref("projects"),
                Rule.of("goal", "string", "迭代目标").len(0, 200).def(""),
                Rule.of("startDate", "date", "开始日期").def(null),
                Rule.of("endDate", "date", "结束日期").def(null),
                Rule.of("status", "enum", "状态").in("未开始", "进行中", "已完成").def("未开始")
        ));
        SEARCH_FIELD.put("sprints", "name");

        RULES.put("work-items", List.of(
                Rule.of("title", "string", "标题").required().len(2, 120),
                Rule.of("projectId", "ref", "所属项目").required().ref("projects"),
                Rule.of("sprintId", "ref", "所属迭代").ref("sprints").def(null),
                Rule.of("parentId", "ref", "父工作项").ref("work-items").def(null),
                Rule.of("type", "enum", "类型").in("任务", "需求", "缺陷", "子任务").def("任务"),
                Rule.of("priority", "enum", "优先级").in("紧急", "高", "中", "低").def("中"),
                Rule.of("status", "enum", "状态").in("待处理", "进行中", "待测试", "已完成").def("待处理"),
                Rule.of("assignee", "ref", "负责人").ref("users").def("u1"),
                Rule.of("points", "int", "故事点").range(0, 100).def(3),
                Rule.of("startDate", "date", "开始日期").def(null),
                Rule.of("endDate", "date", "截止日期").def(null),
                Rule.of("description", "string", "描述").len(0, 1000).def(""),
                Rule.of("code", "string", "编号").readonly()
        ));
        SEARCH_FIELD.put("work-items", "title");

        RULES.put("test-libraries", List.of(
                Rule.of("name", "string", "测试库名称").required().len(2, 60),
                Rule.of("description", "string", "描述").len(0, 300).def(""),
                Rule.of("owner", "ref", "负责人").ref("users").def("u1"),
                Rule.of("productId", "ref", "关联产品").ref("products").def(null)
        ));
        SEARCH_FIELD.put("test-libraries", "name");

        RULES.put("test-cases", List.of(
                Rule.of("title", "string", "用例标题").required().len(2, 120),
                Rule.of("libraryId", "ref", "所属测试库").required().ref("test-libraries"),
                Rule.of("module", "string", "所属模块").len(0, 30).def("通用"),
                Rule.of("type", "enum", "类型").in("功能", "接口", "性能", "兼容").def("功能"),
                Rule.of("priority", "enum", "优先级").in("高", "中", "低").def("中"),
                Rule.of("precondition", "string", "前置条件").len(0, 200).def(""),
                Rule.of("steps", "array", "测试步骤").def(List.of()),
                Rule.of("expected", "string", "预期结果").len(0, 300).def(""),
                Rule.of("maintainer", "ref", "维护人").ref("users").def("u1"),
                Rule.of("lastResult", "enum", "最近结果").in("通过", "失败", "阻塞", "未执行").def("未执行"),
                Rule.of("code", "string", "编号").readonly()
        ));
        SEARCH_FIELD.put("test-cases", "title");

        RULES.put("test-plans", List.of(
                Rule.of("name", "string", "计划名称").required().len(2, 60),
                Rule.of("projectId", "ref", "关联项目").ref("projects").def(null),
                Rule.of("libraryId", "ref", "关联测试库").ref("test-libraries").def(null),
                Rule.of("owner", "ref", "负责人").ref("users").def("u1"),
                Rule.of("startDate", "date", "开始日期").def(null),
                Rule.of("endDate", "date", "结束日期").def(null),
                Rule.of("status", "enum", "状态").in("未开始", "进行中", "已完成").def("进行中"),
                Rule.of("caseIds", "array", "用例集合").required().minItems(1)
        ));
        SEARCH_FIELD.put("test-plans", "name");

        RULES.put("wiki-spaces", List.of(
                Rule.of("name", "string", "空间名称").required().len(2, 60),
                Rule.of("icon", "string", "图标").len(0, 8).def("📘"),
                Rule.of("color", "string", "标识色").len(0, 20).def("#23d3a9"),
                Rule.of("description", "string", "描述").len(0, 300).def(""),
                Rule.of("owner", "ref", "负责人").ref("users").def("u1"),
                Rule.of("members", "array", "成员").def(List.of())
        ));
        SEARCH_FIELD.put("wiki-spaces", "name");

        RULES.put("wiki-pages", List.of(
                Rule.of("title", "string", "页面标题").required().len(1, 120),
                Rule.of("spaceId", "ref", "所属空间").required().ref("wiki-spaces"),
                Rule.of("parentId", "string", "父页面").len(0, 32).def(null),
                Rule.of("content", "string", "正文").len(0, 20000).def(""),
                Rule.of("author", "ref", "作者").ref("users").def("u1")
        ));
        SEARCH_FIELD.put("wiki-pages", "title");

        RULES.put("topics", List.of(
                Rule.of("title", "string", "话题标题").required().len(2, 120),
                Rule.of("content", "string", "内容").len(0, 2000).def(""),
                Rule.of("author", "ref", "发起人").ref("users").def("u1"),
                Rule.of("tags", "array", "标签").def(List.of())
        ));
        SEARCH_FIELD.put("topics", "title");

        RULES.put("automations", List.of(
                Rule.of("name", "string", "规则名称").required().len(2, 60),
                Rule.of("enabled", "bool", "是否启用").def(true),
                Rule.of("triggerEvent", "string", "触发时机").required().len(2, 40),
                Rule.of("scope", "string", "生效范围").len(0, 60).def("全部项目"),
                Rule.of("conditionExpr", "string", "触发条件").len(0, 120).def("无"),
                Rule.of("actions", "array", "执行动作").required().minItems(1),
                Rule.of("runs", "int", "执行次数").readonly(),
                Rule.of("lastRun", "date", "最近执行").readonly()
        ));
        SEARCH_FIELD.put("automations", "name");

        RULES.put("users", List.of(
                Rule.of("name", "string", "姓名").required().len(1, 30),
                Rule.of("role", "enum", "角色").in("管理员", "项目经理", "产品经理", "开发工程师", "测试工程师", "UI 设计师", "运维工程师").def("开发工程师"),
                Rule.of("dept", "string", "部门").len(0, 30).def("未分配"),
                Rule.of("email", "string", "邮箱").len(0, 60).def("")
                        .pattern("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", "邮箱格式不正确"),
                Rule.of("enabled", "bool", "是否启用").def(true)
        ));
        SEARCH_FIELD.put("users", "name");

        RULES.put("agents", List.of(
                Rule.of("name", "string", "名称").required().len(1, 60),
                Rule.of("emoji", "string", "图标").len(0, 8).def("🤖"),
                Rule.of("color", "string", "标识色").len(0, 20).def("#23d3a9"),
                Rule.of("role", "string", "角色").required().len(1, 20),
                Rule.of("description", "string", "描述").len(0, 300).def(""),
                Rule.of("skills", "array", "能力").def(List.of())
        ));
        SEARCH_FIELD.put("agents", "name");

        /* ---------------- 实体关联（需求追踪矩阵） ---------------- */
        RULES.put("links", List.of(
                Rule.of("sourceType", "enum", "源类型").required().in("requirement", "work-item", "test-case"),
                Rule.of("sourceId", "string", "源对象").required().len(1, 32),
                Rule.of("targetType", "enum", "目标类型").required().in("requirement", "work-item", "test-case"),
                Rule.of("targetId", "string", "目标对象").required().len(1, 32),
                Rule.of("linkType", "enum", "关联类型").in("implements", "verifies", "relates").def("relates")
        ));
        SEARCH_FIELD.put("links", "sourceId");

        /* ---------------- 通用评论 ---------------- */
        RULES.put("comments", List.of(
                Rule.of("targetType", "enum", "评论对象类型").required().in("work-item", "requirement", "test-case", "topic"),
                Rule.of("targetId", "string", "评论对象").required().len(1, 32),
                Rule.of("author", "ref", "作者").ref("users").def("u1"),
                Rule.of("content", "string", "评论内容").required().len(1, 1000)
        ));
        SEARCH_FIELD.put("comments", "content");
    }

    /* ==================== 查询 ==================== */
    public static boolean supports(String resource) { return RULES.containsKey(resource); }

    public static List<Rule> rules(String resource) { return RULES.get(resource); }

    public static String searchField(String resource) { return SEARCH_FIELD.get(resource); }

    /** 可筛选字段白名单：所有非数组、非 readonly 的规则字段 */
    public static Set<String> filterableFields(String resource) {
        Set<String> set = new LinkedHashSet<>();
        List<Rule> list = RULES.get(resource);
        if (list == null) return set;
        for (Rule r : list) {
            if (r.isReadonly() || "array".equals(r.type())) continue;
            set.add(r.field());
        }
        return set;
    }

    /** readonly 字段（客户端传入将被忽略） */
    public static Set<String> readonlyFields(String resource) {
        Set<String> set = new LinkedHashSet<>();
        List<Rule> list = RULES.get(resource);
        if (list == null) return set;
        for (Rule r : list) if (r.isReadonly()) set.add(r.field());
        return set;
    }
}
