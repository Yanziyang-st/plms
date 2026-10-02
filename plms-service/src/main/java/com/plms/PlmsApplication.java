package com.plms;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * PLMS 软件生命周期管理系统 · 后端服务入口
 */
@SpringBootApplication
@MapperScan("com.plms.mapper")
@ConfigurationPropertiesScan("com.plms.config")
@EnableTransactionManagement
public class PlmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlmsApplication.class, args);
    }
}
