package com.jcpress.service;

import java.util.Map;

/**
 * 探活：给 /api/health 用，同时是分层骨架的第一个样例（Controller → Service 接口 → impl）。
 */
public interface HealthService {

    /** 返回 {@code {"db": "UP|DOWN", "redis": "UP|DOWN"}} —— 探活失败不抛异常，用 DOWN 表达 */
    Map<String, Object> check();
}
