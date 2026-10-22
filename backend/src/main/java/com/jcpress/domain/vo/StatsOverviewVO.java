package com.jcpress.domain.vo;

import lombok.Data;

/**
 * 看板顶部的总览。
 *
 * **故意没有「7 日 UV」**：每天的 UV 是按日去重结果，把 7 天加起来会把同一个人算 7 次，
 * 得出的数字既不是「7 天来了多少人」也不是任何真实量（design D-H）。
 * 逐日 UV 在趋势接口里各自成立，那里可以看。
 *
 * 计数一律 {@code Integer}（数字），ID 才用 {@code Long}（序列化成字符串）。
 */
@Data
public class StatsOverviewVO {

    private Integer todayPv;
    private Integer todayUv;
    private Integer yesterdayPv;
    private Integer yesterdayUv;
    /** 近 7 日（含今天）的 PV 之和 —— 可以相加，PV 是次数不是人 */
    private Integer last7Pv;
    /** 全部已发布文章的累计阅读数（按天去重口径） */
    private Integer totalView;
    private Integer articleCount;
    private Integer publishedCount;
}
