const { chromium } = require('playwright-core')

;(async () => {
  const out = process.argv[2]
  const width = Number(process.argv[3] || 1280)
  const height = Number(process.argv[4] || 900)
  const scheme = process.argv[5] || 'light'
  const tag = process.argv[6] || 'd'
  const sliceH = Number(process.argv[7] || 700)

  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: scheme })
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
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 500))
    document.documentElement.removeAttribute('data-reveal')
  })
  await page.waitForTimeout(200)

  const total = await page.evaluate(() => document.body.scrollHeight)
  let i = 0
  for (let y = 0; y < total; y += sliceH) {
    await page.screenshot({
      path: `${out}/${tag}-${String(i).padStart(2, '0')}.png`,
      fullPage: true,
      clip: { x: 0, y, width, height: Math.min(sliceH, total - y) },
    })
    i += 1
  }
  console.log(`${tag}: ${total}px -> ${i} slices`)
  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
