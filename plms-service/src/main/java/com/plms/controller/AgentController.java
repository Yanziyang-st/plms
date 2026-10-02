package com.plms.controller;

import com.plms.service.CrudService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 智能体管理接口
 */
@RestController
@RequestMapping("/api/agents")
public class AgentController extends BaseCrudController {

    public AgentController(CrudService crud) {
        super(crud);
    }

    @Override
    protected String resource() {
        return "agents";
    }
}
