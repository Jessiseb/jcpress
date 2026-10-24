package com.jcpress.repository;

import com.jcpress.domain.projection.DailyPvUvRef;
import com.jcpress.domain.projection.HourStatRef;
import com.jcpress.domain.projection.PathStatRef;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 站点访问日聚合 DAO。
 *
 * 写入是**快照覆盖**（`ON DUPLICATE KEY UPDATE pv = VALUES(pv)`），不是增量：
 * Redis 里那份是日内累计值，覆盖写天然幂等，回写跑多少次结果都一样（design D-C）。
 * 这也是它不复刻 `ArticleMapper.updateViewCountIncrement` 的原因 —— 那个是增量语义。
 *
 * 本接口**不继承 BaseMapper**：这三张聚合表没有业务身份，主键就是「日期（+ 维度）」，
 * 用不上 `selectById / updateById` 那一套。
 */
public interface VisitStatMapper {

    void saveDaily(@Param("statDate") LocalDate statDate,
                     @Param("pv") int pv,
                     @Param("uv") int uv);

    void savePath(@Param("statDate") LocalDate statDate,
                    @Param("path") String path,
                    @Param("pv") int pv);

    /** 小时聚合（只记 PV，见 V4 迁移注释） */
    void saveHour(@Param("statDate") LocalDate statDate,
                  @Param("statHour") int statHour,
                  @Param("pv") int pv);

    DailyPvUvRef getDaily(@Param("statDate") LocalDate statDate);

    List<DailyPvUvRef> listDailyBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    Integer countSumPvBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 区间内按小时汇总（只返回有数据的小时，补零在 Service 里做） */
    List<HourStatRef> listHourBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    List<PathStatRef> listPathTop(@Param("from") LocalDate from,
                                  @Param("to") LocalDate to,
                                  @Param("limit") int limit);
}
