package com.plms.common;

/**
 * 业务错误码 → HTTP 状态码映射。
 */
public enum ErrorCode {

    OK(0, 200, "success"),
    BAD_REQUEST(40001, 400, "参数校验失败"),
    UNAUTHORIZED(40101, 401, "未认证或登录已过期"),
    BAD_CREDENTIALS(40102, 401, "账号或密码错误"),
    FORBIDDEN(40301, 403, "无操作权限"),
    NOT_FOUND(40401, 404, "资源不存在"),
    METHOD_NOT_ALLOWED(40501, 405, "请求方法不被支持"),
    CONFLICT(40901, 409, "数据冲突"),
    BUSINESS_RULE(42201, 422, "业务规则校验不通过"),
    SERVER_ERROR(50001, 500, "服务端异常");

    private final int code;
    private final int httpStatus;
    private final String defaultMessage;

    ErrorCode(int code, int httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public int getCode() { return code; }
    public int getHttpStatus() { return httpStatus; }
    public String getDefaultMessage() { return defaultMessage; }
}
