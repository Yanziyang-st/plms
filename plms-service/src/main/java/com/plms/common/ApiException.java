package com.plms.common;

import java.util.List;
import java.util.Map;

/**
 * 业务异常。由 GlobalExceptionHandler 统一转换为标准响应。
 */
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;
    private final List<Map<String, String>> errors;

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, null);
    }

    public ApiException(ErrorCode errorCode, String message, List<Map<String, String>> errors) {
        super(message == null ? errorCode.getDefaultMessage() : message);
        this.errorCode = errorCode;
        this.errors = errors;
    }

    public ErrorCode getErrorCode() { return errorCode; }
    public List<Map<String, String>> getErrors() { return errors; }

    public static ApiException badRequest(String message) { return new ApiException(ErrorCode.BAD_REQUEST, message); }
    public static ApiException badRequest(String message, List<Map<String, String>> errors) {
        return new ApiException(ErrorCode.BAD_REQUEST, message, errors);
    }
    public static ApiException unauthorized(String message) { return new ApiException(ErrorCode.UNAUTHORIZED, message); }
    public static ApiException forbidden(String message) { return new ApiException(ErrorCode.FORBIDDEN, message); }
    public static ApiException notFound(String message) { return new ApiException(ErrorCode.NOT_FOUND, message); }
    public static ApiException conflict(String message) { return new ApiException(ErrorCode.CONFLICT, message); }
    public static ApiException business(String message) { return new ApiException(ErrorCode.BUSINESS_RULE, message); }
}
