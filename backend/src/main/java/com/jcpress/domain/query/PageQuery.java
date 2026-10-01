package com.jcpress.domain.query;

import lombok.Data;

/**
 * 分页入参基类。
 *
 * {@code size} 必须在服务端限幅（规划 §11.5 安全规约第 4 条）：客户端传 5000 会直接把内存拉爆。
 */
@Data
public class PageQuery {

    public static final int MAX_SIZE = 50;
    public static final int DEFAULT_SIZE = 10;
    private static final int DEFAULT_PAGE = 1;

    private Integer page = DEFAULT_PAGE;
    private Integer size = DEFAULT_SIZE;

    public int normalizedPage() {
        return page == null || page < 1 ? DEFAULT_PAGE : page;
    }

    public int normalizedSize() {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    /** 交给 MyBatis-Plus 分页插件的 offset（从 0 开始） */
    public long offset() {
        return (long) (normalizedPage() - 1) * normalizedSize();
    }
}
