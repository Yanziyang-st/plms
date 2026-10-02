package com.plms.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 幂等结构迁移器。
 * <p>MySQL 不支持 {@code ADD COLUMN IF NOT EXISTS}，而 {@code CREATE TABLE IF NOT EXISTS}
 * 也无法为已存在的表补列，因此这里基于 information_schema 做条件迁移，保证老库升级不报错。</p>
 * <p>{@code @Order(0)} 保证在 {@link com.plms.service.DataSeeder} 之前执行。</p>
 */
@Component
@Order(0)
public class SchemaMigrator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrator.class);

    private final JdbcTemplate jdbc;

    public SchemaMigrator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        addColumnIfMissing("plm_user", "enabled",
                "TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用'");
        // 工作项父子结构（子任务）
        addColumnIfMissing("plm_work_item", "parent_id",
                "VARCHAR(32) NULL COMMENT '父工作项；为空表示顶层工作项'");
        addIndexIfMissing("plm_work_item", "idx_work_item_parent", "parent_id");
        // 话题评论已统一到 plm_comment（target_type='topic'），清理历史表
        dropTableIfExists("plm_topic_comment");
    }

    private void addIndexIfMissing(String table, String index, String column) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.STATISTICS " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
                Integer.class, table, index);
        if (n != null && n == 0) {
            jdbc.execute("ALTER TABLE " + table + " ADD INDEX " + index + " (" + column + ")");
            log.info("结构迁移：{}.{} 索引已补充", table, index);
        }
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class, table, column);
        if (n != null && n == 0) {
            jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
            log.info("结构迁移：{}.{} 已补充", table, column);
        }
    }

    private void dropTableIfExists(String table) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                Integer.class, table);
        if (n != null && n > 0) {
            jdbc.execute("DROP TABLE " + table);
            log.info("结构迁移：历史表 {} 已移除（评论已统一至 plm_comment）", table);
        }
    }
}
