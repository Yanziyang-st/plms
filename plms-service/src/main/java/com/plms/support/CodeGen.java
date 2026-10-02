package com.plms.support;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.ThreadLocalRandom;

/**
 * ID / 业务编号生成器。
 * ID 采用“前缀 + 时间戳36进制 + 序号 + 随机串”，与前端演示数据风格保持一致且全局唯一。
 */
@Component
public class CodeGen {

    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private final AtomicLong seq = new AtomicLong(0);

    /** 生成实体主键，如 {@code req_k9x2a1b7c} */
    public String id(String prefix) {
        String ts = Long.toString(System.currentTimeMillis(), 36);
        String n = Long.toString(seq.getAndIncrement(), 36);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            sb.append(ALPHABET.charAt(ThreadLocalRandom.current().nextInt(ALPHABET.length())));
        }
        return prefix + "_" + ts + n + sb;
    }

    /**
     * 生成业务编号：{@code <前缀>-<类型段>-<3位序号>}，如 {@code OA-REQ-013}。
     */
    public String bizCode(String prefix, String segment, long nextNumber) {
        return String.format("%s-%s-%03d", prefix, segment, nextNumber);
    }

    public LocalDateTime now() { return LocalDateTime.now(); }

    public LocalDate today() { return LocalDate.now(); }
}
