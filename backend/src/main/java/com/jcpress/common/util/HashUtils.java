package com.jcpress.common.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 访客指纹：ip + user-agent 的 SHA-256 前 16 位十六进制。
 *
 * 为什么不直接存 IP：去重只需要"同一个人"，不需要知道是谁；存指纹顺带把原始 IP
 * 从 Redis 里消掉（只留一个不可逆的短串）。
 */
public final class HashUtils {

    private static final int FINGERPRINT_BYTES = 8;

    private HashUtils() {
    }

    public static String fingerprint(String clientIp, String userAgent) {
        String raw = (clientIp == null ? "" : clientIp) + "|" + (userAgent == null ? "" : userAgent);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, FINGERPRINT_BYTES);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 必备算法，走到这里说明运行环境本身坏了 —— 抛出去而不是吞掉
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
