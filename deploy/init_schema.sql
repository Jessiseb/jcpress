-- ============================================================================
-- jcpress 初始化建表脚本 (V1)
-- 适用：MySQL 8 / InnoDB / utf8mb4 / utf8mb4_0900_ai_ci
-- 来源：docs/项目前期规划.md §6 数据库设计（DDL 草案，已逐条核对阿里手册黄山版）
--
-- 用法（在你的服务器 119.91.227.162 上，先确保 MySQL 已起、且你有足够权限的账号）：
--   方式 A（推荐，整库一键建好）：
--     mysql -h 127.0.0.1 -u <你的DB账号> -p < deploy/init_schema.sql
--   方式 B（先登进去再跑）：
--     mysql -h 127.0.0.1 -u <你的DB账号> -p
--     source /path/to/deploy/init_schema.sql
--
-- 说明：
--   1. 脚本自带 CREATE DATABASE + USE，库名默认 `jcpress`，如要改名改第一行即可。
--   2. 所有外键均为「逻辑外键」，数据库层不建 FK 约束（见 §6.6），完整性由应用层保证。
--   3. 全文索引用了 ngram 中文分词器（MySQL 8 内置），无需额外插件。
--   4. 初始后台账号不要写死在仓库里（明文口令风险），seed 模板见文件末尾。
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `jcpress`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `jcpress`;

-- ----------------------------------------------------------------------------
-- 6.1 后台账号与审计（只有后台需要账号，前台访客无账号、无注册入口）
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 6.2 分类与标签（分类复用一张表，靠 scope 区分 TECH / ALGO 两棵树）
-- ----------------------------------------------------------------------------
CREATE TABLE `category` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `scope`        VARCHAR(16)  NOT NULL DEFAULT 'TECH' COMMENT 'TECH 技术分类 / ALGO 算法专题',
  `parent_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 为顶级；逻辑外键',
  `name`         VARCHAR(64) NOT NULL,
  `slug`         VARCHAR(64) NOT NULL,
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

CREATE TABLE `article_tag` (
  `article_id` BIGINT UNSIGNED NOT NULL,
  `tag_id`     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_tag_id` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章-标签关系（关系表，不设三字段）';

-- ----------------------------------------------------------------------------
-- 6.3 内容主表与扩展表（正文 / 算法题解）
--     技术文章 / 算法笔记 / 项目笔记共用 article，用 type 区分
--     正文拆表（大文本单独存），题解特有字段放 algo_problem（1:1 扩展表）
-- ----------------------------------------------------------------------------
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

