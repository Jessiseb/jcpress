const { chromium } = require('playwright-core')

;(async () => {
  const out = process.argv[2]
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  // 关闭入场动画造成的空白：滚动到底再回顶
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    const step = 300
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 90))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 600))
  })
  await page.evaluate(() => document.documentElement.removeAttribute('data-reveal'))
  await page.waitForTimeout(200)
  const total = await page.evaluate(() => document.body.scrollHeight)
  console.log('total', total)
  const h = 700
  for (let y = 600; y < total; y += h) {
    await page.screenshot({ path: `${out}/seg-${y}.png`, fullPage: true, clip: { x: 0, y, width: 1280, height: Math.min(h, total - y) } })
  }
  await browser.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
