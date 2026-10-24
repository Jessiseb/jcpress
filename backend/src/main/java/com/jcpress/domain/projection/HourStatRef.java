package com.jcpress.domain.projection;

import lombok.Data;

/** 小时分布的一行（跨日期按小时汇总后的结果） */
@Data
public class HourStatRef {

    /** 0–23 */
    private Integer statHour;
    private Integer pv;
}
