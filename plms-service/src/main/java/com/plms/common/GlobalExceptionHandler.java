package com.plms.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 全局异常处理：所有异常都被转换为统一响应信封 + 恰当的 HTTP 状态码。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 业务异常（校验失败 / 未认证 / 不存在 / 冲突 等） */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException ex, HttpServletRequest req) {
        log.warn("业务异常 [{} {}] code={} msg={}", req.getMethod(), req.getRequestURI(), ex.getErrorCode().getCode(), ex.getMessage());
        return build(ex.getErrorCode(), ex.getMessage(), ex.getErrors());
    }

    /** @Valid / @Validated 校验失败 */
    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<Map<String, Object>> handleValidation(BindException ex) {
        List<Map<String, String>> errors = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            Map<String, String> e = new LinkedHashMap<>();
            e.put("field", fe.getField());
            e.put("message", fe.getDefaultMessage());
            errors.add(e);
        }
        String msg = errors.isEmpty() ? "参数校验失败" : "参数校验失败：" + errors.get(0).get("message");
        return build(ErrorCode.BAD_REQUEST, msg, errors);
    }

    /** 请求体不是合法 JSON */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return build(ErrorCode.BAD_REQUEST, "请求体不是合法的 JSON 格式");
    }

    /** 缺少必填查询参数 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        return build(ErrorCode.BAD_REQUEST, "缺少必填参数：" + ex.getParameterName());
    }

    /** 方法不支持 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return build(ErrorCode.METHOD_NOT_ALLOWED, "该路径不支持 " + ex.getMethod() + " 方法");
    }

    /** 路径不存在 */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoHandler(NoHandlerFoundException ex) {
        return build(ErrorCode.NOT_FOUND, "接口不存在：" + ex.getRequestURL());
    }

    /** 兜底 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception ex, HttpServletRequest req) {
        log.error("未捕获异常 [{} {}]", req.getMethod(), req.getRequestURI(), ex);
        return build(ErrorCode.SERVER_ERROR, "服务端异常：" + ex.getClass().getSimpleName());
    }

    private ResponseEntity<Map<String, Object>> build(ErrorCode ec, String message) {
        return build(ec, message, null);
    }

    private ResponseEntity<Map<String, Object>> build(ErrorCode ec, String message, List<Map<String, String>> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", ec.getCode());
        body.put("message", message == null ? ec.getDefaultMessage() : message);
        body.put("data", null);
        if (errors != null && !errors.isEmpty()) {
            body.put("errors", errors);
        }
        return ResponseEntity.status(ec.getHttpStatus()).body(body);
    }
}
