package com.plms.controller;

import com.plms.common.R;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 需求追踪接口（需求跟踪矩阵 RTM）。
 */
@RestController
@RequestMapping("/api/trace")
public class TraceController {

    private final DomainService domainService;

    public TraceController(DomainService domainService) {
        this.domainService = domainService;
    }

    /**
     * 追踪矩阵：按产品汇总每个需求的「实现 + 验证」覆盖情况。
     * 不传 productId 时返回全部产品。
     */
    @GetMapping("/matrix")
    public R<Map<String, Object>> matrix(@RequestParam(required = false) String productId) {
        return R.ok(domainService.traceMatrix(productId));
    }

    /** 单个需求的追踪详情：关联工作项、关联用例、覆盖度 */
    @GetMapping("/requirement/{id}")
    public R<Map<String, Object>> requirement(@PathVariable String id) {
        return R.ok(domainService.traceRequirement(id));
    }
}
