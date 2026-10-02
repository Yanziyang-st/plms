package com.plms.controller;

import com.plms.common.R;
import com.plms.entity.Automation;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

/**
 * 自动化规则接口。
 */
@RestController
@RequestMapping("/api/automations")
public class AutomationController extends BaseCrudController {

    private final DomainService domainService;

    public AutomationController(CrudService crud, DomainService domainService) {
        super(crud);
        this.domainService = domainService;
    }

    @Override
    protected String resource() {
        return "automations";
    }

    /** 启用 / 停用规则 */
    @PostMapping("/{id}/toggle")
    public R<Automation> toggle(@PathVariable String id) {
        return R.ok("状态已切换", domainService.toggleAutomation(id));
    }

    /** 立即执行一次规则（执行次数 +1） */
    @PostMapping("/{id}/run")
    public R<Automation> run(@PathVariable String id) {
        return R.ok("已执行一次", domainService.runAutomation(id));
    }
}
