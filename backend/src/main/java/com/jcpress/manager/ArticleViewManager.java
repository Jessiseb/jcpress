package com.jcpress.manager;

import com.jcpress.common.constant.RedisKeyConstant;
import com.jcpress.common.util.HashUtils;
import com.jcpress.repository.ArticleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 浏览量：Redis 累加 + 定时回写（规划 §7）。
 *
 * 去重口径：同一访客（ip + ua 指纹）对同一篇文章、在同一自然日内只计一次 ——
 * 靠 {@code SADD} 的返回值判断"是否新成员"，天然幂等。
 *
 * ⚠️ **两条 Redis 5.0 兼容约束**（本机是 5.0.14，见 docs/decisions.md 环境表）：
 * 1. **不能用 `GETDEL`**（Redis 6.2+）。刷新时用 `RENAME` 把待回写键挪到临时名再读删 ——
 *    `RENAME` 自 Redis 1.0 起就有，且是原子的。
 * 2. 扫描待回写键用 **`SCAN`**，不能用 `KEYS`（`KEYS` 会阻塞单线程的 Redis）。
 *
 * 已知边界：单实例下"先 hasKey 再 rename"的窗口可以接受；多实例部署时应换成 Lua
 * （已记入 openspec design 的 Open Questions）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ArticleViewManager {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final StringRedisTemplate redis;
    private final ArticleMapper articleMapper;

    /** 幂等计数：同指纹同一天只加一次 */
    public void saveView(Long articleId, String clientIp, String userAgent) {
        String dedupeKey = RedisKeyConstant.VIEW_DEDUPE
                .formatted(articleId, LocalDate.now().format(DAY));
        Long added = redis.opsForSet().add(dedupeKey, HashUtils.fingerprint(clientIp, userAgent));
        redis.expire(dedupeKey, Duration.ofDays(RedisKeyConstant.VIEW_DEDUPE_TTL_DAYS));
        if (added != null && added > 0) {
            redis.opsForValue().increment(RedisKeyConstant.VIEW_PENDING.formatted(articleId));
        }
    }

    /** 每 5 分钟把增量刷回 DB（启动后 1 分钟先来一次，便于本地验证） */
    @Scheduled(fixedDelay = 300_000L, initialDelay = 60_000L)
    public void flushViewCount() {
        List<String> keys = scanPendingKeys();
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
                // 单条失败不能影响其余的键；记录现场后继续
                log.error("浏览量回写失败 key={}", key, e);
            }
        }
        log.info("浏览量回写完成：待回写 {} 个键，实际落库 {} 篇", keys.size(), flushed);
    }

    private boolean flushOne(String key) {
        // RENAME 在源键不存在时会抛错，先判存在
        if (Boolean.FALSE.equals(redis.hasKey(key))) {
            return false;
        }
        String tempKey = key + RedisKeyConstant.VIEW_PENDING_FLUSHING_SUFFIX;
        redis.rename(key, tempKey);
        String value = redis.opsForValue().get(tempKey);
        redis.delete(tempKey);
        if (value == null) {
            return false;
        }
        long delta = Long.parseLong(value);
        if (delta <= 0) {
            return false;
        }
        Long articleId = Long.valueOf(key.substring(key.lastIndexOf(':') + 1));
        articleMapper.updateViewCountIncrement(articleId, delta);
        return true;
    }

    private List<String> scanPendingKeys() {
        List<String> keys = new ArrayList<>();
        ScanOptions options = ScanOptions.scanOptions()
                .match(RedisKeyConstant.VIEW_PENDING_PATTERN)
                .count(200)
                .build();
        try (Cursor<String> cursor = redis.scan(options)) {
            cursor.forEachRemaining(keys::add);
        }
        return keys;
    }
}
