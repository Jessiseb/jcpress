package com.jcpress.domain.vo;

import lombok.Data;

/**
 * 访问时段分布的一个小时。
 *
 * 只有 `pv`：小时 UV 是「这一小时里的独立访客」，24 个小时相加会把人算 24 次，
 * 那种数比不给更糟（与本项目「不给 7 日 UV」同一条原则）。
 */
@Data
public class HourStatsVO {

    /** 0–23，按服务器时区 */
    private Integer hour;
    /** 近 N 天里这一个小时发生的访问次数合计 */
    private Integer pv;
}
