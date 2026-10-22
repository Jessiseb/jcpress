const { chromium } = require('playwright-core')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })

// 注意：列表接口回的是 PageResult<ArticleCardVO>，分组成 TechCatalog 是前端 select 里做的。
// 第一版探针直接按 catalog 形状造数据，select 拿不到 page.list，页面一直空着（假故障）
const card = (id, title, slug, category, day) => ({
  id, title, slug, summary: '摘要', coverUrl: null,
  categoryName: category, categorySlug: category, tags: [],
  readingMinutes: 8, viewCount: 12, top: 0, publishTime: `${day} 09:00:00`,
})
const catalog = {
  list: [
    card('1', 'Redis 分布式锁的三个坑', 'redis-lock', 'Java 后端', '2026-10-20'),
    card('2', 'Spring Boot 分层到底分什么', 'layers', 'Java 后端', '2026-10-18'),
    card('3', '把浏览量做成一条可解释的链路', 'views', 'AI 工程', '2026-10-15'),
  ],
  page: 1,
  size: 200,
  total: 3,
  pages: 1,
}

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  // 1) chunk 未到：App 的 Suspense 兜底（零依赖 TechListSkeleton）
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    await p.route(/\/assets\/TechListPage-.*\.js$/, async (route) => {
      await sleep(3000)
      await route.continue()
    })
    await p.goto('http://127.0.0.1:5176/tech', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('[role="status"]', { timeout: 15000 })
    await p.screenshot({ path: '.tmp/p4/tech-chunk-fallback.png' })
    const info = await p.evaluate(() => ({
      lite: document.querySelectorAll('.jc-lite-skeleton').length,
      title: document.querySelector('h1')?.textContent?.trim(),
    }))
    console.log(`[tech] chunk 未到：兜底骨架块 ${info.lite} 个 | 标题「${info.title}」`)
    await ctx.close()
  }

  // 2) 数据未回：antd 骨架
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    await p.route('**/api/**', async (route) => {
      await sleep(3500)
      return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(catalog) })
    })
    await p.goto('http://127.0.0.1:5176/tech', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.ant-skeleton', { timeout: 15000 })
    await sleep(300)
    await p.screenshot({ path: '.tmp/p4/tech-antd-skeleton.png' })
    const info = await p.evaluate(() => ({
      antd: document.querySelectorAll('.ant-skeleton').length,
      lazy: document.querySelectorAll('.jc-lite-skeleton').length,
    }))
    console.log(`[tech] 数据未回：antd 骨架 ${info.antd} 个 | 轻量骨架 ${info.lazy} 个（应为 0）`)

    // 数据回来，拍最终态并确认没有横向溢出
    await p.waitForSelector('h2', { timeout: 20000 })
    await sleep(300)
    await p.screenshot({ path: '.tmp/p4/tech-loaded.png' })
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    console.log(`[tech] 加载完成：横向溢出 ${overflow}px`)
    await ctx.close()
  }

  // 3) 空态（antd Empty）
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    await p.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ list: [], page: 1, size: 200, total: 0, pages: 0 }) }),
    )
    await p.goto('http://127.0.0.1:5176/tech', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.ant-empty', { timeout: 15000 })
    await p.screenshot({ path: '.tmp/p4/tech-empty.png' })
    console.log('[tech] 空态：antd Empty 已渲染')
    await ctx.close()
  }

  await b.close()
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
