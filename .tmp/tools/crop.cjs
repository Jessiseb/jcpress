const { chromium } = require('playwright-core')

/**
 * 元素级裁图：按 CSS 选择器截取某个元素，亮暗各一张。
 * 用法：node crop.cjs <选择器或文本> <输出前缀> [--text]
 *   node crop.cjs "#highlights-title" stats            → 截该元素所在 section
 *   node crop.cjs "拿得出手的数字" stats --text         → 按文本找 h2，再截其 section
 * 目的：判断版式细节（列宽、对齐、密度）时只看局部，比整页缩略图可靠得多。
 */
;(async () => {
  const needle = process.argv[2]
  const prefix = process.argv[3] || 'crop'
  const byText = process.argv.includes('--text')
  const out = 'C:/Users/O/Desktop/myproject/jcpress/.tmp/crops'
  const fs = require('fs')
  fs.mkdirSync(out, { recursive: true })

  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      document.documentElement.removeAttribute('data-reveal')
    }, theme)
    await page.waitForTimeout(300)

    const handle = await page.evaluateHandle((args) => {
      const [sel, text] = args
      if (!text) return document.querySelector(sel)
      const heads = Array.from(document.querySelectorAll('h1, h2, h3'))
      const hit = heads.find((h) => h.textContent.trim().includes(sel))
      return hit ? hit.closest('section') || hit : null
    }, [needle, byText])

    const el = handle.asElement()
    if (!el) {
      console.log(`✘ ${theme}: 未找到 ${needle}`)
      await ctx.close()
      continue
    }
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await el.screenshot({ path: `${out}/${prefix}-${theme}.png` })
    console.log(`✔ ${out}/${prefix}-${theme}.png`)
    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
