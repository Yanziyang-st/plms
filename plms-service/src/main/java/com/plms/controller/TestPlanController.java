package com.plms.controller;

import com.plms.common.R;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 测试计划接口。
 */
@RestController
@RequestMapping("/api/test-plans")
public class TestPlanController extends BaseCrudController {

    private final DomainService domainService;

    public TestPlanController(CrudService crud, DomainService domainService) {
        super(crud);
        this.domainService = domainService;
    }

    @Override
    protected String resource() {
        return "test-plans";
    }

    /**
     * 执行计划中的一条用例；结果为「失败」时按自动化规则自动创建缺陷。
     * 请求体：{ "caseId": "tc1", "result": "失败" }
     */
    @PostMapping("/{id}/execute")
    public R<Map<String, Object>> execute(@PathVariable String id, @RequestBody Map<String, String> body) {
        String caseId = body == null ? null : body.get("caseId");
        String result = body == null ? null : body.get("result");
        return R.ok("执行结果已提交", domainService.executeTestPlan(id, caseId, result));
    }

    /**
     * 向计划追加用例（幂等：已存在的会被忽略，全部重复则报 422）。
     * 请求体：{ "caseIds": ["tc1","tc2"] }
     */
    @PostMapping("/{id}/cases")
    public R<com.plms.entity.TestPlan> addCases(@PathVariable String id,
                                                @RequestBody Map<String, java.util.List<String>> body) {
        return R.ok("用例已添加", domainService.addPlanCases(id, body == null ? null : body.get("caseIds")));
    }

    /** 从计划中移除某条用例（计划至少保留一条） */
    @DeleteMapping("/{id}/cases/{caseId}")
    public R<com.plms.entity.TestPlan> removeCase(@PathVariable String id, @PathVariable String caseId) {
        return R.ok("用例已移除", domainService.removePlanCase(id, caseId));
    }
}
