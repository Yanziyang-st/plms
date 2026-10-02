package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "plm_project", autoResultMap = true)
public class Project {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private String identifier;

    /** Scrum / Kanban / 瀑布 */
    private String type;

    private String status;

    private String owner;

    private String productId;

    private LocalDate startDate;

    private LocalDate endDate;

    private Integer progress;

    private String color;

    private String description;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> members;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
