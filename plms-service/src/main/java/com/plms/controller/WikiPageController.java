package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识页面管理接口
 */
@RestController
@RequestMapping("/api/wiki-pages")
public class WikiPageController extends BaseCrudController {

    public WikiPageController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "wiki-pages";
    }
}
