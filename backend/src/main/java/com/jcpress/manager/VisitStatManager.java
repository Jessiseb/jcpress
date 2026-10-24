package com.jcpress.manager;

import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.util.HashUtils;
import com.jcpress.repository.ArticleViewStatMapper;
import com.jcpress.repository.VisitStatMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 站点访问统计：Redis 日内累计 + 定时快照回写（第四期，design D-B/D-C）。
 *
 * **与 {@link ArticleViewManager} 的差别不是风格问题**：
 * · 这里回写的是「当天总量」，所以覆盖写（`ON DUPLICATE KEY UPDATE pv = VALUES(pv)`），
 *   跑 10 次和跑 1 次结果一样；
 * · 那边回写的是 `view_count = view_count + delta` 这种增量，必须 `RENAME` 把待回写键搬走，
 *   否则重复回写会加两遍。
 * 两种写法并存，因为语义不同。
 *
 * 已知边界：单实例假说（多实例部署时同一份累计会被各实例各写一次，需要换成按实例分键）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VisitStatManager {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final StringRedisTemplate redis;
    private final VisitStatMapper visitStatMapper;
    private final ArticleViewStatMapper articleViewStatMapper;

    /** 记一次页面访问。同一指纹同一天只记 1 个 UV，但 PV 每次都算。 */
    public void saveVisit(String path, String clientIp, String userAgent) {
        String day = LocalDate.now().format(DAY);
        String statKey = RedisKeyConstant.STAT_DAY.formatted(day);
        String uvKey = RedisKeyConstant.STAT_UV.formatted(day);

        Long added = redis.opsForSet().add(uvKey, HashUtils.fingerprint(clientIp, userAgent));
        redis.expire(uvKey, Duration.ofDays(RedisKeyConstant.STAT_TTL_DAYS));

        redis.opsForHash().increment(statKey, RedisKeyConstant.STAT_FIELD_PV, 1L);
        if (added != null && added > 0) {
            redis.opsForHash().increment(statKey, RedisKeyConstant.STAT_FIELD_UV, 1L);
        }
        redis.opsForHash().increment(statKey, RedisKeyConstant.STAT_PATH_PREFIX + path, 1L);
        // 小时维度：只累加 PV（「几点有人来」看的是次数，不是人数 —— 见 V4 迁移注释）
        int hour = LocalTime.now().getHour();
        redis.opsForHash().increment(statKey, RedisKeyConstant.STAT_HOUR_PREFIX + hour, 1L);
        redis.expire(statKey, Duration.ofDays(RedisKeyConstant.STAT_TTL_DAYS));
    }

    /**
     * 记一次文章阅读（由 {@link ArticleViewManager} 在去重命中时调用）。
     *
     * 只写当天的增量，真正落库统一在 {@link #flushDaily()} 里做 —— 文章日表与站点日表
     * 共用同一个回写任务，避免两个定时任务同时打 MySQL。
     */
    public void saveArticleView(Long articleId) {
        String day = LocalDate.now().format(DAY);
        String statKey = RedisKeyConstant.STAT_DAY.formatted(day);
        redis.opsForHash().increment(statKey, RedisKeyConstant.STAT_ARTICLE_PREFIX + articleId, 1L);
        redis.expire(statKey, Duration.ofDays(RedisKeyConstant.STAT_TTL_DAYS));
    }

    /**
     * 每 5 分钟把累计值刷回 DB（启动后 1.5 分钟先来一次）。
     *
     * 扫 `stat:day:*` 而不是只刷「今天」：定时任务可能停了几个小时，或者跨零点那次没跑到，
     * 昨天的键还在（TTL 7 天），扫到就补齐。键过期是唯一的「不再回写」条件。
     */
    @Scheduled(fixedDelay = 300_000L, initialDelay = 90_000L)
    public void flushDaily() {
        List<String> keys = scanStatKeys();
        if (keys.isEmpty()) {
            return;
        }
        int flushed = 0;
        for (String key : keys) {
            try {
                if (flushOne(key)) {
                    flushed++;
                }
            } catch (Exception e) {
                // 单天失败不影响其余天；键还在，下一轮会重试（覆盖写天然可重试）
                log.error("站点统计回写失败 key={}", key, e);
            }
        }
        log.info("站点统计回写完成：待回写 {} 天，成功 {} 天", keys.size(), flushed);
    }

    private boolean flushOne(String key) {
        Map<Object, Object> entries = redis.opsForHash().entries(key);
        if (entries.isEmpty()) {
            return false;
        }
        LocalDate day = LocalDate.parse(key.substring(key.lastIndexOf(':') + 1), DAY);

        visitStatMapper.saveDaily(day,
                readInt(entries.get(RedisKeyConstant.STAT_FIELD_PV)),
                readInt(entries.get(RedisKeyConstant.STAT_FIELD_UV)));

        for (Map.Entry<Object, Object> entry : entries.entrySet()) {
            String field = String.valueOf(entry.getKey());
            int value = readInt(entry.getValue());
            if (field.startsWith(RedisKeyConstant.STAT_HOUR_PREFIX)) {
                visitStatMapper.saveHour(day,
                        Integer.parseInt(field.substring(RedisKeyConstant.STAT_HOUR_PREFIX.length())),
                        value);
            } else if (field.startsWith(RedisKeyConstant.STAT_PATH_PREFIX)) {
                visitStatMapper.savePath(day,
                        field.substring(RedisKeyConstant.STAT_PATH_PREFIX.length()), value);
            } else if (field.startsWith(RedisKeyConstant.STAT_ARTICLE_PREFIX)) {
                articleViewStatMapper.saveArticleDay(
                        Long.valueOf(field.substring(RedisKeyConstant.STAT_ARTICLE_PREFIX.length())),
                        day, value);
            }
        }
        return true;
    }

    private int readInt(Object raw) {
        if (raw == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (NumberFormatException e) {
            // 值被外部改坏了：记一条就走，不要让一个畸形字段挡住整天的回写
            log.warn("统计字段不是数字：{}", raw);
            return 0;
        }
    }

    private List<String> scanStatKeys() {
        List<String> keys = new ArrayList<>();
        ScanOptions options = ScanOptions.scanOptions()
                .match(RedisKeyConstant.STAT_DAY_PATTERN)
                .count(200)
                .build();
        try (Cursor<String> cursor = redis.scan(options)) {
            cursor.forEachRemaining(keys::add);
        }
        return keys;
    }
}
