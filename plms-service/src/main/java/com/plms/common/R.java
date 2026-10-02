package com.plms.common;

/**
 * 统一响应信封。
 * <pre>
 * { "code": 0, "message": "success", "data": {...} }
 * </pre>
 * code = 0 表示成功；非 0 为业务错误码，同时 HTTP 状态码也有对应语义。
 */
public class R<T> {

    private int code;
    private String message;
    private T data;

    public R() {}

    public R(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> R<T> ok(T data) {
        return new R<>(ErrorCode.OK.getCode(), "success", data);
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> ok(String message, T data) {
        return new R<>(ErrorCode.OK.getCode(), message, data);
    }

    public static <T> R<T> fail(ErrorCode ec, String message) {
        return new R<>(ec.getCode(), message, null);
    }

    public static <T> R<T> fail(int code, String message) {
        return new R<>(code, message, null);
    }

    public int getCode() { return code; }
    public void setCode(int code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
}
