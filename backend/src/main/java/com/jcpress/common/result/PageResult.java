package com.jcpress.common.result;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 分页响应体：{@code { list, page, size, total, pages }}（规划 §9.1）。
 *
 * ⚠️ 计数字段用 **`int` 而不是 `long`**：Gson 那边对 `Long` 注册了"转字符串"的适配器
 * （为了 ID 防 JS 精度丢失），实测**基本类型 `long` 也会被它一起字符串化** ——
 * 于是 `total` 会变成 `"3"`，与接口文档和前端 `number` 类型都不符，而且是静默的。
 *
 * 所以本项目定一条能落地的规则：**`Long` 一律是 ID、一律字符串；计数与度量用 `int`（或 `Integer`）**。
 * 本站内容量级远小于 21 亿，`int` 足够。
 */
@Data
public class PageResult<T> implements Serializable {

    private List<T> list;
    private int page;
    private int size;
    private int total;
    private int pages;

    public static <T> PageResult<T> of(List<T> list, long page, long size, long total) {
        PageResult<T> result = new PageResult<>();
        result.list = list;
        result.page = (int) page;
        result.size = (int) size;
        result.total = (int) total;
        result.pages = size <= 0 ? 0 : (int) ((total + size - 1) / size);
        return result;
    }
}
