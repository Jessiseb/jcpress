/**
 * 「技术分享」列表数据源。
 *
 * 现阶段是前端常量：后端 `/api/v1/articles`（规划 §9.2、M3）尚未实现。
 * 结构对齐后端 VO（`article` 表 type=TECH + `category` + `tag`），
 * 后端就绪后只需把 `useArticles()` 的实现换成 TanStack Query，组件零改动。
 *
 * ⚠️ **占位文案**：标题与摘要取自作者简历里真实做过的事，用于把版面撑到真实密度；
 * 发布前必须替换为作者自己的文章（`slug` 用于将来的详情路由，替换时别重复）。
 */
export interface ArticleVO {
  slug: string
  title: string
  /** 摘要 ≤120 字 */
  summary: string
  category: string
  tags: string[]
  /** YYYY-MM-DD */
  publishedAt: string
  readingMinutes: number
}

export const articleData: ArticleVO[] = [
  {
    slug: 'threadlocal-tool-context',
    title: 'ThreadLocal 在 Tool 层的上下文隔离：一次并发串扰的排查',
    summary:
      'Agent 并发调用工具时用户身份互相串了。用 ThreadLocal 做线程级隔离，顺手记下线程池复用带来的那个坑。',
    category: 'AI · Agent',
    tags: ['Spring AI', '并发'],
    publishedAt: '2026-08-12',
    readingMinutes: 9,
  },
  {
    slug: 'sliding-window-hybrid-retrieval',
    title: '滑动窗口分块 + 混合检索：把知识库准确率从 65% 拉到 90%',
    summary:
      'PDF 按固定长度切会把语义切断。改成 500 字符 + 50 重叠的滑动窗口，再叠上向量与 BM25 混合检索。',
    category: 'AI · Agent',
    tags: ['RAG', '检索'],
    publishedAt: '2026-06-30',
    readingMinutes: 12,
  },
  {
    slug: 'feishu-threadid-serial',
    title: '用飞书话题 threadId 做同 Case 串行：Agent 群聊的并发一致性',
    summary:
      '同一个故障排查 Case 的消息必须顺序处理，跨 Case 又要并行。以 threadId 分片加 session 锁，两头都满足。',
    category: 'AI · Agent',
    tags: ['Agent', '架构'],
    publishedAt: '2026-05-18',
    readingMinutes: 10,
  },
  {
    slug: 'pulse-zset-sharding',
    title: 'Redis ZSet 分片 + 分布式锁：Pulse 的任务多机分发',
    summary:
      '定时任务平台要横向扩容，核心是把「同一时刻的批量触发」拆到多台机器上，同时不能重复执行。',
    category: '中间件',
    tags: ['Redis', '分布式'],
    publishedAt: '2026-03-09',
    readingMinutes: 11,
  },
  {
    slug: 'archive-ten-million-rows',
    title: '1000 万行日志表归档：主键分批删除如何规避长事务与长锁',
    summary:
      '一次性 DELETE 会锁表锁到天亮。改成按主键分批加小事务提交，保留近三个月数据，归档窗口压到分钟级。',
    category: '数据库',
    tags: ['MySQL', '运维'],
    publishedAt: '2025-12-21',
    readingMinutes: 8,
  },
]
