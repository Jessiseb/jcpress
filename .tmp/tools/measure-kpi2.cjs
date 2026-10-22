const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })
const overview = { todayPv: 41, todayUv: 23, yesterdayPv: 36, yesterdayUv: 21, last7Pv: 268, totalView: 1024, articleCount: 12, publishedCount: 9 }
const trend = []
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } })
  await ctx.addInitScript(() => { sessionStorage.setItem('jcpress.admin.token', 't'); localStorage.setItem('jcpress-theme', 'light') })
  const p = await ctx.newPage()
  await p.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/auth/me') ? envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' })
      : path.endsWith('/overview') ? envelope(overview)
      : path.endsWith('/trend') ? envelope(trend) : envelope([])
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await p.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-kpi="totalView"]')
  const h = await p.evaluate(() => {
    const card = document.querySelector('[data-kpi="totalView"]')
    const kids = [...card.children].map((el) => ({
      cls: el.className.slice(0, 14),
      h: Math.round(el.getBoundingClientRect().height),
      mt: getComputedStyle(el).marginTop,
      mb: getComputedStyle(el).marginBottom,
    }))
    return { card: Math.round(card.getBoundingClientRect().height), kids }
  })
  console.log(JSON.stringify(h, null, 1))
  await b.close()
})()
