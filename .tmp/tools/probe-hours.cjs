const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })

// 一个「典型的个人站」形态：白天零星、晚上 20-23 点集中
const shape = { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 3, 8: 5, 9: 8, 10: 6, 11: 4, 12: 7, 13: 5, 14: 3, 15: 4, 16: 6, 17: 5, 18: 8, 19: 11, 20: 14, 21: 19, 22: 12, 23: 4 }
const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, pv: shape[hour] ?? 0 }))
const overview = { todayPv: 41, todayUv: 23, yesterdayPv: 36, yesterdayUv: 21, last7Pv: 268, totalView: 1024, articleCount: 12, publishedCount: 9 }
const trend = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10),
  pv: 8 + i, uv: 5 + Math.round(i / 2),
}))
const articles = [{ id: '1', title: 'Redis 分布式锁的三个坑', slug: 'a', periodView: 96, totalView: 402 }]
const paths = [{ path: '/', pv: 120 }, { path: '/tech', pv: 74 }]

const route = (path) =>
  path.endsWith('/admin/auth/me') ? envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' })
    : path.endsWith('/overview') ? envelope(overview)
    : path.endsWith('/trend') ? envelope(trend)
    : path.endsWith('/hours') ? envelope(hours)
    : path.endsWith('/articles') ? envelope(articles)
    : path.endsWith('/paths') ? envelope(paths)
    : envelope(null)

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 })
    await ctx.addInitScript((t) => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      localStorage.setItem('jcpress-theme', t)
    }, theme)
    const p = await ctx.newPage()
    await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: route(new URL(r.request().url()).pathname) }))
    await p.goto('http://127.0.0.1:8099/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await p.getByText('访问时段', { exact: true }).waitFor({ timeout: 20000 })
    await p.getByText(/最忙的是/).waitFor({ timeout: 20000 })
    // 悬停峰值那一根，把 tooltip 一起拍进来
    const peak = p.locator('[data-hour="21"]')
    await peak.hover()
    await p.waitForTimeout(400)
    await p.screenshot({ path: `.tmp/p4/hours-${theme}.png`, fullPage: true })
    const info = await p.evaluate(() => ({
      bars: document.querySelectorAll('[data-hour]').length,
      summary: [...document.querySelectorAll('p')].map((el) => el.textContent).find((t) => t?.includes('最忙')) ?? '',
      peakHeight: document.querySelector('[data-hour="21"] > span')?.getBoundingClientRect().height ?? 0,
      zeroHeight: document.querySelector('[data-hour="2"] > span')?.getBoundingClientRect().height ?? 0,
      tooltip: document.querySelector('.ant-tooltip')?.textContent?.trim() ?? '',
    }))
    console.log(`[${theme}] 柱子 ${info.bars} 根 | 峰值柱高 ${Math.round(info.peakHeight)}px / 0 次柱高 ${Math.round(info.zeroHeight)}px`)
    console.log(`        汇总「${info.summary.trim()}」 | tooltip「${info.tooltip}」`)
    await ctx.close()
  }
  await b.close()
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
