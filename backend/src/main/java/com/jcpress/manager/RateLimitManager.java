package com.jcpress.manager;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 固定窗口计数（登录失败计数、接口限流）。
 *
 * 只用 Redis 5 就有的命令：`INCR` + `EXPIRE`。
 * 语义上它是"近似限流"——固定窗口在窗口边界会出现两倍突发，对本站（单人后台）够用；
 * 要更精确就换滑动窗口或令牌桶，那属于多实例部署时再考虑的事。
 */
@Component
@RequiredArgsConstructor
public class RateLimitManager {

    private final StringRedisTemplate redis;

    /** 记一次并判断是否超限：首次计数时设置 TTL，返回 true 表示本次允许 */
    public boolean tryAcquire(String key, int limit, Duration window) {
        Long current = redis.opsForValue().increment(key);
        if (current != null && current == 1L) {
            redis.expire(key, window);
        }
        return current != null && current <= limit;
    }

    /** 只累加并返回当前值（用于失败次数这种"先记账、再由调用方判阈值"的场景），首次设置 TTL */
    public long countUp(String key, Duration window) {
        Long current = redis.opsForValue().increment(key);
        if (current != null && current == 1L) {
            redis.expire(key, window);
        }
        return current == null ? 0L : current;
    }

    public long getCount(String key) {
        String value = redis.opsForValue().get(key);
        return value == null ? 0L : Long.parseLong(value);
    }

    public void reset(String key) {
        redis.delete(key);
    }
}
