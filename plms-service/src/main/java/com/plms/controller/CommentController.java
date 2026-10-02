package com.plms.controller;

import com.plms.common.R;
import com.plms.config.AuthContext;
import com.plms.entity.Comment;
import com.plms.entity.User;
import com.plms.mapper.UserMapper;
import com.plms.service.DomainService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 通用评论接口：可挂在工作项 / 需求 / 用例 / 话题上。
 */
@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final DomainService domainService;
    private final UserMapper userMapper;

    public CommentController(DomainService domainService, UserMapper userMapper) {
        this.domainService = domainService;
        this.userMapper = userMapper;
    }

    /** 按对象查询评论：?targetType=work-item&targetId=w1 */
    @GetMapping
    public R<List<Comment>> list(@RequestParam String targetType, @RequestParam String targetId) {
        return R.ok(domainService.listComments(targetType, targetId));
    }

    /**
     * 发表评论。请求体：{ "targetType": "work-item", "targetId": "w1", "content": "..." }
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public R<Comment> create(@RequestBody Map<String, String> body) {
        if (body == null) throw com.plms.common.ApiException.badRequest("请求体不能为空");
        return R.ok("评论已发表", domainService.addComment(
                body.get("targetType"), body.get("targetId"), body.get("content")));
    }

    /** 删除评论：仅作者本人或管理员 */
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        User me = userMapper.selectById(AuthContext.userId());
        domainService.deleteComment(id, me == null ? "" : me.getRole());
        return R.ok("评论已删除", null);
    }
}
