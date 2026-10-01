package com.jcpress.infrastructure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 每请求生成 8 位 traceId，写进 MDC 与响应头 {@code X-Trace-Id}。
 *
 * 作用：前端拿到的错误响应里有 traceId，可以直接和日志对上 —— 这是"最外层必须把异常
 * 转成用户能理解的内容"（Agent.md）之后的另一半：还让人查得到现场。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String TRACE_ID = "traceId";
    public static final String HEADER = "X-Trace-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put(TRACE_ID, traceId);
        response.setHeader(HEADER, traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            // 必须清：线程池复用线程时残留的 MDC 会把 traceId 串到别的请求上
            MDC.remove(TRACE_ID);
        }
    }
}
