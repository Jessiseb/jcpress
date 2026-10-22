package com.jcpress.domain.projection;

import lombok.Data;

/** 热门页面的行投影 */
@Data
public class PathStatRef {

    private String path;
    private Integer pv;
}