CREATE TABLE `article_content` (
  `article_id`   BIGINT UNSIGNED NOT NULL COMMENT '与 article.id 一一对应',
  `content_md`   MEDIUMTEXT   NOT NULL COMMENT 'Markdown 原文',
  `gmt_create`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='正文（与主表 1:1）';

CREATE TABLE `algo_problem` (
  `article_id`       BIGINT UNSIGNED NOT NULL COMMENT '与 article.id 一一对应（type=ALGO）',
  `platform`         VARCHAR(32)  NOT NULL DEFAULT 'LEETCODE' COMMENT 'LEETCODE / NOWCODER / OTHER',
  `problem_no`       VARCHAR(32)  NULL COMMENT '题号，如 146',
  `problem_url`      VARCHAR(255) NULL COMMENT '原题链接',
  `difficulty`       TINYINT UNSIGNED NOT NULL COMMENT '1 简单 2 中等 3 困难',
  `time_complexity`  VARCHAR(32)  NULL COMMENT '如 O(n log n)',
  `space_complexity` VARCHAR(32)  NULL COMMENT '如 O(1)',
  `language`         VARCHAR(16)  NOT NULL DEFAULT 'JAVA',
  `mastery`          TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 未掌握 1 模糊 2 熟练（仅后台展示）',
  `last_review_time` DATETIME     NULL COMMENT '最近复习时间（复习队列用）',
  `review_count`     INT UNSIGNED NOT NULL DEFAULT 0,
  `gmt_create`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`article_id`),
  KEY `idx_difficulty_mastery` (`difficulty`, `mastery`),
  KEY `idx_platform_problem_no` (`platform`, `problem_no`),
  KEY `idx_last_review_time` (`last_review_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='算法题解扩展（与主表 1:1）';

-- ----------------------------------------------------------------------------
-- 6.4 项目
-- ----------------------------------------------------------------------------
CREATE TABLE `project` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100) NOT NULL,
  `slug`          VARCHAR(100) NOT NULL,
  `summary`       VARCHAR(500) NULL,
  `cover_url`     VARCHAR(255) NULL,
  `repo_url`      VARCHAR(255) NULL,
  `demo_url`      VARCHAR(255) NULL,
  `tech_stack`    VARCHAR(255) NULL COMMENT '逗号分隔，如 Java,Spring Boot,MySQL',
  `role_desc`     VARCHAR(100) NULL COMMENT '担任角色',
  `status`        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 进行中 1 已上线 2 已归档',
  `start_date`    DATE         NULL,
  `end_date`      DATE         NULL,
  `sort`          INT UNSIGNED NOT NULL DEFAULT 0,
  `is_featured`   TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1 在关于我页面展示',
  `gmt_create`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_is_featured_sort` (`is_featured`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目';

-- ----------------------------------------------------------------------------
-- 6.5 关于我（结构化简历）
-- ----------------------------------------------------------------------------
CREATE TABLE `profile` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `display_name`   VARCHAR(64)  NOT NULL,
  `headline`       VARCHAR(200) NOT NULL COMMENT '一句话定位，用于 Hero',
  `keywords`       VARCHAR(200) NULL COMMENT 'Hero 关键词，逗号分隔',
  `avatar_url`     VARCHAR(255) NULL,
  `summary`        TEXT         NULL COMMENT '自我介绍正文（Markdown）',
  `location`       VARCHAR(64)  NULL,
  `email`          VARCHAR(128) NULL,
  `github_url`     VARCHAR(255) NULL,
  `blog_url`       VARCHAR(255) NULL,
  `wechat_qr_url`  VARCHAR(255) NULL,
  `resume_pdf_url` VARCHAR(255) NULL,
  `gmt_create`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='个人信息（单行表）';

CREATE TABLE `experience` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company`         VARCHAR(100) NOT NULL,
  `position`        VARCHAR(64)  NOT NULL,
  `employment_type` VARCHAR(16)  NOT NULL DEFAULT 'INTERN' COMMENT 'INTERN / FULLTIME',
  `city`            VARCHAR(64)  NULL,
  `start_date`      DATE         NOT NULL,
  `end_date`        DATE         NULL COMMENT 'NULL 表示至今',
  `description_md`  TEXT         NULL COMMENT '职责与产出，Markdown 列表',
  `sort`            INT UNSIGNED NOT NULL DEFAULT 0,
  `is_visible`      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `gmt_create`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_visible_sort` (`is_visible`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实习/工作经历';

CREATE TABLE `skill` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category`     VARCHAR(32)  NOT NULL COMMENT '语言/框架/中间件/数据库/工具',
  `name`         VARCHAR(64)  NOT NULL,
  `level`        TINYINT UNSIGNED NULL COMMENT '1-5 熟练度，NULL 则只展示名称',
  `years`        DECIMAL(3,1) NULL,
  `icon`         VARCHAR(64)  NULL,
  `sort`         INT UNSIGNED NOT NULL DEFAULT 0,
  `is_visible`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `gmt_create`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category_sort` (`category`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术栈';

-- ============================================================================
-- 可选：初始后台账号 seed（口令不要明文进仓库，这里给模板）
--   用应用注册接口，或本地用 BCrypt 生成哈希后替换下面的 <BCrypt哈希> 再执行：
--   INSERT INTO `admin_user` (`username`, `password_hash`, `nickname`)
--   VALUES ('admin', '<BCrypt哈希>', '站长');
--   注意：首次登录需强制改密（实现见后台登录逻辑），避免弱口令落地。
-- ============================================================================
