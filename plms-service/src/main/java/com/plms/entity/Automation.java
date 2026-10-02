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
@TableName(value = "plm_automation", autoResultMap = true)
public class Automation {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private Boolean enabled;

    /** 触发时机（SQL 中 trigger 为保留字，故命名 trigger_event） */
    private String triggerEvent;

    private String scope;

    /** 触发条件（SQL 中 condition 为保留字，故命名 condition_expr） */
    private String conditionExpr;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> actions;

    private Integer runs;

    private LocalDateTime lastRun;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
