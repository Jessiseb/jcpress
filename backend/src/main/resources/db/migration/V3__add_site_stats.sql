-- 站点统计的日聚合表（第四期）
--
-- **有意偏离** V1 头部「表必备 id/gmt_create/gmt_modified」这条约定：这三张表不设自增 id，
-- 用「日期（+ 维度）」作主键。理由与 article_content（用 article_id 当主键）、
-- article_tag（复合主键）同一条 —— 聚合表的天然主键就是维度本身；
-- 硬加一个代理键会让「一天只能有一行」「一篇文章一天只能有一行」失去数据库约束。
--
-- 为什么不留原始访问事件表：单人站日 PV 以百计，原始表一年也就几万行，
-- 它不会变慢，**它只是没人会查**。日聚合表一年 365 行，一眼看完。

CREATE TABLE `visit_daily` (
  `stat_date`    DATE          NOT NULL COMMENT '自然日（Asia/Shanghai）',
  `pv`           INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '当日页面访问次数',
  `uv`           INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '当日独立访客数（ip+ua 指纹去重）',
  `gmt_create`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点访问日聚合';

CREATE TABLE `visit_path_daily` (
  `stat_date`    DATE         NOT NULL COMMENT '自然日',
  `path`         VARCHAR(160) NOT NULL COMMENT '规范化后的 pathname（不含 query/hash）',
  `pv`           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当日该路径访问次数',
  `gmt_create`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_date`, `path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='按路径的访问日聚合';

CREATE TABLE `article_view_daily` (
  `article_id`   BIGINT UNSIGNED NOT NULL,
  `stat_date`    DATE            NOT NULL COMMENT '自然日',
  `view_count`   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '当日阅读数（同指纹同日只计一次）',
  `gmt_create`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`article_id`, `stat_date`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章阅读日聚合（与 article.view_count 同口径）';
