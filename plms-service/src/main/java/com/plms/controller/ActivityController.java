package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 活动日志接口
 */
@RestController
@RequestMapping("/api/activities")
public class ActivityController extends BaseCrudController {

    public ActivityController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "activities";
    }
}
