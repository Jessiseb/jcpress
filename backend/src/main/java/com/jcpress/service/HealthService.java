package com.jcpress.service;

import java.util.Map;

/**
 * 探活：给 /api/health 用，同时是分层骨架的第一个样例（Controller → Service 接口 → impl）。
 *
 * 方法名是 {@code getHealth()} 而不是更顺口的 {@code check()} —— 命名卡口要求
 * service/repository 层的公开方法以 get/list/count/save/insert/remove/delete/update 开头
 * （Agent.md）。卡口是判据，不是建议，所以改的是代码不是规则。
 */
public interface HealthService {

    /** 返回 {@code {"db": "UP|DOWN", "redis": "UP|DOWN"}} —— 探活失败不抛异常，用 DOWN 表达 */
    Map<String, Object> getHealth();
}
