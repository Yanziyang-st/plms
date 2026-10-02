package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 测试库管理接口
 */
@RestController
@RequestMapping("/api/test-libraries")
public class TestLibraryController extends BaseCrudController {

    public TestLibraryController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "test-libraries";
    }
}
