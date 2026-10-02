package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_activity")
public class Activity {

    @TableId(type = IdType.INPUT)
    private String id;

    private String userId;

    private String action;

    private String target;

    /** 发生时间（SQL 中 time 语义易混，故命名 occurred_at） */
    private LocalDateTime occurredAt;

    private LocalDateTime createdAt;
}
