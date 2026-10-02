package com.plms.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("plm_user")
public class User {

    @TableId(type = IdType.INPUT)
    private String id;

    private String name;

    /** 登录账号（唯一） */
    private String username;

    /** 密码（BCrypt 摘要），永不出现在响应中 */
    @JsonIgnore
    private String password;

    private String role;

    private String dept;

    private String email;

    /** 头像底色 */
    private String color;

    /** 是否启用：停用后禁止登录 */
    private Boolean enabled;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
