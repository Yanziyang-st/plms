package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_requirement")
public class Requirement {

    @TableId(type = IdType.INPUT)
    private String id;

    private String productId;

    /** 业务编号，如 OA-REQ-001（服务端生成） */
    private String code;

    private String title;

    /** 需求 / 工单 */
    private String type;

    private String priority;

    private String status;

    private String assignee;

    private Integer points;

    private String source;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
