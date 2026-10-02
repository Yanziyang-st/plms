package com.plms.controller;

import com.plms.common.ApiException;
import com.plms.common.R;
import com.plms.entity.EntityLink;
import com.plms.service.DomainService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 实体关联接口：支撑「需求 → 工作项 → 测试用例」的显式追溯关系。
 */
@RestController
@RequestMapping("/api/links")
public class LinkController {

    private final DomainService domainService;

    public LinkController(DomainService domainService) {
        this.domainService = domainService;
    }

    /** 查询某实体的全部关联（双向）：?entityType=requirement&entityId=r1 */
    @GetMapping
    public R<Map<String, Object>> list(@RequestParam String entityType, @RequestParam String entityId) {
        return R.ok(domainService.linksOf(entityType, entityId));
    }

    /**
     * 建立关联。请求体：{ "sourceType":"requirement", "sourceId":"r1",
     *                     "targetType":"work-item", "targetId":"w1", "linkType":"implements" }
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public R<EntityLink> create(@RequestBody Map<String, String> body) {
        if (body == null) throw ApiException.badRequest("请求体不能为空");
        EntityLink link = domainService.createLink(
                body.get("sourceType"), body.get("sourceId"),
                body.get("targetType"), body.get("targetId"), body.get("linkType"));
        return R.ok("关联已建立", link);
    }

    /** 解除关联 */
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        domainService.deleteLink(id);
        return R.ok("关联已解除", null);
    }
}
