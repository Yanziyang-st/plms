package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 通用评论，可挂在任意实体上（工作项 / 需求 / 用例 / 话题）。
 */
@Data
@TableName("plm_comment")
public class Comment {

    @TableId(type = IdType.INPUT)
    private String id;

    /** work-item / requirement / test-case / topic */
    private String targetType;

    private String targetId;

    private String author;

    private String content;

    private LocalDateTime createdAt;
}
