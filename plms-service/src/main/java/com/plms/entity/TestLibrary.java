package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_test_library")
public class TestLibrary {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private String description;

    private String owner;

    private String productId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
