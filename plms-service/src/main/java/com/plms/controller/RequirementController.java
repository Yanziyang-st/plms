package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 需求/工单管理接口
 */
@RestController
@RequestMapping("/api/requirements")
public class RequirementController extends BaseCrudController {

    public RequirementController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "requirements";
    }
}
