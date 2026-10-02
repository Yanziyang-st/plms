package com.plms.controller;

import com.plms.common.R;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 效能度量接口。
 */
@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

    private final DomainService domainService;

    public MetricsController(DomainService domainService) {
        this.domainService = domainService;
    }

    /** 效能总览：工作项/需求/项目/测试的聚合指标 + 交付趋势 */
    @GetMapping("/overview")
    public R<Map<String, Object>> overview() {
        return R.ok(domainService.metricsOverview());
    }

    /** 成员效能报表 */
    @GetMapping("/members")
    public R<List<Map<String, Object>>> members() {
        return R.ok(domainService.metricsMembers());
    }
}
