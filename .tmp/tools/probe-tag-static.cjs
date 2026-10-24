const { chromium } = require('playwright-core')
const envelope = (d) => JSON.stringify({ code: 0, message: 'ok', data: d, traceId: null })

const detail = {
  id: '1', title: 'Redis 分布式锁的三个坑', slug: 'redis-lock', summary: '摘要',
  coverUrl: null, categoryName: 'Java 后端', categorySlug: 'java',
  tags: [{ name: 'Redis', slug: 'redis' }, { name: '并发', slug: 'concurrency' }],
  readingMinutes: 8, viewCount: 12, top: 0, publishTime: '2026-10-20 09:00:00', type: 'TECH',
  contentMd: '## 一、起因\n\n正文段落。\n', prev: null, next: null,
}
const body = envelope(detail)

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }))
  await p.goto('http://127.0.0.1:8099/tech/redis-lock?q=redis', { waitUntil: 'domcontentloaded' })
  await p.getByText('次阅读').waitFor({ timeout: 20000 })
  await p.waitForTimeout(300)

  const before = p.url()
  const info = await p.evaluate(() => {
    // 注意：`[class*="tag"]` 会先命中 .tags 容器（类名里也有 tag），
    // 所以取容器下的 span 才是真正的标签
    const spans = [...document.querySelectorAll('[class*="tags"] > span')]
    const tag = spans[0]
    const cs = getComputedStyle(tag)
    return {
      tagName: tag.tagName,
      href: tag.getAttribute('href'),
      cursor: cs.cursor,
      bg: cs.backgroundColor,
      color: cs.color,
      active: tag.getAttribute('data-active'),
      count: spans.length,
      all: spans.map((el) => ({ text: el.textContent, active: el.getAttribute('data-active'), bg: getComputedStyle(el).backgroundColor })),
    }
  })
  console.log(`标签：<${info.tagName.toLowerCase()}> href=${info.href} cursor=${info.cursor} 共 ${info.count} 个`)
  for (const t of info.all) console.log(`  「${t.text}」底 ${t.bg} | 高亮 ${t.active ?? '否'}`)

  // 点一下：URL 不能变、不能跳页
  await p.locator('[class*="tags"] > span').first().click()
  await p.waitForTimeout(500)
  console.log(`点击后 URL 变化：${p.url() === before ? '无（正确）' : '跳到了 ' + p.url()}`)

  // 悬停：底色不该再变（没有动作就别给反馈）
  await p.locator('[class*="tags"] > span').last().hover()
  await p.waitForTimeout(300)
  const after = await p.evaluate(() => {
    const spans = [...document.querySelectorAll('[class*="tags"] > span')]
    return getComputedStyle(spans[spans.length - 1]).backgroundColor
  })
  console.log(`悬停「并发」底色 → ${after}（应为浅底、不该变）`)

  // 命中高亮仍在：实底那个应该是 accent-bg
  const activeBg = await p.evaluate(() => {
    const el = document.querySelector('[data-active="true"]')
    return el ? { bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color } : null
  })
  console.log(`高亮标签：${activeBg ? `${activeBg.bg} / 字 ${activeBg.color}` : '没有'}`)
  await p.screenshot({ path: '.tmp/p4/tags-static.png', clip: { x: 240, y: 150, width: 820, height: 220 } })
  await b.close()
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
