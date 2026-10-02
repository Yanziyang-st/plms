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
@TableName(value = "plm_test_case", autoResultMap = true)
public class TestCase {

    @TableId(type = IdType.INPUT)
    private String id;

    private String libraryId;

    private String code;

    private String title;

    private String module;

    private String priority;

    /** 功能 / 接口 / 性能 / 兼容 */
    private String type;

    private String precondition;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> steps;

    private String expected;

    private String maintainer;

    /** 通过 / 失败 / 阻塞 / 未执行 */
    private String lastResult;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
