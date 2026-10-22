package com.jcpress.domain.projection;

import lombok.Data;

import java.time.LocalDate;

/** 一天的总览计数（站点访问或某篇文章的日行，形状相同） */
@Data
public class DailyPvUvRef {

    private LocalDate statDate;
    private Integer pv;
    private Integer uv;
}
