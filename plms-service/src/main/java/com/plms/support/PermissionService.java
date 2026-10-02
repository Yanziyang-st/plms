package com.plms.support;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 权限服务：角色 → 权限点映射。
 * <p>权限点格式为 {@code 模块:动作}，动作为 {@code read} / {@code write}。
 * 该映射同时作为前端按钮显隐与后台权限矩阵渲染的依据（通过 {@code GET /api/auth/permissions} 下发）。</p>
 */
@Component
public class PermissionService {

    /** 模块定义：key → 中文名 */
    public static final Map<String, String> MODULES = new LinkedHashMap<>();
    static {
        MODULES.put("product", "产品");
        MODULES.put("project", "项目");
        MODULES.put("test", "测试");
        MODULES.put("knowledge", "知识");
        MODULES.put("metrics", "度量");
        MODULES.put("collab", "协作");
        MODULES.put("automation", "自动化");
        MODULES.put("ai", "智能协同");
        MODULES.put("admin", "后台");
    }

    private static final Set<String> ALL = allPermissions();

    /** 角色 → 权限点集合 */
    private static final Map<String, Set<String>> ROLE_PERMISSIONS = new LinkedHashMap<>();
    static {
        ROLE_PERMISSIONS.put("管理员", ALL);
        ROLE_PERMISSIONS.put("项目经理", perms(
                "product:read", "product:write",
                "project:read", "project:write",
                "test:read",
                "knowledge:read",
                "metrics:read", "metrics:write",
                "collab:read", "collab:write",
                "automation:read", "automation:write",
                "ai:read"
        ));
        ROLE_PERMISSIONS.put("产品经理", perms(
                "product:read", "product:write",
                "project:read",
                "test:read",
                "knowledge:read", "knowledge:write",
                "metrics:read",
                "collab:read", "collab:write",
                "ai:read"
        ));
        ROLE_PERMISSIONS.put("开发工程师", perms(
                "product:read",
                "project:read", "project:write",
                "test:read",
                "knowledge:read", "knowledge:write",
                "collab:read", "collab:write",
                "automation:read",
                "ai:read"
        ));
        ROLE_PERMISSIONS.put("测试工程师", perms(
                "product:read",
                "project:read",
                "test:read", "test:write",
                "knowledge:read",
                "collab:read", "collab:write",
                "ai:read"
        ));
        ROLE_PERMISSIONS.put("UI 设计师", perms(
                "product:read",
                "project:read",
                "knowledge:read", "knowledge:write",
                "collab:read", "collab:write",
                "ai:read"
        ));
        ROLE_PERMISSIONS.put("运维工程师", perms(
                "project:read",
                "metrics:read",
                "collab:read", "collab:write",
                "automation:read", "automation:write",
                "ai:read"
        ));
    }

    private static Set<String> perms(String... p) {
        return Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(p)));
    }

    private static Set<String> allPermissions() {
        Set<String> set = new LinkedHashSet<>();
        MODULES.keySet().forEach(m -> { set.add(m + ":read"); set.add(m + ":write"); });
        return Collections.unmodifiableSet(set);
    }

    /* ==================== 查询 ==================== */

    public Set<String> permissionsOf(String role) {
        return ROLE_PERMISSIONS.getOrDefault(role, Collections.emptySet());
    }

    public boolean has(String role, String module, String action) {
        return permissionsOf(role).contains(module + ":" + action);
    }

    public boolean hasPermission(String role, String permission) {
        return permissionsOf(role).contains(permission);
    }

    public boolean isAdmin(String role) {
        return "管理员".equals(role);
    }

    /** 供前端渲染权限矩阵 */
    public List<Map<String, Object>> matrix() {
        List<Map<String, Object>> list = new ArrayList<>();
        ROLE_PERMISSIONS.forEach((role, perms) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("role", role);
            row.put("permissions", new ArrayList<>(perms));
            row.put("modules", readableModules(perms));
            list.add(row);
        });
        return list;
    }

    private List<String> readableModules(Set<String> perms) {
        List<String> mods = new ArrayList<>();
        perms.forEach(p -> {
            if (p.endsWith(":read")) mods.add(p.substring(0, p.indexOf(':')));
        });
        return mods;
    }

    public List<Map<String, String>> modules() {
        List<Map<String, String>> list = new ArrayList<>();
        MODULES.forEach((k, v) -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("key", k);
            m.put("label", v);
            list.add(m);
        });
        return list;
    }

    /* ==================== 路径 → 模块 ==================== */

    private static final List<String[]> PATH_MODULES = List.of(
            new String[]{"/api/products", "product"},
            new String[]{"/api/requirements", "product"},
            new String[]{"/api/projects", "project"},
            new String[]{"/api/sprints", "project"},
            new String[]{"/api/work-items", "project"},
            new String[]{"/api/test-libraries", "test"},
            new String[]{"/api/test-cases", "test"},
            new String[]{"/api/test-plans", "test"},
            new String[]{"/api/wiki-spaces", "knowledge"},
            new String[]{"/api/wiki-pages", "knowledge"},
            new String[]{"/api/topics", "collab"},
            new String[]{"/api/automations", "automation"},
            new String[]{"/api/agents", "ai"},
            new String[]{"/api/users", "admin"},
            new String[]{"/api/metrics", "metrics"},
            new String[]{"/api/system/reset", "admin"}
    );

    /** 解析路径所属模块；返回 null 表示不做模块级限制（仅需登录） */
    public String moduleOf(String path) {
        for (String[] pair : PATH_MODULES) {
            if (path.equals(pair[0]) || path.startsWith(pair[0] + "/")) return pair[1];
        }
        return null;
    }
}
