package com.jcpress.common.result;

import com.jcpress.common.exception.ErrorCodeEnum;
import lombok.Data;
import org.slf4j.MDC;

import java.io.Serializable;

/**
 * 统一响应体：{@code { code, message, data, traceId }}（规划 §9.1）。
 *
 * traceId 从 MDC 取（由 {@code TraceIdFilter} 每请求写入），使前端的报错信息能直接对上日志。
 */
@Data
public class Result<T> implements Serializable {

    private int code;
    private String message;
    private T data;
    private String traceId;

    private Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = MDC.get("traceId");
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(ErrorCodeEnum.SUCCESS.getCode(), ErrorCodeEnum.SUCCESS.getMessage(), data);
    }

    public static Result<Void> success() {
        return success(null);
    }

    public static <T> Result<T> error(ErrorCodeEnum errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    public static <T> Result<T> error(ErrorCodeEnum errorCode, String message) {
        return new Result<>(errorCode.getCode(), message, null);
    }
}
