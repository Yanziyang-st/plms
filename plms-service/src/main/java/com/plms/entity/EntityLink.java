package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 实体关联。支撑「需求 → 工作项 → 测试用例」的全链路追溯。
 */
@Data
@TableName("plm_link")
public class EntityLink {

    @TableId(type = IdType.INPUT)
    private String id;

    /** requirement / work-item / test-case */
    private String sourceType;

    private String sourceId;

    private String targetType;

    private String targetId;

    /** implements（实现） / verifies（验证） / relates（相关） */
    private String linkType;

    private LocalDateTime createdAt;
}
