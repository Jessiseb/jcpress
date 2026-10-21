const { chromium } = require('playwright-core')
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const w of [320, 375, 390, 768, 1024, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } })
    const p = await ctx.newPage()
    await p.route('**/api/**', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502</body></html>' }))
    for (const url of ['/tech', '/', '/tech/nope']) {
      await p.goto('http://127.0.0.1:5175' + url, { waitUntil: 'domcontentloaded' })
      await p.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null)
      await p.waitForTimeout(400)
      const r = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      console.log(`${String(w).padEnd(5)} ${url.padEnd(12)} scrollWidth=${r.sw} clientWidth=${r.cw} ${r.sw > r.cw ? 'OVERFLOW!' : 'ok'}`)
    }
    await ctx.close()
  }
  await b.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
