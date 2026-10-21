const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const OUT = process.argv[2]
;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const c of [
    { name: 'home-error-desktop', w: 1280, h: 900, scheme: 'light' },
    { name: 'home-error-mobile', w: 390, h: 844, scheme: 'light' },
  ]) {
    const ctx = await b.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    await p.route('**/api/**', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502</body></html>' }))
    await p.goto('http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('[data-block="latest-articles"] [role="alert"]', { timeout: 15000 }).catch(() => null)
    // 让入场序列走完：把整页滚一遍（关掉平滑滚动，否则程序化滚动会变成动画滚不到底）
    await p.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto'
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
    })
    await p.waitForTimeout(600)
    const el = await p.$('[data-block="latest-articles"]')
    if (el) {
      await el.scrollIntoViewIfNeeded()
      await p.waitForTimeout(400)
      await el.screenshot({ path: path.join(OUT, c.name + '.png') })
    }
    console.log(c.name, '→', await p.evaluate(() => document.querySelector('[data-block="latest-articles"] [role="alert"]')?.innerText.replace(/\n+/g, ' | ') ?? 'none'))
    await ctx.close()
  }
  await b.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
