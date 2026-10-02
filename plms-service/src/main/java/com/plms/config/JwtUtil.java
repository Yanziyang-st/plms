package com.plms.config;

import com.plms.common.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * JWT 签发与解析（HS256）。
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final int expireHours;

    public JwtUtil(PlmsProperties props) {
        byte[] bytes = props.getJwt().getSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("plms.jwt.secret 长度不足 32 字节，无法用于 HS256 签名");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expireHours = props.getJwt().getExpireHours();
    }

    public String issue(String userId, String username, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expireHours * 3600L)))
                .signWith(key)
                .compact();
    }

    /** 解析并校验令牌，失败抛出 401 */
    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw ApiException.unauthorized("登录状态无效或已过期，请重新登录");
        }
    }

    public int getExpireHours() { return expireHours; }
}
