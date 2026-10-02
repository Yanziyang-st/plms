package com.plms.controller;

import com.plms.common.ApiException;
import com.plms.common.R;
import com.plms.config.AuthContext;
import com.plms.entity.User;
import com.plms.mapper.UserMapper;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 首屏水合接口：一次返回前端渲染所需的全部数据（按当前角色读权限过滤）。
 */
@RestController
@RequestMapping("/api/bootstrap")
public class BootstrapController {

    private final DomainService domainService;
    private final UserMapper userMapper;

    public BootstrapController(DomainService domainService, UserMapper userMapper) {
        this.domainService = domainService;
        this.userMapper = userMapper;
    }

    @GetMapping
    public R<Map<String, Object>> bootstrap() {
        User me = userMapper.selectById(AuthContext.userId());
        if (me == null) throw ApiException.unauthorized("用户不存在或已被移除");
        return R.ok(domainService.bootstrap(me.getRole()));
    }
}
