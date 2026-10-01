package com.jcpress.manager;

import com.jcpress.domain.dataobject.ArticleDO;
import com.jcpress.repository.ArticleMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 浏览量 Manager：三条断言覆盖「幂等去重 / 不同访客累加 / 刷新落库并清键」。
 *
 * 刷新那条走的是 RENAME + 读 + 删（不是 GETDEL）—— 所以在 Redis 5.0 上有意义。
 */
@SpringBootTest
@ActiveProfiles("test")
class ArticleViewManagerTest {

    private static final String SLUG = "view-manager-probe";

    @Autowired
    ArticleViewManager articleViewManager;

    @Autowired
    ArticleMapper articleMapper;

    @Autowired
    StringRedisTemplate redis;

    private Long articleId;

    @BeforeEach
    void setUp() {
        ArticleDO article = new ArticleDO();
        article.setType("TECH");
        article.setTitle("浏览量探针");
        article.setSlug(SLUG);
        article.setStatus(1);
        article.setWordCount(10);
        article.setReadingMinutes(1);
        article.setViewCount(0);
        article.setLikeCount(0);
        article.setTop(0);
        article.setPublishTime(LocalDateTime.now());
        articleMapper.insert(article);
        articleId = article.getId();
    }

    @AfterEach
    void tearDown() {
        articleMapper.deleteById(articleId);
        redis.delete("view:count:" + articleId);
        redis.delete("view:count:" + articleId + ":flushing");
        redis.delete(redis.keys("view:article:" + articleId + ":*"));
    }

    @Test
    void sameFingerprintCountsOnlyOncePerDay() {
        articleViewManager.saveView(articleId, "127.0.0.1", "JUnit");
        articleViewManager.saveView(articleId, "127.0.0.1", "JUnit");

        assertThat(redis.opsForValue().get("view:count:" + articleId)).isEqualTo("1");
    }

    @Test
    void differentFingerprintsAccumulate() {
        articleViewManager.saveView(articleId, "127.0.0.1", "A");
        articleViewManager.saveView(articleId, "127.0.0.2", "B");

        assertThat(redis.opsForValue().get("view:count:" + articleId)).isEqualTo("2");
    }

    @Test
    void flushWritesIncrementToDbAndClearsPendingKey() {
        articleViewManager.saveView(articleId, "127.0.0.3", "C");
        articleViewManager.saveView(articleId, "127.0.0.4", "D");

        articleViewManager.flushViewCount();

        assertThat(articleMapper.selectById(articleId).getViewCount()).isEqualTo(2);
        assertThat(redis.hasKey("view:count:" + articleId)).isFalse();
        assertThat(redis.hasKey("view:count:" + articleId + ":flushing")).isFalse();
    }
}
