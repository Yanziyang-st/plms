package com.plms.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.plms.common.ApiException;
import com.plms.common.PageResult;
import com.plms.common.R;
import com.plms.config.AuthContext;
import com.plms.entity.User;
import com.plms.mapper.UserMapper;
import com.plms.service.CrudService;
import com.plms.support.CodeGen;
import com.plms.support.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户管理接口。
 * <p>相比通用 CRUD 多了三件事：① 新建时必须设置登录账号与初始密码；
 * ② 提供重置密码；③ 提供启用 / 停用开关。响应中永不包含密码摘要。</p>
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final String DEFAULT_PASSWORD = "123456";
    private static final String COLOR_PALETTE = "#23d3a9,#13a884,#38bdf8,#8b7cf6,#ffb020,#f472b6,#ff7a6b,#46dfd0";

    private final CrudService crud;
    private final Validator validator;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final CodeGen codeGen;

    public UserController(CrudService crud, Validator validator, UserMapper userMapper,
                          PasswordEncoder passwordEncoder, CodeGen codeGen) {
        this.crud = crud;
        this.validator = validator;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.codeGen = codeGen;
    }

    @GetMapping
    public R<PageResult<Object>> list(@RequestParam Map<String, String> params) {
        return R.ok(crud.list("users", params));
    }

    @GetMapping("/{id}")
    public R<Object> get(@PathVariable String id) {
        return R.ok(crud.get("users", id));
    }

    /**
     * 新建成员。
     * 请求体：{ "name", "username", "password?", "role", "dept", "email" }
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public R<User> create(@RequestBody Map<String, Object> body) {
        if (body == null) throw ApiException.badRequest("请求体不能为空");

        Map<String, Object> clean = validator.validate("users", body, false);

        String username = str(body.get("username")).trim();
        if (username.isEmpty()) throw ApiException.badRequest("参数校验失败：登录账号不能为空");
        if (!username.matches("^[A-Za-z][A-Za-z0-9_]{2,29}$")) {
            throw ApiException.badRequest("参数校验失败：登录账号需以字母开头，由字母、数字、下划线组成，长度 3~30");
        }
        Long dup = userMapper.selectCount(new QueryWrapper<User>().eq("username", username));
        if (dup != null && dup > 0) throw ApiException.conflict("登录账号「" + username + "」已被占用");

        String password = str(body.get("password"));
        if (password.isEmpty()) password = DEFAULT_PASSWORD;
        if (password.length() < 6 || password.length() > 32) {
            throw ApiException.badRequest("参数校验失败：密码长度需在 6~32 位之间");
        }

        User u = new User();
        u.setId(codeGen.id("us"));
        u.setName((String) clean.get("name"));
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(password));
        u.setRole((String) clean.getOrDefault("role", "开发工程师"));
        u.setDept((String) clean.getOrDefault("dept", "未分配"));
        u.setEmail((String) clean.getOrDefault("email", ""));
        u.setColor(pickColor());
        u.setEnabled(true);
        u.setCreatedAt(LocalDateTime.now());
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(u);

        return R.ok("成员已创建", userMapper.selectById(u.getId()));
    }

    /** 更新成员资料 / 角色 / 启停状态（不接受密码，需走重置密码接口） */
    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public R<User> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        update(id, body);
        return R.ok("更新成功", userMapper.selectById(id));
    }

    @PutMapping("/{id}")
    public R<User> put(@PathVariable String id, @RequestBody Map<String, Object> body) {
        update(id, body);
        return R.ok("更新成功", userMapper.selectById(id));
    }

    private void update(String id, Map<String, Object> body) {
        User existing = userMapper.selectById(id);
        if (existing == null) throw ApiException.notFound("用户不存在（id=" + id + "）");

        Map<String, Object> clean = validator.validate("users", body, true);

        // 保护：不能停用自己，也不能移除最后一名管理员
        if (Boolean.FALSE.equals(clean.get("enabled")) && id.equals(AuthContext.userId())) {
            throw ApiException.business("不能停用当前登录的账号");
        }
        Object newRole = clean.get("role");
        if (newRole != null && !newRole.equals(existing.getRole())) {
            if ("管理员".equals(existing.getRole()) && countAdmins() <= 1 && !"管理员".equals(newRole)) {
                throw ApiException.business("系统至少需要保留一名管理员");
            }
        }
        if (Boolean.FALSE.equals(clean.get("enabled")) && "管理员".equals(existing.getRole()) && countAdmins() <= 1) {
            throw ApiException.business("系统至少需要保留一名可用的管理员");
        }

        crud.update("users", id, clean);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        crud.delete("users", id);
        return R.ok("删除成功", null);
    }

    /**
     * 重置密码。请求体：{ "password": "newpass" }，不传则重置为默认密码。
     */
    @PostMapping("/{id}/reset-password")
    public R<Map<String, Object>> resetPassword(@PathVariable String id, @RequestBody(required = false) Map<String, String> body) {
        User u = userMapper.selectById(id);
        if (u == null) throw ApiException.notFound("用户不存在（id=" + id + "）");

        String password = body == null ? null : body.get("password");
        if (password == null || password.isBlank()) password = DEFAULT_PASSWORD;
        if (password.length() < 6 || password.length() > 32) {
            throw ApiException.badRequest("密码长度需在 6~32 位之间");
        }
        u.setPassword(passwordEncoder.encode(password));
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("userId", id);
        data.put("resetTo", password);
        return R.ok("密码已重置", data);
    }

    /** 启用 / 停用成员 */
    @PostMapping("/{id}/toggle")
    public R<User> toggle(@PathVariable String id) {
        User u = userMapper.selectById(id);
        if (u == null) throw ApiException.notFound("用户不存在（id=" + id + "）");
        boolean next = !Boolean.TRUE.equals(u.getEnabled());
        if (!next) {
            if (id.equals(AuthContext.userId())) throw ApiException.business("不能停用当前登录的账号");
            if ("管理员".equals(u.getRole()) && countAdmins() <= 1) {
                throw ApiException.business("系统至少需要保留一名可用的管理员");
            }
        }
        u.setEnabled(next);
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);
        return R.ok(next ? "成员已启用" : "成员已停用", userMapper.selectById(id));
    }

    @PostMapping("/batch-delete")
    public R<Map<String, Object>> batchDelete(@RequestBody Map<String, List<String>> body) {
        return R.ok("批量删除完成", crud.batchDelete("users", body == null ? null : body.get("ids")));
    }

    @PostMapping("/batch-update")
    @SuppressWarnings("unchecked")
    public R<Map<String, Object>> batchUpdate(@RequestBody Map<String, Object> body) {
        if (body == null) throw ApiException.badRequest("请求体不能为空");
        Object ids = body.get("ids");
        Object patch = body.get("patch");
        if (!(ids instanceof List)) throw ApiException.badRequest("ids 必须是数组");
        if (!(patch instanceof Map)) throw ApiException.badRequest("patch 必须是对象");
        return R.ok("批量更新完成", crud.batchUpdate("users", (List<String>) ids, (Map<String, Object>) patch));
    }

    private long countAdmins() {
        Long n = userMapper.selectCount(new QueryWrapper<User>().eq("role", "管理员").eq("enabled", true));
        return n == null ? 0 : n;
    }

    private String pickColor() {
        String[] colors = COLOR_PALETTE.split(",");
        long n = userMapper.selectCount(null);
        return colors[(int) (n % colors.length)];
    }

    private String str(Object o) { return o == null ? "" : String.valueOf(o); }
}
