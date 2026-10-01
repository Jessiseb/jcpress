package com.jcpress.domain;

import com.jcpress.domain.query.PageQuery;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 分页入参的服务端限幅：size 必须封顶，否则一次请求就能把内存拉爆
 * （规划 §11.5 安全规约第 4 条）。
 */
class PageQueryTest {

    @Test
    void sizeIsClampedToServerMaximum() {
        PageQuery query = new PageQuery();
        query.setSize(5000);
        assertThat(query.normalizedSize()).isEqualTo(50);
    }

    @Test
    void pageAndSizeFallBackToDefaultsWhenIllegal() {
        PageQuery query = new PageQuery();
        query.setPage(0);
        query.setSize(-3);
        assertThat(query.normalizedPage()).isEqualTo(1);
        assertThat(query.normalizedSize()).isEqualTo(10);
    }

    @Test
    void offsetFollowsNormalizedValues() {
        PageQuery query = new PageQuery();
        query.setPage(3);
        query.setSize(20);
        assertThat(query.offset()).isEqualTo(40L);
    }
}
