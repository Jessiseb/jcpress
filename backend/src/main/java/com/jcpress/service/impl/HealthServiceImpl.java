package com.jcpress.service.impl;

import com.jcpress.service.HealthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class HealthServiceImpl implements HealthService {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @Override
    public Map<String, Object> check() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("db", probeDb());
        status.put("redis", probeRedis());
        return status;
    }

    /**
     * 探活本身失败不是业务异常 —— 用 DOWN 表达，并且**记日志**（不能吞掉原因，
     * 否则线上只看到一个 DOWN 而无从查起）。
     */
    private String probeDb() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return "UP";
        } catch (Exception e) {
            log.error("数据库探活失败", e);
            return "DOWN";
        }
    }

    private String probeRedis() {
        try {
            redisTemplate.opsForValue().set("health:probe", "1");
            return "UP";
        } catch (Exception e) {
            log.error("Redis 探活失败", e);
            return "DOWN";
        }
    }
}
