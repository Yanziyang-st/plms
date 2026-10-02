package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "plm_wiki_space", autoResultMap = true)
public class WikiSpace {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private String icon;

    private String color;

    private String description;

    private String owner;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> members;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
