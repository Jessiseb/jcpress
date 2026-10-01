package com.jcpress.common.exception;

import lombok.Getter;

/**
 * 业务异常：只携带业务码与**面向用户**的信息。
 *
 * 注意这里不保存原始异常堆栈以外的细节 —— Web 层统一转换时不会再向外吐堆栈（Agent.md）。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final int code;

    public BusinessException(ErrorCodeEnum errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCodeEnum errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }
}
