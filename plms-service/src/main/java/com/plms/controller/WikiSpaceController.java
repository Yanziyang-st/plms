package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识空间管理接口
 */
@RestController
@RequestMapping("/api/wiki-spaces")
public class WikiSpaceController extends BaseCrudController {

    public WikiSpaceController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "wiki-spaces";
    }
}
