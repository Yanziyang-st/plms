package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_product")
public class Product {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    /** 产品标识符，如 OA / DATA */
    private String identifier;

    private String color;

    /** 产品描述（对应前端 desc 字段，SQL 中用 description 避免保留字冲突） */
    private String description;

    private String owner;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
