package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 产品管理接口
 */
@RestController
@RequestMapping("/api/products")
public class ProductController extends BaseCrudController {

    public ProductController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "products";
    }
}
