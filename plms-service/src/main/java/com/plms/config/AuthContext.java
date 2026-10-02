package com.plms.config;

/**
 * 当前登录用户上下文（由 AuthInterceptor 写入，请求结束后清理）。
 */
public final class AuthContext {

    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();

    private AuthContext() {}

    public static void set(String userId) { USER_ID.set(userId); }

    public static String userId() {
        String id = USER_ID.get();
        return id == null ? "u1" : id;   // 兜底，理论上拦截器已保证非空
    }

    public static void clear() { USER_ID.remove(); }
}
