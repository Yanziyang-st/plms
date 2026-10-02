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
@TableName(value = "plm_agent", autoResultMap = true)
public class Agent {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private String emoji;

    private String color;

    /** 需求 / 设计 / 开发 / 测试 / 管理 / 协作 */
    private String role;

    private String description;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> skills;

    private LocalDateTime createdAt;
}
