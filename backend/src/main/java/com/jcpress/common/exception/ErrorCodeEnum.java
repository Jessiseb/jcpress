package com.jcpress.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 业务错误码。
 *
 * 每个枚举**自带 HTTP 状态**：规划 §9.1 要求「HTTP 状态码与 code 同时正确」，
 * 而不是像官方模板那样一律返回 HTTP 200 再靠 code 区分。
 */
@Getter
public enum ErrorCodeEnum {

    SUCCESS(0, "ok", HttpStatus.OK),

    PARAM_ERROR(40001, "参数校验失败", HttpStatus.BAD_REQUEST),

    NOT_LOGIN(40101, "未登录", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID(40102, "token 过期或无效", HttpStatus.UNAUTHORIZED),
    LOGIN_FAIL_LOCKED(40103, "登录失败次数过多，请稍后再试", HttpStatus.UNAUTHORIZED),

    FORBIDDEN(40301, "禁止访问", HttpStatus.FORBIDDEN),

    ARTICLE_NOT_FOUND(40401, "文章不存在", HttpStatus.NOT_FOUND),

    SLUG_CONFLICT(40901, "slug 已存在", HttpStatus.CONFLICT),

    RATE_LIMITED(42901, "请求过于频繁", HttpStatus.TOO_MANY_REQUESTS),

    SYSTEM_ERROR(50000, "系统异常", HttpStatus.INTERNAL_SERVER_ERROR),
    OPERATION_ERROR(50001, "操作失败", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCodeEnum(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    /** 由业务码反查枚举；未知码归到 OPERATION_ERROR（不抛异常，避免异常处理本身再抛异常） */
    public static ErrorCodeEnum of(int code) {
        for (ErrorCodeEnum candidate : values()) {
            if (candidate.code == code) {
                return candidate;
            }
        }
        return OPERATION_ERROR;
    }
}
