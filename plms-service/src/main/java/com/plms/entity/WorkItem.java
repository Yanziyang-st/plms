package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("plm_work_item")
public class WorkItem {

    @TableId(type = IdType.INPUT)
    private String id;

    private String projectId;

    private String sprintId;

    /** 父工作项 ID；为空表示顶层工作项 */
    private String parentId;

    private String title;

    private String code;

    /** 任务 / 需求 / 缺陷 / 子任务 */
    private String type;

    private String priority;

    private String status;

    private String assignee;

    private Integer points;

    private LocalDate startDate;

    private LocalDate endDate;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
