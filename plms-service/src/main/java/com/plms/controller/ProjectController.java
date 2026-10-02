package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 项目管理接口
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController extends BaseCrudController {

    public ProjectController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "projects";
    }
}
