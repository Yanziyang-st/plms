package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 迭代管理接口
 */
@RestController
@RequestMapping("/api/sprints")
public class SprintController extends BaseCrudController {

    public SprintController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "sprints";
    }
}
