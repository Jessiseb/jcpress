-- 站点访问的**小时**聚合（第四期补：回答「几点有人来」）
--
-- 只存 PV，不存小时 UV：小时 UV 是「这一小时里的独立访客」，
-- 把一天 24 个小时的值加起来会把人算 24 次 —— 又一个「看着合理的错数」。
-- 真要问「几点有人来」，看的是次数分布，不是人数分布。
--
-- 存量数据补不了：上线前的访问只有天维度（甚至只有 article.view_count 总量），
-- 这张表从这次部署当天开始有数。

CREATE TABLE `visit_hourly` (
  `stat_date`    DATE            NOT NULL COMMENT '自然日',
  `stat_hour`    TINYINT UNSIGNED NOT NULL COMMENT '0–23，按服务器时区（Asia/Shanghai）',
  `pv`           INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '该小时的页面访问次数',
  `gmt_create`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_date`, `stat_hour`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点访问小时聚合（仅 PV）';
