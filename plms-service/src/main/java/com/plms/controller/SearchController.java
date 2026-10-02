package com.plms.controller;

import com.plms.common.R;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 全局搜索：跨需求 / 工作项 / 用例 / 文档 / 项目 / 产品 / 话题。
 */
@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final DomainService domainService;

    public SearchController(DomainService domainService) {
        this.domainService = domainService;
    }

    /**
     * @param q     关键字（必填）
     * @param types 逗号分隔的类型过滤：requirement, work-item, test-case, wiki-page, project, product, topic
     * @param limit 返回条数上限（默认 30，最大 100）
     */
    @GetMapping
    public R<Map<String, Object>> search(@RequestParam("q") String q,
                                         @RequestParam(value = "types", required = false) String types,
                                         @RequestParam(value = "limit", defaultValue = "30") int limit) {
        List<String> typeList = (types == null || types.isBlank())
                ? List.of()
                : Arrays.stream(types.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return R.ok(domainService.search(q, typeList, limit));
    }
}
