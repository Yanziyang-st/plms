package com.plms.controller;

import com.plms.common.PageResult;
import com.plms.common.R;
import com.plms.service.CrudService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 通用 CRUD 控制器基类。
 * 各资源控制器只需覆写 {@link #resource()} 声明资源名即可获得 5 个标准接口。
 */
public abstract class BaseCrudController {

    protected final CrudService crud;

    protected BaseCrudController(CrudService crud) {
        this.crud = crud;
    }

    /** 资源名，如 products / work-items */
    protected abstract String resource();

    /** 列表：分页 + 条件筛选 + 关键字 + 排序 */
    @GetMapping
    public R<PageResult<Object>> list(@RequestParam Map<String, String> params) {
        return R.ok(crud.list(resource(), params));
    }

    /** 详情 */
    @GetMapping("/{id}")
    public R<Object> get(@PathVariable String id) {
        return R.ok(crud.get(resource(), id));
    }

    /** 新建 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public R<Object> create(@RequestBody Map<String, Object> body) {
        return R.ok("创建成功", crud.create(resource(), body));
    }

    /** 部分更新（PATCH 为主，同时兼容 PUT） */
    @PatchMapping("/{id}")
    public R<Object> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return R.ok("更新成功", crud.update(resource(), id, body));
    }

    @PutMapping("/{id}")
    public R<Object> put(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return R.ok("更新成功", crud.update(resource(), id, body));
    }

    /** 删除 */
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        crud.delete(resource(), id);
        return R.ok("删除成功", null);
    }

    /**
     * 批量删除。请求体：{ "ids": ["a","b"] }
     * 逐条校验约束，返回成功/失败明细；全部失败时返回 422。
     */
    @PostMapping("/batch-delete")
    public R<java.util.Map<String, Object>> batchDelete(@RequestBody java.util.Map<String, java.util.List<String>> body) {
        return R.ok("批量删除完成", crud.batchDelete(resource(), body == null ? null : body.get("ids")));
    }

    /**
     * 批量更新。请求体：{ "ids": ["a","b"], "patch": { "status": "已完成" } }
     * patch 中的字段同样走白名单校验。
     */
    @PostMapping("/batch-update")
    @SuppressWarnings("unchecked")
    public R<java.util.Map<String, Object>> batchUpdate(@RequestBody java.util.Map<String, Object> body) {
        if (body == null) throw com.plms.common.ApiException.badRequest("请求体不能为空");
        Object idsRaw = body.get("ids");
        Object patchRaw = body.get("patch");
        if (!(idsRaw instanceof java.util.List)) throw com.plms.common.ApiException.badRequest("ids 必须是数组");
        if (!(patchRaw instanceof java.util.Map)) throw com.plms.common.ApiException.badRequest("patch 必须是对象");
        return R.ok("批量更新完成",
                crud.batchUpdate(resource(), (java.util.List<String>) idsRaw, (java.util.Map<String, Object>) patchRaw));
    }
}
