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
]
const body = envelope({ list, page: 1, size: 200, total: list.length, pages: 1 })

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 780 }, deviceScaleFactor: 2 })
    await ctx.addInitScript((t) => localStorage.setItem('jcpress-theme', t), theme)
    const p = await ctx.newPage()
    await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }))
    await p.goto('http://127.0.0.1:8099/tech', { waitUntil: 'domcontentloaded' })
    await p.getByRole('link', { name: /Redis 分布式锁/ }).waitFor({ timeout: 20000 })
    await p.waitForTimeout(300)
    await p.screenshot({ path: `.tmp/p4/search-look-${theme}.png` })

    // 聚焦态：看那条线是不是只剩强调色
    await p.getByLabel('搜索文章').fill('redis')
    await p.waitForTimeout(350)
    await p.screenshot({ path: `.tmp/p4/search-look-${theme}-focus.png` })

    const info = await p.evaluate(() => {
      const wrap = document.querySelector('[class*="searchField"] .ant-input-affix-wrapper')
      const input = document.querySelector('[class*="searchField"] .ant-input')
      const cs = wrap ? getComputedStyle(wrap) : null
      const toolbar = document.querySelector('[class*="toolbar"]')
      const count = document.querySelector('[class*="count"]')
      return {
        border: cs ? `${cs.borderTopWidth} ${cs.borderRightWidth} ${cs.borderBottomWidth} ${cs.borderLeftWidth}` : 'n/a',
        radius: cs?.borderRadius,
        shadow: cs?.boxShadow,
        bottomColor: cs?.borderBottomColor,
        inputBg: input ? getComputedStyle(input).backgroundColor : 'n/a',
        wrapTop: Math.round(wrap?.getBoundingClientRect().top ?? -1),
        wrapBottom: Math.round(wrap?.getBoundingClientRect().bottom ?? -1),
        countText: count?.textContent?.trim(),
        countRight: count ? Math.round(count.getBoundingClientRect().right) : -1,
        rowLinkRight: Math.round(document.querySelector('[data-card]')?.getBoundingClientRect().right ?? -1),
        toolbarH: Math.round(toolbar?.getBoundingClientRect().height ?? -1),
        focusRing: cs?.outlineStyle,
      }
    })
    console.log(`[${theme}] 边框 ${info.border} | 圆角 ${info.radius} | 阴影 ${info.shadow} | 底线色 ${info.bottomColor}`)
    console.log(`        计数「${info.countText}」右端 ${info.countRight} / 目录行右端 ${info.rowLinkRight} | 工具栏高 ${info.toolbarH}`)
    await ctx.close()
  }
  await b.close()
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
