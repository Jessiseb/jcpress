const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })
const card = (id, title, slug) => ({ id, title, slug, summary: 's', coverUrl: null, categoryName: 'Java 后端', categorySlug: 'java', tags: [], readingMinutes: 8, viewCount: 1, top: 0, publishTime: '2026-10-20 09:00:00' })
const body = envelope({ list: [card('1', 'Redis 分布式锁')], page: 1, size: 200, total: 1, pages: 1 })

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 780 } })
  const p = await ctx.newPage()
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }))
  await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
  await p.getByLabel('搜索文章').click()
  await p.getByLabel('搜索文章').fill('redis')
  await p.waitForTimeout(300)
  const out = await p.evaluate(() => {
    const wrap = document.querySelector('[class*="searchField"] .ant-input-affix-wrapper')
    const input = document.querySelector('[class*="searchField"] .ant-input')
    const dump = (el, name) => {
      const s = getComputedStyle(el)
      return {
        name,
        cls: el.className,
        borderTop: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        borderRight: `${s.borderRightWidth} ${s.borderRightStyle}`,
        borderBottom: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        borderLeft: `${s.borderLeftWidth} ${s.borderLeftStyle}`,
        outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor} off=${s.outlineOffset}`,
        boxShadow: s.boxShadow,
      }
    }
    return [dump(wrap, 'wrapper'), dump(input, 'input')]
  })
  console.log(JSON.stringify(out, null, 1))
  await b.close()
})()
