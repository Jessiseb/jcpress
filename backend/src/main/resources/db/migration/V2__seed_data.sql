-- jcpress 种子数据（V2）
--
-- 内容策略（见 docs/design-tech-module.md D4）：
--   * 唯一一篇「已发布」是我为三期写的真实复盘文，它同时是前台详情页的验收素材
--     （正文刻意覆盖：多级标题、列表、表格、行内代码、围栏代码块、引用、外链）。
--   * 原前端占位文案的 5 篇一律**草稿**，正文给提纲骨架 —— 占位内容不该被当成成品发出去。
--
-- 全部用 slug 子查询解析 category_id，不写死自增 ID：测试库里删过数据，
-- AUTO_INCREMENT 计数器不会回退，写死 ID 会得到"分类挂错"的静默错误。

INSERT INTO `category` (`scope`,`parent_id`,`name`,`slug`,`description`,`sort`) VALUES
  ('TECH', 0, 'AI · Agent', 'ai-agent',    'Agent 工程、RAG 与检索',        10),
  ('TECH', 0, 'Java 后端',  'java-backend', 'Spring 生态与工程实践',          20),
  ('TECH', 0, '数据库',     'database',     'MySQL 索引、归档与慢查询',       30),
  ('TECH', 0, '中间件',     'middleware',   'Redis / MQ / 调度',             40);

INSERT INTO `tag` (`name`,`slug`) VALUES
  ('Redis','redis'),
  ('并发','concurrency'),
  ('MySQL','mysql'),
  ('Spring AI','spring-ai'),
  ('RAG','rag'),
  ('架构','architecture'),
  ('Spring Boot','spring-boot'),
  ('MyBatis-Plus','mybatis-plus');

-- 后台账号（口令 jcpress@2026 的 BCrypt 哈希；上线前必须在库里改掉）。
-- 哈希是用 BCryptPasswordEncoder 真算出来的，不是手写的 —— 手写一个看起来像的字符串，
-- 结果就是首登永远失败且看不出为什么。
INSERT INTO `admin_user` (`username`,`password_hash`,`nickname`,`role`,`status`) VALUES
  ('admin', '$2a$10$Nh40lWkZScz2kbMOHiSKq.Wuem42GaFgem5ZvCZ667xtXIlUuOkzO', '站长', 'ADMIN', 1);

-- ---------------------------------------------------------------- 唯一一篇已发布文
INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id,
       '三期后端复盘：模板、Redis 版本与「没人守」的规则',
       'phase-3-backend-retro',
       '从官方模板升到 Spring Boot 3 的三类坑：依赖与版本、JSON 序列化、以及那些文档写了却没有判据的约定。',
       1, 2480, 7, 0, 0, 1, '2026-10-02 09:00:00'
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'java-backend';

INSERT INTO `article_content` (`article_id`,`content_md`)
SELECT `id`, '# 三期后端复盘：模板、Redis 版本与「没人守」的规则

三期做的是「技术分享」这条链路：文章进数据库、后台能写、前台能点开读。这也是后端工程第一次落地，
所以下面记的不是功能清单，而是**踩到的坑** —— 每一条都真实发生过，也都留下了可复现的证据。

## 一、模板不是基线

`springboot-init` 是 Spring Boot 2.7.2 + Java 8 的工程，而本站的规划文档写的是 Java 21（后来改成了 17）。
这两者不是「差不多」，是**两套不同的世界**：依赖坐标不同、命名空间不同（`javax.*` 变成 `jakarta.*`）、
连 Swagger 都得换（`knife4j-openapi2` 在 Spring Boot 3 上跑不起来）。

所以做法不是照搬模板，而是**逐件处置**：

| 模板里的东西 | 处置 | 为什么 |
| --- | --- | --- |
| Spring Boot 2.7.2 / Java 8 | 升到 3.3.4 / 17 | 规划基线 + 用户裁定 |
| Jackson | 换 Gson，但**保留在 classpath** | Sa-Token 自带 `sa-token-jackson`，服务它自己的会话序列化 |
| `spring-boot-starter-data-elasticsearch` | 删 | 搜索用 MySQL 的 ngram 全文索引，不引 ES |
| 腾讯 COS / 微信 / EasyExcel | 删 | 与本站无关 |
| 自研的 `AuthCheck` 与 `AuthInterceptor` | 删，换 Sa-Token | 少一套自己维护的鉴权 |

