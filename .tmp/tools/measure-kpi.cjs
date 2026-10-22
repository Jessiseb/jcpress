const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })
const overview = { todayPv: 41, todayUv: 23, yesterdayPv: 36, yesterdayUv: 21, last7Pv: 268, totalView: 1024, articleCount: 12, publishedCount: 9 }
const trend = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10), pv: 8 + i, uv: 5 + i }))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } })
  await ctx.addInitScript(() => { sessionStorage.setItem('jcpress.admin.token', 't'); localStorage.setItem('jcpress-theme', 'light') })
  const p = await ctx.newPage()
  await p.route('**/api/**', async (route) => {
    await sleep(3000)
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/auth/me') ? envelope({ id: '1', username: 'admin', nickname: '管理员', role: 'ADMIN' })
      : path.endsWith('/overview') ? envelope(overview)
      : path.endsWith('/trend') ? envelope(trend)
      : path.endsWith('/articles') ? envelope([]) : path.endsWith('/paths') ? envelope([]) : envelope(null)
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await p.goto('http://127.0.0.1:5176/admin/dashboard', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[class*="chartSkeleton"]')
  await sleep(300)
  const before = await p.evaluate(() => {
    const kpis = document.querySelector('[class*="kpis"]')
    const first = document.querySelector('[class*="kpi"]')
    return { kpisH: Math.round(kpis?.getBoundingClientRect().height || 0), cardH: Math.round(first?.getBoundingClientRect().height || 0) }
  })
  await p.waitForSelector('svg[role="img"]')
  const after = await p.evaluate(() => {
    const kpis = document.querySelector('[class*="kpis"]')
    const card = document.querySelector('[data-kpi]')
    return { kpisH: Math.round(kpis?.getBoundingClientRect().height || 0), cardH: Math.round(card?.getBoundingClientRect().height || 0) }
  })
  console.log('骨架: kpis 高', before.kpisH, '单卡', before.cardH)
  console.log('真实: kpis 高', after.kpisH, '单卡', after.cardH)
  await b.close()
})()
