package com.plms.support;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plms.entity.*;
import com.plms.mapper.*;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 资源注册表：资源路径名 → Mapper / 实体类型。
 * 让通用 CRUD 控制器与校验器可以按资源名访问任意集合，避免重复样板代码。
 */
@Component
public class ResourceRegistry {

    /** 资源名 -> Mapper（使用原始类型以统一承载不同实体，调用处做 unchecked 处理） */
    private final Map<String, BaseMapper> mappers = new LinkedHashMap<>();
    /** 资源名 -> 实体类型 */
    private final Map<String, Class<?>> entityTypes = new LinkedHashMap<>();
    /** 资源名 -> 中文名 */
    private final Map<String, String> labels = new LinkedHashMap<>();

    @SuppressWarnings({"unchecked", "rawtypes"})
    public ResourceRegistry(
            ProductMapper productMapper,
            RequirementMapper requirementMapper,
            ProjectMapper projectMapper,
            SprintMapper sprintMapper,
            WorkItemMapper workItemMapper,
            TestLibraryMapper testLibraryMapper,
            TestCaseMapper testCaseMapper,
            TestPlanMapper testPlanMapper,
            WikiSpaceMapper wikiSpaceMapper,
            WikiPageMapper wikiPageMapper,
            TopicMapper topicMapper,
            AutomationMapper automationMapper,
            AgentMapper agentMapper,
            UserMapper userMapper,
            ActivityMapper activityMapper,
            EntityLinkMapper entityLinkMapper,
            CommentMapper commentMapper) {

        reg("products", (BaseMapper) productMapper, Product.class, "产品");
        reg("requirements", (BaseMapper) requirementMapper, Requirement.class, "需求");
        reg("projects", (BaseMapper) projectMapper, Project.class, "项目");
        reg("sprints", (BaseMapper) sprintMapper, Sprint.class, "迭代");
        reg("work-items", (BaseMapper) workItemMapper, WorkItem.class, "工作项");
        reg("test-libraries", (BaseMapper) testLibraryMapper, TestLibrary.class, "测试库");
        reg("test-cases", (BaseMapper) testCaseMapper, TestCase.class, "测试用例");
        reg("test-plans", (BaseMapper) testPlanMapper, TestPlan.class, "测试计划");
        reg("wiki-spaces", (BaseMapper) wikiSpaceMapper, WikiSpace.class, "知识空间");
        reg("wiki-pages", (BaseMapper) wikiPageMapper, WikiPage.class, "知识页面");
        reg("topics", (BaseMapper) topicMapper, Topic.class, "协作话题");
        reg("automations", (BaseMapper) automationMapper, Automation.class, "自动化规则");
        reg("agents", (BaseMapper) agentMapper, Agent.class, "智能体");
        reg("users", (BaseMapper) userMapper, User.class, "用户");
        reg("activities", (BaseMapper) activityMapper, Activity.class, "活动日志");
        reg("links", (BaseMapper) entityLinkMapper, EntityLink.class, "实体关联");
        reg("comments", (BaseMapper) commentMapper, Comment.class, "评论");
    }

    private void reg(String name, BaseMapper mapper, Class<?> type, String label) {
        mappers.put(name, mapper);
        entityTypes.put(name, type);
        labels.put(name, label);
    }

    public boolean exists(String resource) { return mappers.containsKey(resource); }

    public BaseMapper mapper(String resource) { return mappers.get(resource); }

    public Class<?> entityType(String resource) { return entityTypes.get(resource); }

    public String label(String resource) { return labels.getOrDefault(resource, resource); }

    public Set<String> resources() { return Collections.unmodifiableSet(mappers.keySet()); }
}