> 一条经验：**「用某个模板」这句话，在模板与规划冲突时其实没给出答案**。
> 我把它理解成「参考它的工程约定与技术写法」，而不是「以它的版本为准」——这个理解后来被确认了，
> 但当时应该先问一句。

## 二、Jackson 换 Gson 的三个坑

换起来不难，难的是**三个默认行为**：

1. **Long 的精度**。JavaScript 的安全整数上限是 2 的 53 次方减一，而自增 ID 迟早会超。
   解法是注册适配器，把 `Long` 一律序列化成字符串，前端类型也跟着声明成 `string`。
2. **`java.time` 没人认识**。不注册适配器的话，`LocalDateTime` 会被拆成一堆嵌套字段；
   注册之后统一成 `yyyy-MM-dd HH:mm:ss`。
3. **null 字段默认不输出**。这会让前端拿到字段一会儿有一会儿没有，`undefined` 判断遍地。
   开 `serializeNulls()` 之后契约稳定了，代价是响应体稍微大一点。

```java
public static Gson buildGson() {
    return new GsonBuilder()
            .serializeNulls()
            .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
            .registerTypeAdapter(Long.class, new LongToStringAdapter())
            .create();
}
```

一个**代价**要记住：Jackson 的注解（`@JsonProperty`、`@JsonFormat`）在这个项目里全部失效，
需要改字段名时得用 `@SerializedName`。这条不写进文档，下一个人一定会踩。

## 三、一个被 Redis 版本卡住的依赖

规划文档里其实早就写了这个坑：Sa-Token 1.46.0 的 `sa-token-redis-template` 用了
`SET ... KEEPTTL`，而这个命令要 Redis 6.0 以上。本机的 Redis 是 5.0.14。

我没有停在「文档这么说」，而是把 jar 拆开看了常量池：

| Sa-Token 版本 | jar 里有没有 `KEEPTTL` | 能不能用 |
| --- | --- | --- |
| 1.46.0 | 有 | 不能 |
| 1.44.0 | 没有 | 能 |
| 1.42.0 | 没有 | 能 |

结论是**把版本锁到 1.44.0**，而不是去升级 Redis（Windows 上装 Redis 7 要么用第三方移植版、
要么开 Docker，而 Docker 当时没起来）。

