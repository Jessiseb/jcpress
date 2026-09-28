const { chromium } = require('playwright-core')

/** 诊断：滚一遍之后，列出所有没有拿到 .is-revealed 的 [data-reveal] 元素 */
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(700)

  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 80))
    }
    window.scrollTo(0, document.body.scrollHeight)
    await new Promise((r) => setTimeout(r, 800))
  })

  const missed = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-reveal]'))
      .filter((el) => el.tagName !== 'HTML' && !el.classList.contains('is-revealed'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          cls: String(el.className).slice(0, 60),
          tag: el.tagName,
          rect: { top: Math.round(r.top), h: Math.round(r.height) },
          position: cs.position,
          parent: el.parentElement ? String(el.parentElement.className).slice(0, 40) : null,
        }
      }),
  )

  console.log(JSON.stringify(missed, null, 2))
  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
