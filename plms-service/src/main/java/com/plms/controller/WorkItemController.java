package com.plms.controller;

import com.plms.common.R;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 工作项接口。
 * 除标准 CRUD 外，提供看板专用的状态流转端点与父子（子项）结构端点。
 */
@RestController
@RequestMapping("/api/work-items")
public class WorkItemController extends BaseCrudController {

    private final DomainService domainService;

    public WorkItemController(CrudService crud, DomainService domainService) {
        super(crud);
        this.domainService = domainService;
    }

    @Override
    protected String resource() {
        return "work-items";
    }

    /**
     * 看板拖拽：变更状态并联动重算项目进度。
     * 请求体：{ "status": "已完成" }
     */
    @PatchMapping("/{id}/status")
    public R<Map<String, Object>> changeStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        String status = body == null ? null : body.get("status");
        return R.ok("状态已更新", domainService.changeWorkItemStatus(id, status));
    }

    /**
     * 查询当前可流转到的状态，供前端高亮可投放的看板列。
     */
    @GetMapping("/{id}/transitions")
    public R<Map<String, Object>> transitions(@PathVariable String id) {
        return R.ok(domainService.workItemTransitions(id));
    }

    /**
     * 工作项评论（复用通用评论）。
     * 请求体：{ "content": "..." }
     */
    @PostMapping("/{id}/comments")
    public R<com.plms.entity.Comment> addComment(@PathVariable String id,
                                                 @RequestBody Map<String, String> body) {
        String content = body == null ? null : body.get("content");
        return R.ok("评论已发表", domainService.addComment("work-item", id, content));
    }

    /** 工作项的全部评论 */
    @GetMapping("/{id}/comments")
    public R<?> listComments(@PathVariable String id) {
        return R.ok(domainService.listComments("work-item", id));
    }

    /* ==================== 父子结构（子项） ==================== */

    /**
     * 项目工作项树：顶层工作项 + 子项 + 每个工作项的子项汇总。
     * 看板与列表用它一次拿到完整层级。
     */
    @GetMapping("/tree")
    public R<Map<String, Object>> projectTree(@RequestParam String projectId) {
        return R.ok(domainService.projectTree(projectId));
    }

    /** 某工作项的子项列表 + 汇总 */
    @GetMapping("/{id}/children")
    public R<Map<String, Object>> children(@PathVariable String id) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("parentId", id);
        data.put("children", domainService.childrenOf(id));
        data.put("summary", domainService.subtaskSummary(id));
        return R.ok(data);
    }

    /** 某工作项的子树：自身 + 子项 + 父项 + 兄弟项 */
    @GetMapping("/{id}/tree")
    public R<Map<String, Object>> tree(@PathVariable String id) {
        return R.ok(domainService.workItemTree(id));
    }

    /** 子项汇总（总数 / 已完成 / 进度 / 故事点） */
    @GetMapping("/{id}/subtask-summary")
    public R<Map<String, Object>> subtaskSummary(@PathVariable String id) {
        return R.ok(domainService.subtaskSummary(id));
    }
}
