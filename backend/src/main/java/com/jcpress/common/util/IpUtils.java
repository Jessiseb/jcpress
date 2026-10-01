package com.jcpress.common.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 取客户端 IP。
 *
 * ⚠️ **只用于浏览量去重指纹，不得用于鉴权或限流判定** ——
 * {@code X-Forwarded-For} 由客户端提供、可以随意伪造；部署在 Nginx 后面时也只有在
 * 网关确保覆盖该头的前提下才可信。需要可信来源的限流场景要另想办法（例如只认
 * remoteAddr，或由网关注入并剥离外部同名头）。
 */
public final class IpUtils {

    private static final String UNKNOWN = "unknown";
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private IpUtils() {
    }

    public static String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader(FORWARDED_FOR);
        if (forwarded != null && !forwarded.isBlank() && !UNKNOWN.equalsIgnoreCase(forwarded)) {
            int comma = forwarded.indexOf(',');
            String first = comma > 0 ? forwarded.substring(0, comma) : forwarded;
            return first.trim();
        }
        String remote = request.getRemoteAddr();
        return remote == null ? UNKNOWN : remote;
    }
}
