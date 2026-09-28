const { chromium } = require('playwright-core')

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(700)

  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    const step = 300
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 90))
    }
    window.scrollTo(0, document.body.scrollHeight)
    await new Promise((r) => setTimeout(r, 900))
  })

  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[data-reveal]'))
    const missing = all.filter((el) => !el.classList.contains('is-revealed'))
    return {
      total: all.length,
      missing: missing.map((el) => ({
        tag: el.tagName,
        cls: String(el.className).slice(0, 60),
        text: (el.textContent || '').trim().slice(0, 40),
        opacity: getComputedStyle(el).opacity,
        rect: el.getBoundingClientRect().toJSON(),
      })),
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
