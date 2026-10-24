const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })
const card = (id, title, slug) => ({ id, title, slug, summary: 's', coverUrl: null, categoryName: 'Java 后端', categorySlug: 'java', tags: [], readingMinutes: 8, viewCount: 1, top: 0, publishTime: '2026-10-20 09:00:00' })
const body = envelope({ list: [card('1', 'Redis 分布式锁')], page: 1, size: 200, total: 1, pages: 1 })
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 700 } })
  const p = await ctx.newPage()
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }))
  await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
  await p.getByLabel('搜索文章').waitFor()
  const read = () => p.evaluate(() => {
    const icon = document.querySelector('[class*="searchIcon"]')
    return { icon: icon ? getComputedStyle(icon).color : 'n/a', svgStroke: icon ? getComputedStyle(icon.querySelector('svg')).stroke : 'n/a' }
  })
  console.log('未聚焦', JSON.stringify(await read()))
  await p.getByLabel('搜索文章').click()
  await p.waitForTimeout(200)
  console.log('聚焦后', JSON.stringify(await read()))
  // placeholder 与输入文字颜色
  console.log(await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[class*="searchField"] .ant-input'))
    return `输入框 字号 ${cs.fontSize} 字色 ${cs.color}`
  }))
  await b.close()
})()
