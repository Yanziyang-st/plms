package com.plms.controller;

import com.plms.common.R;
import com.plms.service.DataSeeder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 系统接口：健康检查 + 演示数据重置。
 */
@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final DataSeeder dataSeeder;

    public SystemController(DataSeeder dataSeeder) {
        this.dataSeeder = dataSeeder;
    }

    /** 健康检查（无需认证，供探活与联调自检使用） */
    @GetMapping("/health")
    public R<Map<String, Object>> health() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("service", "plms-service");
        m.put("status", "UP");
        m.put("time", java.time.LocalDateTime.now().toString());
        return R.ok(m);
    }

    /** 重置演示数据（清空所有业务表并重新灌入种子数据） */
    @PostMapping("/reset")
    public R<Map<String, Object>> reset() {
        Map<String, Object> stat = dataSeeder.reset();
        return R.ok("演示数据已重置", stat);
    }
}
