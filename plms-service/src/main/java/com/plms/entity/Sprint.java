package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("plm_sprint")
public class Sprint {

    @TableId(type = IdType.INPUT)
    private String id;

    private String projectId;

    private String name;

    private String goal;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
