package com.jcpress.common.exception;

import com.jcpress.common.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * 全局异常处理：分层异常的最后一环（Agent.md / 规划 §11.4）。
 *
 * 三条纪律：
 * 1. **HTTP 状态码与业务码同时正确**（不是一律 200）；
 * 2. 不向前端吐原始堆栈 —— 未预期异常只回脱敏文案，现场留在日志里（带 uri 与 method）；
 * 3. 不吞异常 —— 每条分支都落日志。
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException e) {
        ErrorCodeEnum errorCode = ErrorCodeEnum.of(e.getCode());
        log.warn("业务异常 code={} message={}", e.getCode(), e.getMessage());
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(Result.error(errorCode, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(this::describeFieldError)
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败 {}", detail);
        return ResponseEntity.status(ErrorCodeEnum.PARAM_ERROR.getHttpStatus())
                .body(Result.error(ErrorCodeEnum.PARAM_ERROR, detail));
    }

    /** 兜底：日志留现场，前端只拿到脱敏文案 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleUnexpected(Exception e, HttpServletRequest request) {
        log.error("未预期异常 uri={} method={}", request.getRequestURI(), request.getMethod(), e);
        return ResponseEntity.status(ErrorCodeEnum.SYSTEM_ERROR.getHttpStatus())
                .body(Result.error(ErrorCodeEnum.SYSTEM_ERROR));
    }

    private String describeFieldError(FieldError fieldError) {
        return fieldError.getField() + ": " + fieldError.getDefaultMessage();
    }
}
