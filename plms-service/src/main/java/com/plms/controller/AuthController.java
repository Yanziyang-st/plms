package com.plms.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.plms.common.ApiException;
import com.plms.common.ErrorCode;
import com.plms.common.R;
import com.plms.config.AuthContext;
import com.plms.config.JwtUtil;
import com.plms.config.PlmsProperties;
import com.plms.entity.User;
import com.plms.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证接口：登录 / 登出 / 当前用户。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final PlmsProperties props;
    private final com.plms.support.PermissionService permissionService;

    public AuthController(UserMapper userMapper, JwtUtil jwtUtil,
                          PasswordEncoder passwordEncoder, PlmsProperties props,
                          com.plms.support.PermissionService permissionService) {
        this.userMapper = userMapper;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
        this.permissionService = permissionService;
    }

    /** 登录：校验账号密码，签发 JWT */
    @PostMapping("/login")
    public R<Map<String, Object>> login(@RequestBody(required = false) Map<String, String> body) {
        if (body == null) throw ApiException.badRequest("请求体不能为空");
        String username = trim(body.get("username"));
        String password = body.get("password");
        if (username.isEmpty() || password == null || password.isEmpty()) {
            throw ApiException.badRequest("账号和密码不能为空");
        }

        User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", username));
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new ApiException(ErrorCode.BAD_CREDENTIALS, "账号或密码错误");
        }
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "该账号已被停用，请联系管理员");
        }

        String token = jwtUtil.issue(user.getId(), user.getUsername(), user.getRole());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("token", token);
        data.put("tokenType", "Bearer");
        data.put("expiresIn", jwtUtil.getExpireHours() * 3600L);
        data.put("user", user);
        data.put("permissions", permissionService.permissionsOf(user.getRole()));
        return R.ok("登录成功", data);
    }

    /** 当前登录用户 */
    @GetMapping("/me")
    public R<User> me() {
        User user = userMapper.selectById(AuthContext.userId());
        if (user == null) throw ApiException.unauthorized("用户不存在或已被移除");
        return R.ok(user);
    }

    /**
     * 当前用户的权限点 + 全量角色权限矩阵（供前端按钮显隐与后台权限矩阵渲染）。
     */
    @GetMapping("/permissions")
    public R<Map<String, Object>> permissions() {
        User user = userMapper.selectById(AuthContext.userId());
        if (user == null) throw ApiException.unauthorized("用户不存在或已被移除");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("role", user.getRole());
        data.put("permissions", permissionService.permissionsOf(user.getRole()));
        data.put("modules", permissionService.modules());
        data.put("matrix", permissionService.matrix());
        return R.ok(data);
    }

    /**
     * 登出。JWT 为无状态令牌，服务端不维护会话，
     * 客户端需自行丢弃令牌；此处仅作为语义化端点返回成功。
     */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.OK)
    public R<Void> logout() {
        return R.ok("已登出", null);
    }

    private String trim(String s) { return s == null ? "" : s.trim(); }
}
