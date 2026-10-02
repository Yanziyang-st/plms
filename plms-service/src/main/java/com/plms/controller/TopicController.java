package com.plms.controller;

import com.plms.common.R;
import com.plms.entity.Comment;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 协作话题接口。
 */
@RestController
@RequestMapping("/api/topics")
public class TopicController extends BaseCrudController {

    private final DomainService domainService;

    public TopicController(CrudService crud, DomainService domainService) {
        super(crud);
        this.domainService = domainService;
    }

    @Override
    protected String resource() {
        return "topics";
    }

    /**
     * 发表讨论。
     * 请求体：{ "content": "..." }
     */
    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public R<Comment> addComment(@PathVariable String id, @RequestBody Map<String, String> body) {
        String content = body == null ? null : body.get("content");
        return R.ok("讨论已发布", domainService.addComment("topic", id, content));
    }

    /** 话题下的全部讨论 */
    @GetMapping("/{id}/comments")
    public R<List<Comment>> listComments(@PathVariable String id) {
        return R.ok(domainService.listComments("topic", id));
    }
}
