const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

/**
 * 展示字字符表收集（二期 phase-2-visual 新增）。
 *
 * 为什么需要单独一张表：二期给展示字加了 **700 一档真字重**，而 700 子集只打包
 * 「会以 700 渲染的字」。如果 700 档漏了某个展示字，浏览器会为那个字回落到 500 档，
 * 于是**同一行标题里出现两档字重** —— 看起来就是「发糊」（这正是阶段 11 的根因形态）。
 *
 * 收集范围：所有路由的 `h1` / `h2`，以及带 `[data-display]` 的元素
 * （关键数字等非标题的展示字宿主）。它们就是 global.css / 组件里被设为 700 的那批。
 *
 * 与 collect-charset.cjs 的分工：
 *   collect-charset.cjs          → 全站正文（500 档，531 字，覆盖一切文字）
 *   collect-display-charset.cjs  → 只有展示字（700 档，通常几十字）
 *
 * 前置：dev server 在 5173 上跑着。
 * 用法：npm run fonts:chars:display  → 写 frontend/.tmp/fonts/chars-display.txt
 */

const ROUTES = ['/', '/tech', '/algo', '/projects', '/no-such-page']
const BASE = process.env.FONT_PROBE_BASE || 'http://127.0.0.1:5173'

const isWanted = (cp) =>
  (cp >= 0x3000 && cp <= 0x303f) ||
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0xff00 && cp <= 0xffef) ||
  cp === 0x2018 ||
  cp === 0x2019 ||
  cp === 0x201c ||
  cp === 0x201d ||
  cp === 0x2026

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const chars = new Set()
  const seen = []

  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    // 与全量收集一致：摘掉入场隐藏态、展开折叠面板，保证展示字真的在 DOM 里
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-reveal')
      document.querySelectorAll('button[aria-expanded="false"]').forEach((b) => b.click())
    })
    await page.waitForTimeout(300)

    const texts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, [data-display]')).map((el) =>
        el.textContent.trim(),
      ),
    )

    for (const text of texts) {
      if (text) seen.push(`${route} ${text}`)
      for (const ch of text) {
        if (isWanted(ch.codePointAt(0))) chars.add(ch)
      }
    }
    await ctx.close()
    console.log(`✔ ${route}（展示字节点 ${texts.length} 个）`)
  }

  await browser.close()

  const list = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  const outDir = path.resolve(__dirname, '../.tmp/fonts')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'chars-display.txt'), list.join(''), 'utf8')
  fs.writeFileSync(path.join(outDir, 'chars-display.sources.txt'), seen.join('\n'), 'utf8')
  console.log(`\n展示字唯一中文字符：${list.length} 个 → frontend/.tmp/fonts/chars-display.txt`)
  console.log(`采集来源清单 → frontend/.tmp/fonts/chars-display.sources.txt`)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
