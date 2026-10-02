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
import java.util.Map;

@Data
@TableName(value = "plm_test_plan", autoResultMap = true)
public class TestPlan {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    private String libraryId;

    private String projectId;

    private String owner;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    /** 计划包含的用例 ID 列表 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> caseIds;

    /** 执行结果：caseId -> 通过/失败/阻塞/未执行 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, String> results;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
