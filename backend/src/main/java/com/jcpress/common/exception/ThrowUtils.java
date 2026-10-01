package com.jcpress.common.exception;

/**
 * 条件抛异常的工具：让 Service 里的前置校验不写成一层套一层的 if。
 */
public final class ThrowUtils {

    private ThrowUtils() {
    }

    public static void throwIf(boolean condition, ErrorCodeEnum errorCode) {
        if (condition) {
            throw new BusinessException(errorCode);
        }
    }

    public static void throwIf(boolean condition, ErrorCodeEnum errorCode, String message) {
        if (condition) {
            throw new BusinessException(errorCode, message);
        }
    }
}
