package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_wiki_page")
public class WikiPage {

    @TableId(type = IdType.INPUT)
    private String id;

    private String spaceId;

    /** 父页面 ID，null 表示顶层 */
    private String parentId;

    private String title;

    /** Markdown 正文 */
    private String content;

    private String author;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
