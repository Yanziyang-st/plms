package com.plms.config;

import com.plms.common.ApiException;
import com.plms.entity.User;
import com.plms.mapper.UserMapper;
import com.plms.support.PermissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * 权限拦截器：在 {@link AuthInterceptor} 之后执行，按「模块 + 读写动作」做访问控制。
 * <p>GET/HEAD 需要 {@code 模块:read}，其余方法需要 {@code 模块:write}；
 * 未映射到模块的路径（搜索、评论、关联、水合等）仅要求登录。</p>
 */
@Component
@Order(1)
public class PermissionInterceptor implements HandlerInterceptor {

    private final PermissionService permissionService;
    private final UserMapper userMapper;

    public PermissionInterceptor(PermissionService permissionService, UserMapper userMapper) {
        this.permissionService = permissionService;
        this.userMapper = userMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        String path = request.getRequestURI();
        String module = permissionService.moduleOf(path);
        if (module == null) return true;                 // 仅需登录

        User user = userMapper.selectById(AuthContext.userId());
        if (user == null) throw ApiException.unauthorized("用户不存在或已被移除");
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw ApiException.forbidden("账号已被停用，请联系管理员");
        }

        Set<String> perms = permissionService.permissionsOf(user.getRole());
        if (permissionService.isAdmin(user.getRole())) return true;

        boolean readOnly = "GET".equalsIgnoreCase(request.getMethod()) || "HEAD".equals(request.getMethod());
        String needed = module + ":" + (readOnly ? "read" : "write");

        if (!perms.contains(needed)) {
            String moduleLabel = PermissionService.MODULES.getOrDefault(module, module);
            throw ApiException.forbidden(
                    "当前角色（" + user.getRole() + "）没有「" + moduleLabel + (readOnly ? "查看" : "操作") + "」权限");
        }
        return true;
    }
}
