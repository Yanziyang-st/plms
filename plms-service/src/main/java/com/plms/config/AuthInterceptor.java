package com.plms.config;

import com.plms.common.ApiException;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 鉴权拦截器：校验 Authorization 头中的 JWT，并把用户 ID 写入 {@link AuthContext}。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final PlmsProperties props;

    public AuthInterceptor(JwtUtil jwtUtil, PlmsProperties props) {
        this.jwtUtil = jwtUtil;
        this.props = props;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        String header = request.getHeader(props.getJwt().getHeader());
        if (header == null || header.isBlank()) {
            throw ApiException.unauthorized("缺少认证信息，请先登录");
        }
        String prefix = props.getJwt().getPrefix();
        String token = header.startsWith(prefix) ? header.substring(prefix.length()).trim() : header.trim();
        if (token.isEmpty()) throw ApiException.unauthorized("认证令牌为空，请先登录");

        Claims claims = jwtUtil.parse(token);
        AuthContext.set(claims.getSubject());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        AuthContext.clear();
    }
}