但「没有那个命令」不等于「整条链路能用」。所以第一条测试不是业务测试，而是一个**运行时探针**：
登录 → 写 Redis → 按 token 反查 → **续期** → 登出 → 再查应当返回 401。
续期那一步正是 1.46.0 会死的地方。文档在 [sa-token.cc](https://sa-token.cc)。

## 四、把「文档写了但没人守」的规则变成判据

仓库里有一份 `Agent.md`，写着分层方向、禁字段注入、方法名动词前缀、只用 GET 与 POST……
而决策记录里自己承认过：这几条规则**目前没有任何东西守**。

三期的做法是把它们变成测试：13 条 ArchUnit 规则加 3 条源码文本扫描。这件事有两个反直觉的点：

- **包模式必须锚定项目根包**。我第一版写的是 `..web..`，它被理解成「任意层级里出现 web 段」，
  于是 `org.springframework.web` 也被算进去了 —— 一条规则报了 15 次违规，全是假的。
  真正危险的不是假报，而是**反过来**：`..repository..` 命中 `org.springframework.data.repository` 之后，
  规则看起来在跑，实际什么也没守。
- **「能通过」不等于「能拦住」**。16 条判据第一次跑就全绿，我没就此收工，而是故意塞了一个违规类
  （`@Builder` 加 `@Autowired` 字段加 `@PutMapping` 加裸 `@RequestMapping` 加无动词前缀的方法）。
  结果 ArchUnit 四条规则全红，而源码扫描**依然全绿** —— 假绿当场暴露：
  `Pattern.compile("^import ...")` 少写了 `MULTILINE`，`^` 只匹配整个输入的开头，
  等于每个文件只扫了第一行。

从那以后我给自己定了一条：**每新建一条判据，都要先证伪一次**。

## 五、首页加一个区块掀翻了停靠表

首页原本有 7 个区块，天体（那颗球）会随滚动停靠到对应位置，停靠表写在 CSS 的 `[data-scene]` 里。
我要加一个「最新技术分享」，于是区块变成 8 个 —— 而停靠表只有 7 档。

更麻烦的是**这个区块不能做成卡片**：`homepage` 那份规格里明写着「首页只对关键数字、项目经历、
技术栈三类区块使用面板容器，其余区块必须保持通栏」，而卡片等于底色加圆角加投影，直接违规。

这两件事都不是写代码时能顺手发现的：一个是读规格读出来的，一个是读 CSS 读出来的。
它们提醒我，**「加一个小区块」这种描述，在真实项目里的成本往往不在区块本身**。'
FROM `article` WHERE `slug` = 'phase-3-backend-retro';

INSERT INTO `article_tag` (`article_id`,`tag_id`)
SELECT a.id, t.id FROM `article` a
JOIN `tag` t ON t.slug IN ('spring-boot', 'architecture', 'redis')
WHERE a.slug = 'phase-3-backend-retro';

-- ---------------------------------------------------------------- 5 篇草稿（原占位文案）
INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id, 'ThreadLocal 在 Tool 层的上下文隔离：一次并发串扰的排查', 'threadlocal-tool-context',
       'Agent 并发调用工具时用户身份互相串了。用 ThreadLocal 做线程级隔离，顺手记下线程池复用带来的那个坑。',
       0, 0, 0, 0, 0, 0, NULL
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'ai-agent';

INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id, '滑动窗口分块 + 混合检索：把知识库准确率从 65% 拉到 90%', 'sliding-window-hybrid-retrieval',
       'PDF 按固定长度切会把语义切断。改成 500 字符 + 50 重叠的滑动窗口，再叠上向量与 BM25 混合检索。',
       0, 0, 0, 0, 0, 0, NULL
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'ai-agent';

INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id, '用飞书话题 threadId 做同 Case 串行：Agent 群聊的并发一致性', 'feishu-threadid-serial',
       '同一个故障排查 Case 的消息必须顺序处理，跨 Case 又要并行。以 threadId 分片加 session 锁，两头都满足。',
       0, 0, 0, 0, 0, 0, NULL
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'ai-agent';

INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id, 'Redis ZSet 分片 + 分布式锁：Pulse 的任务多机分发', 'pulse-zset-sharding',
       '定时任务平台要横向扩容，核心是把「同一时刻的批量触发」拆到多台机器上，同时不能重复执行。',
       0, 0, 0, 0, 0, 0, NULL
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'middleware';

INSERT INTO `article` (`type`,`category_id`,`title`,`slug`,`summary`,`status`,`word_count`,`reading_minutes`,`view_count`,`like_count`,`is_top`,`publish_time`)
SELECT 'TECH', c.id, '1000 万行日志表归档：主键分批删除如何规避长事务与长锁', 'archive-ten-million-rows',
       '一次性 DELETE 会锁表锁到天亮。改成按主键分批加小事务提交，保留近三个月数据，归档窗口压到分钟级。',
       0, 0, 0, 0, 0, 0, NULL
FROM `category` c WHERE c.scope = 'TECH' AND c.slug = 'database';

-- 草稿也各给一段提纲正文，后台打开就能接着写
INSERT INTO `article_content` (`article_id`,`content_md`)
SELECT `id`, CONCAT('# ', `title`, '

> 草稿：待补正文。

## 背景

## 排查过程

## 结论
')
FROM `article` WHERE `status` = 0;

-- 草稿的标签：按分类给一组默认标签，方便后台继续编辑
INSERT INTO `article_tag` (`article_id`,`tag_id`)
SELECT a.id, t.id FROM `article` a
JOIN `tag` t ON t.slug = 'spring-ai'
WHERE a.slug IN ('threadlocal-tool-context', 'sliding-window-hybrid-retrieval', 'feishu-threadid-serial');

INSERT INTO `article_tag` (`article_id`,`tag_id`)
SELECT a.id, t.id FROM `article` a
JOIN `tag` t ON t.slug = 'redis'
WHERE a.slug = 'pulse-zset-sharding';

INSERT INTO `article_tag` (`article_id`,`tag_id`)
SELECT a.id, t.id FROM `article` a
JOIN `tag` t ON t.slug = 'mysql'
WHERE a.slug = 'archive-ten-million-rows';
