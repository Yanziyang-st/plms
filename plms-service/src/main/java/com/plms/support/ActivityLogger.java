package com.plms.support;

import com.plms.entity.Activity;
import com.plms.mapper.ActivityMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 活动日志记录器：所有写操作都会留痕，供工作台的“团队动态”展示。
 */
@Component
public class ActivityLogger {

    private static final int MAX_KEEP = 80;

    private final ActivityMapper activityMapper;
    private final CodeGen codeGen;

    public ActivityLogger(ActivityMapper activityMapper, CodeGen codeGen) {
        this.activityMapper = activityMapper;
        this.codeGen = codeGen;
    }

    public void log(String userId, String action, String target) {
        Activity a = new Activity();
        a.setId(codeGen.id("ac"));
        a.setUserId(userId == null ? "u1" : userId);
        a.setAction(action);
        a.setTarget(target == null ? "" : trim(target, 200));
        a.setOccurredAt(LocalDateTime.now());
        a.setCreatedAt(LocalDateTime.now());
        activityMapper.insert(a);
    }

    private String trim(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
