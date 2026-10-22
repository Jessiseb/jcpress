const { chromium } = require('playwright-core')

/**
 * 刷新体验验收（第四期优化）：把「刷新时那三段过渡」逐一拍下来。
 *
 * 之前刷新 `/admin/dashboard` 会看到：白屏 → 白底一行「正在加载…」→ 外壳+一行字 → 内容。
 * 现在应该是：呼吸线 → 外壳骨架 → 骨架内容 → 内容。
 *
 * 三个探针手段：
 *  · 拦 `index-*.js`（延迟）→ 拍「JS 还没到」时的首屏兜底；
 *  · 拦 `AdminDashboardPage-*.js`（延迟）→ 拍 Suspense 兜底（外壳骨架）；
 *  · 拦 `/api/v1/admin/stats/**`（延迟）→ 拍数据未回时的骨架内容。
 */

const envelope = (data) => JSON.stringify({ code: 0, message: 'ok', data, traceId: null })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const overview = {
  todayPv: 41, todayUv: 23, yesterdayPv: 36, yesterdayUv: 21,
  last7Pv: 268, totalView: 1024, articleCount: 12, publishedCount: 9,
}
const trend = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10),
  pv: 8 + i, uv: 5 + Math.round(i / 2),
}))
const articles = [{ id: '1', title: 'Redis 分布式锁的三个坑', slug: 'a', periodView: 96, totalView: 402 }]
const paths = [{ path: '/', pv: 120 }, { path: '/tech', pv: 74 }]

async function mockApi(page, { delay = 0 } = {}) {
  await page.route('**/api/**', async (route) => {
    if (delay > 0) await sleep(delay)
    const path = new URL(route.request().url()).pathname
    const body =
      path.endsWith('/admin/auth/me')
        ? envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' })
        : path.endsWith('/admin/stats/overview')
          ? envelope(overview)
          : path.endsWith('/admin/stats/trend')
            ? envelope(trend)
            : path.endsWith('/admin/stats/articles')
              ? envelope(articles)
              : path.endsWith('/admin/stats/paths')
                ? envelope(paths)
                : envelope(null)
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  // ---- 1) JS 未到：首屏呼吸线（#root:empty 的伪元素） ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await page.route(/\/assets\/index-.*\.js$/, async (route) => {
      await sleep(4000)
      await route.continue()
    })
    await page.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'commit' })
    await sleep(700)
    await page.screenshot({ path: '.tmp/p4/boot-splash.png' })
    const emptyBefore = await page.evaluate(() => document.getElementById('root')?.childElementCount === 0)
    // 放行 JS，确认呼吸线随 React 挂载消失（:empty 不再匹配 → 不需要 JS 清理）
    await page.unroute(/\/assets\/index-.*\.js$/)
    await page.waitForSelector('#root > *', { timeout: 20000 })
    const emptyAfter = await page.evaluate(() => document.getElementById('root')?.childElementCount === 0)
    console.log(`[1] 首屏兜底  截图 ok | JS 未到时 #root 为空=${emptyBefore} | 挂载后为空=${emptyAfter}`)
    await ctx.close()
  }

  // ---- 2) 后台 chunk 未到：外壳骨架（Suspense fallback） ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    await ctx.addInitScript(() => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      localStorage.setItem('jcpress-theme', 'light')
    })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.route(/\/assets\/AdminDashboardPage-.*\.js$/, async (route) => {
      await sleep(3500)
      await route.continue()
    })
    await page.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role="status"]', { timeout: 15000 })
    await page.screenshot({ path: '.tmp/p4/boot-fallback.png' })
    const probe = await page.evaluate(() => {
      const status = document.querySelector('[role="status"]')
      return {
        hasAside: !!document.querySelector('aside'),
        hasHeader: !!document.querySelector('header'),
        hasTable: !!document.querySelector('table'),
        text: (status?.textContent || '').trim().slice(0, 12),
        asideWidth: Math.round(document.querySelector('aside')?.getBoundingClientRect().width || 0),
      }
    })
    console.log(`[2] 外壳骨架  截图 ok | 侧栏宽=${probe.asideWidth}px | header=${probe.hasHeader} table=${probe.hasTable} | 读屏文本「${probe.text}」`)
    await ctx.close()
  }

  // ---- 3) 接口未回：内容骨架 ----
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })
    await ctx.addInitScript((t) => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      localStorage.setItem('jcpress-theme', t)
    }, theme)
    const page = await ctx.newPage()
    await mockApi(page, { delay: 4000 })
    await page.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
    // 关键：**不要**等数据（data-kpi 出现），否则拍到的就是加载完的页面 —— 第一版就是这么错的
    // 看板改用 antd 的 `Card loading` 后，骨架是 `.ant-skeleton`
    await page.waitForSelector('.ant-skeleton', { timeout: 15000 })
    await sleep(350)
    await page.screenshot({ path: `.tmp/p4/boot-skeleton-${theme}.png` })
    const info = await page.evaluate(() => ({
      blocks: document.querySelectorAll('.ant-skeleton').length,
      statusText: document.querySelector('[aria-busy="true"]') ? 'aria-busy' : '',
      chartTop: (() => {
        const card = [...document.querySelectorAll('.ant-card')].find((el) =>
          el.textContent.includes('访问趋势'),
        )
        return Math.round(card?.getBoundingClientRect().top ?? -1)
      })(),
    }))
    // 数据回来后量同一块图的位置，差值就是「换内容时版式跳了多少」
    await page.waitForSelector('svg[role="img"]', { timeout: 20000 })
    const after = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.ant-card')].find((el) =>
        el.textContent.includes('访问趋势'),
      )
      return Math.round(card?.getBoundingClientRect().top ?? -1)
    })
    console.log(
      `[3] 内容骨架(${theme})  截图 ok | 占位块 ${info.blocks} 个 | 读屏「${info.statusText}」 | 图表顶边 骨架 ${info.chartTop} → 真图 ${after}（位移 ${Math.abs(after - info.chartTop)}px）`,
    )
    await ctx.close()
  }

  // ---- 4) 公开详情页：chunk 未到时的正文骨架 ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.route(/\/assets\/ArticleDetailPage-.*\.js$/, async (route) => {
      await sleep(3000)
      await route.continue()
    })
    await page.goto('http://127.0.0.1:5176/tech/probe', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role="status"]', { timeout: 15000 })
    await page.screenshot({ path: '.tmp/p4/boot-article.png' })
    console.log('[4] 文章骨架  截图 ok')
    await ctx.close()
  }

  await browser.close()
})().catch((error) => {
  console.error('probe failed:', error.message)
  process.exit(1)
})
