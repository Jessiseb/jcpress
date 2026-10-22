package com.jcpress.domain.vo;

import lombok.Data;

import java.time.LocalDate;

/** 趋势图的一个点。日期由 Gson 的 LocalDate 适配器序列化成 {@code yyyy-MM-dd}。 */
@Data
public class VisitTrendVO {

    private LocalDate date;
    private Integer pv;
    private Integer uv;
}
