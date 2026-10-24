const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })
const card = (id, title, slug, tags, day) => ({ id, title, slug, summary: '一句话摘要，说明这篇文章解决了什么问题。', coverUrl: null, categoryName: 'Java 后端', categorySlug: 'java', tags, readingMinutes: 8, viewCount: 12, top: 0, publishTime: `${day} 09:00:00` })
const list = [card('1', 'Redis 分布式锁的三个坑', 'a', [{ name: 'Redis', slug: 'redis' }], '2026-10-20'), card('2', '把浏览量做成一条可解释的链路', 'b', [], '2026-10-18')]
const body = envelope({ list, page: 1, size: 200, total: 2, pages: 1 })
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const w of [375, 768]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }))
    await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
    await p.getByLabel('搜索文章').waitFor({ timeout: 20000 })
    await p.getByLabel('搜索文章').fill('redis')
    await p.waitForTimeout(350)
    await p.screenshot({ path: `.tmp/p4/search-mobile-${w}.png` })
    const info = await p.evaluate(() => {
      const f = document.querySelector('[class*="searchField"]')?.getBoundingClientRect()
      const c = document.querySelector('[class*="count"]')?.getBoundingClientRect()
      return {
        fieldW: Math.round(f?.width ?? -1),
        // 计数是否被挤到下一行（判断依据：它顶边明显低于字段）
        countBelow: c && f ? Math.round(c.top - f.bottom) : null,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    console.log(`[${w}] 字段宽 ${info.fieldW} | 计数相对字段底 ${info.countBelow}px | 横向溢出 ${info.overflow}px`)
    await ctx.close()
  }
  await b.close()
})()
