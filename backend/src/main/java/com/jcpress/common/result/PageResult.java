package com.jcpress.common.result;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 分页响应体：{@code { list, page, size, total, pages }}（规划 §9.1）。
 */
@Data
public class PageResult<T> implements Serializable {

    private List<T> list;
    private long page;
    private long size;
    private long total;
    private long pages;

    public static <T> PageResult<T> of(List<T> list, long page, long size, long total) {
        PageResult<T> result = new PageResult<>();
        result.list = list;
        result.page = page;
        result.size = size;
        result.total = total;
        result.pages = size <= 0 ? 0 : (total + size - 1) / size;
        return result;
    }
}
