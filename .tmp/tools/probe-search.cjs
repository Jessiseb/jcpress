const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })

const card = (id, title, slug, category, tags, day) => ({
  id, title, slug, summary: '一句话摘要，说明这篇文章解决了什么问题。', coverUrl: null,
  categoryName: category, categorySlug: category, tags, readingMinutes: 8, viewCount: 12, top: 0,
  publishTime: `${day} 09:00:00`,
})

const T = (name, slug) => ({ name, slug })
const list = [
  card('1', 'Redis 分布式锁的三个坑', 'redis-lock', 'Java 后端', [T('Redis', 'redis'), T('并发', 'concurrency')], '2026-10-20'),
  card('2', '把浏览量做成一条可解释的链路', 'views', 'Java 后端', [T('Redis', 'redis'), T('统计', 'stats')], '2026-10-18'),
  card('3', 'Spring Boot 分层到底分什么', 'layers', 'Java 后端', [T('架构', 'architecture')], '2026-10-15'),
  card('4', 'RAG 里的召回率', 'rag', 'AI 工程', [T('检索', 'retrieval')], '2026-10-12'),
]
const detail = {
  ...list[0],
  type: 'TECH',
  contentMd: '## 一、起因\n\n正文段落，用来占位。\n\n## 二、做法\n\n再来一段。\n',
  prev: null, next: null,
}

const route = (path) => {
  if (path.endsWith('/v1/articles/redis-lock')) return envelope(detail)
  if (path.endsWith('/v1/articles')) return envelope({ list, page: 1, size: 200, total: list.length, pages: 1 })
  return envelope(null)
}

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: route(new URL(r.request().url()).pathname) }))

  // 1) 列表页：搜「redis」（标签命中，两篇标题里只有一个含 redis）
  await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
  await p.getByRole('link', { name: /Redis 分布式锁/ }).waitFor({ timeout: 20000 })
  await p.getByLabel('搜索文章').fill('redis')
  await p.waitForTimeout(400)
  await p.screenshot({ path: '.tmp/p4/search-list.png', fullPage: true })
  const listInfo = await p.evaluate(() => ({
    count: document.querySelector('[class*="count"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    rows: document.querySelectorAll('[data-card]').length,
    url: location.search,
  }))
  console.log(`[列表] ${listInfo.count} | 行数 ${listInfo.rows} | URL ${listInfo.url}`)

  // 2) 点进第一篇：详情页标签该高亮命中的那个
  await p.locator('[data-card="redis-lock"]').click()
  await p.getByText('次阅读').waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: '.tmp/p4/search-detail.png', fullPage: true })
  const detailInfo = await p.evaluate(() => {
    const tags = [...document.querySelectorAll('[class*="tag"]')].map((el) => ({
      text: el.textContent?.trim(),
      active: el.getAttribute('data-active'),
      href: el.getAttribute('href'),
    }))
    return { url: location.pathname + location.search, tags }
  })
  console.log(`[详情] URL ${detailInfo.url}`)
  for (const t of detailInfo.tags) console.log(`        标签「${t.text}」 高亮=${t.active ?? '否'} → ${t.href}`)

  // 3) 搜不到的空态
  await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
  await p.getByLabel('搜索文章').fill('no-such-keyword')
  await p.waitForTimeout(400)
  await p.screenshot({ path: '.tmp/p4/search-empty.png', fullPage: true })
  const emptyText = await p.evaluate(() => document.querySelector('[class*="emptyText"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  console.log(`[空态] ${emptyText}`)

  await b.close()
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
