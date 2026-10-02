package com.plms.controller;

import com.plms.common.R;
import com.plms.entity.TestCase;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 测试用例接口。
 */
@RestController
@RequestMapping("/api/test-cases")
public class TestCaseController extends BaseCrudController {

    private final DomainService domainService;

    public TestCaseController(CrudService crud, DomainService domainService) {
        super(crud);
        this.domainService = domainService;
    }

    @Override
    protected String resource() {
        return "test-cases";
    }

    /**
     * 标记用例执行结果。
     * 请求体：{ "result": "通过" | "失败" | "阻塞" | "未执行" }
     */
    @PostMapping("/{id}/result")
    public R<TestCase> recordResult(@PathVariable String id, @RequestBody Map<String, String> body) {
        String result = body == null ? null : body.get("result");
        return R.ok("结果已记录", domainService.recordCaseResult(id, result));
    }
}
