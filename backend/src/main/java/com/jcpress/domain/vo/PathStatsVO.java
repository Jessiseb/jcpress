package com.jcpress.domain.vo;

import lombok.Data;

/** 热门页面的一条 */
@Data
public class PathStatsVO {

    private String path;
    private Integer pv;
}
