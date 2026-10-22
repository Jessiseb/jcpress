const { chromium } = require('playwright-core')

/**
 * 第四期看板的浏览器验收（不是 jsdom 能验的东西）：真实布局、真实 SVG、真实配色。
 *
 * 做法：`vite preview` 跑构建产物，`/api/**` 全部用 route 拦成固定数据 ——
 * 这样验的是「页面在真浏览器里长什么样」，与后端是否在跑无关。
 */

const envelope = (data) => JSON.stringify({ code: 0, message: 'ok', data, traceId: null })

const trend = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 8, 23 + i))
  const base = Math.round(8 + 12 * Math.sin(i / 3) + (i % 4) * 3)
  return {
    date: day.toISOString().slice(0, 10),
    pv: Math.max(0, base + i),
    uv: Math.max(0, Math.round((base + i) * 0.6)),
  }
})

const overview = {
  todayPv: 41,
  todayUv: 23,
  yesterdayPv: 36,
  yesterdayUv: 21,
  last7Pv: 268,
  totalView: 1024,
  articleCount: 12,
  publishedCount: 9,
}

const articles = [
  ['Redis 分布式锁的三个坑', 96, 402],
  ['Spring Boot 分层到底分什么', 71, 318],
  ['把浏览量做成一条可解释的链路', 54, 205],
  ['Java 线程基础', 33, 180],
  ['一次 EDR 拦截引发的构建复盘', 21, 96],
].map(([title, periodView, totalView], i) => ({
  id: String(i + 1),
  title,
  slug: 'post-' + (i + 1),
  periodView,
  totalView,
}))

const paths = [
  ['/', 120],
  ['/tech', 74],
  ['/tech/redis-lock', 41],
  ['/tech/spring-layers', 22],
  ['/algo', 9],
].map(([path, pv]) => ({ path, pv }))

const ratio = (fg, bg) => {
  const lum = (color) => {
    const [r, g, b] = color
      .match(/\d+(\.\d+)?/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const a = lum(fg)
  const b = lum(bg)
  return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const results = []

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    })
    // index.html 的內联脚本在首帧前按 localStorage 写 data-theme，
    // 所以必须写存储键而不是直接改属性（直接改会被它覆盖回 light）
    await ctx.addInitScript((t) => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      localStorage.setItem('jcpress-theme', t)
    }, theme)

    const page = await ctx.newPage()
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname
      if (path.endsWith('/admin/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' }),
        })
      }
      if (path.endsWith('/admin/stats/overview')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(overview) })
      }
      if (path.endsWith('/admin/stats/trend')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(trend) })
      }
      if (path.endsWith('/admin/stats/articles')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(articles) })
      }
      if (path.endsWith('/admin/stats/paths')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(paths) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
    })

    await page.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.getByText('站点数据', { exact: true }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)

    // 悬停一个点，把 tooltip 也拍进去（这是纯浏览器行为，jsdom 验不到）
    const chart = page.locator('svg[role="img"]')
    const box = await chart.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5)
      await page.waitForTimeout(200)
    }

    await page.screenshot({ path: `.tmp/p4/dashboard-${theme}.png`, fullPage: true })

    const measured = await page.evaluate(() => {
      const pick = (selector, useFill) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const style = getComputedStyle(el)
        return {
          color: useFill ? style.fill : style.color,
          bg: style.backgroundColor,
          text: el.textContent.trim().slice(0, 20),
        }
      }
      return {
        kpiValue: pick('[data-kpi-value="totalView"]'),
        kpiNote: pick('[data-kpi="totalView"] p'),
        // SVG 文字的颜色在 fill 里，量 color 会拿到继承的父级文字色（第一个版本就量错了）
        axis: pick('svg[role="img"] text', true),
        tooltip: pick('[class*="tooltip"]'),
        card: pick('[data-kpi="totalView"]'),
        paths: document.querySelectorAll('[class*="pathRow"]').length,
        ranks: document.querySelectorAll('tbody tr').length,
        chart: !!document.querySelector('svg[role="img"]'),
        tooltipVisible: !!document.querySelector('[class*="tooltip"]'),
      }
    })

    results.push({ theme, measured })
    await ctx.close()
  }

  // 窄屏：后台在 <960px 会切成抽屉式侧栏，看板只剩 ~375px 可用宽度，
  // 这里只验「没有横向溢出」这一条硬指标（表格已套 overflow-x 容器）
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })
    await ctx.addInitScript(() => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      localStorage.setItem('jcpress-theme', 'light')
    })
    const page = await ctx.newPage()
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/admin/auth/me')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' }) })
      }
      if (path.endsWith('/admin/stats/overview')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(overview) })
      }
      if (path.endsWith('/admin/stats/trend')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(trend) })
      }
      if (path.endsWith('/admin/stats/articles')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(articles) })
      }
      if (path.endsWith('/admin/stats/paths')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(paths) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
    })
    await page.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.getByText('站点数据', { exact: true }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '.tmp/p4/dashboard-mobile.png', fullPage: true })
    const overflow = await page.evaluate(() => ({
      inner: window.innerWidth,
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    console.log('\n[mobile 375]')
    console.log('  视口', overflow.inner, '| 文档宽', overflow.doc, '| 横向溢出', overflow.doc > overflow.inner ? '有' : '无')
    await ctx.close()
  }

  await browser.close()

  for (const { theme, measured } of results) {
    console.log(`\n[${theme}]`)
    console.log('  图表:', measured.chart ? 'ok' : '缺失', '| 悬停 tooltip:', measured.tooltipVisible ? 'ok' : '缺失')
    console.log('  排行行数:', measured.ranks, '| 热门页面条数:', measured.paths)
    const kpi = measured.kpiValue
    const cardBg = measured.card?.bg
    if (kpi && cardBg) {
      console.log('  指标值对比度:', ratio(kpi.color, cardBg), '（文字', kpi.color, '底', cardBg, '）')
    }
    const note = measured.kpiNote
    if (note && cardBg) {
      console.log('  口径小字对比度:', ratio(note.color, cardBg), '（', note.text, '）')
    }
    if (measured.axis) {
      console.log('  轴文字色:', measured.axis.color)
    }
  }
})().catch((error) => {
  console.error('probe failed:', error.message)
  process.exit(1)
})
