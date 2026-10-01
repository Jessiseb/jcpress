-- jcpress 初始表结构
-- 来源：docs/项目前期规划.md §6（唯一源）。本文件已用探针在 MySQL 8.0.36 上原样跑通，
-- 含 FULLTEXT ... WITH PARSER ngram（实测中文检索命中）。
-- 约定：表必备 id/gmt_create/gmt_modified；is_xxx 用 unsigned tinyint；表名不用复数；
--       索引前缀 idx_/uk_；不使用外键与级联（完整性在 Service 层保证）；大文本独立成表。

CREATE TABLE `admin_user` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(32)  NOT NULL COMMENT '后台登录名',
  `password_hash` VARCHAR(100) NOT NULL COMMENT 'BCrypt',
  `nickname`      VARCHAR(32)  NOT NULL,
  `role`          VARCHAR(16)  NOT NULL DEFAULT 'ADMIN' COMMENT 'ADMIN（预留 EDITOR）',
  `status`        TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 正常 0 禁用',
  `last_login_time` DATETIME   NULL,
  `last_login_ip` VARCHAR(64)  NULL,
  `gmt_create`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台账号';

-- 只追加表：按手册只保留 id + gmt_create（有意偏离，已在规划 §6.6 说明）
CREATE TABLE `admin_audit_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id`    BIGINT UNSIGNED NOT NULL,
  `action`      VARCHAR(32)  NOT NULL COMMENT 'LOGIN/LOGOUT/CREATE/UPDATE/DELETE/PUBLISH/UPLOAD',
  `target_type` VARCHAR(32)  NULL COMMENT 'ARTICLE / PROJECT / CATEGORY',
  `target_id`   BIGINT UNSIGNED NULL,
  `detail`      VARCHAR(500) NULL,
  `ip`          VARCHAR(64)  NULL,
  `user_agent`  VARCHAR(255) NULL,
  `gmt_create`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id_gmt_create` (`admin_id`, `gmt_create` DESC),
  KEY `idx_target_type_target_id` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台操作审计日志（只追加）';

CREATE TABLE `category` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `scope`        VARCHAR(16)  NOT NULL DEFAULT 'TECH' COMMENT 'TECH 技术分类 / ALGO 算法专题',
  `parent_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 为顶级；逻辑外键',
  `name`         VARCHAR(64)  NOT NULL,
  `slug`         VARCHAR(64)  NOT NULL,
  `description`  VARCHAR(255) NULL,
  `sort`         INT UNSIGNED NOT NULL DEFAULT 0,
  `gmt_create`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scope_slug` (`scope`, `slug`),
  KEY `idx_scope_parent_id_sort` (`scope`, `parent_id`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类 / 算法专题（按 scope 区分两棵树）';

CREATE TABLE `tag` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(32) NOT NULL,
  `slug`         VARCHAR(32) NOT NULL,
  `gmt_create`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签';

CREATE TABLE `article` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type`             VARCHAR(16)  NOT NULL COMMENT 'TECH / ALGO / PROJECT（LIFE 预留）',
  `category_id`      BIGINT UNSIGNED NULL COMMENT 'TECH / ALGO 用；逻辑外键，无 FK 约束',
  `project_id`       BIGINT UNSIGNED NULL COMMENT 'PROJECT 用；逻辑外键，无 FK 约束',
  `title`            VARCHAR(200) NOT NULL,
  `slug`             VARCHAR(120) NOT NULL COMMENT '路由标识，限长以便整列建唯一索引',
  `summary`          VARCHAR(500) NULL,
  `cover_url`        VARCHAR(255) NULL,
  `status`           TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 草稿 1 已发布 2 归档',
  `word_count`       INT UNSIGNED NOT NULL DEFAULT 0,
  `reading_minutes`  INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '入库时按字数估算',
  `view_count`       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Redis 累加后定期回写',
  `like_count`       INT UNSIGNED NOT NULL DEFAULT 0,
  `is_top`           TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1 置顶',
  `publish_time`     DATETIME     NULL,
  `gmt_create`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_slug` (`type`, `slug`),
  KEY `idx_type_status_publish_time` (`type`, `status`, `publish_time` DESC),
  KEY `idx_category_id_status_publish_time` (`category_id`, `status`, `publish_time` DESC),
  KEY `idx_project_id_status_publish_time` (`project_id`, `status`, `publish_time` DESC),
  FULLTEXT KEY `ft_title_summary` (`title`, `summary`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容主表（技术文章 / 项目笔记）';

-- 与主表 1:1 的扩展表：主键直接用 article_id，不额外造代理键（规划 §6.6 的有意偏离）
CREATE TABLE `article_content` (
  `article_id`   BIGINT UNSIGNED NOT NULL COMMENT '与 article.id 一一对应',
  `content_md`   MEDIUMTEXT   NOT NULL COMMENT 'Markdown 原文',
  `gmt_create`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='正文（与主表 1:1）';

-- 多对多关系表：不设三字段（规划 §6.6 的有意偏离）
CREATE TABLE `article_tag` (
  `article_id` BIGINT UNSIGNED NOT NULL,
  `tag_id`     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_tag_id` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章-标签关系（关系表，不设三字段）';
