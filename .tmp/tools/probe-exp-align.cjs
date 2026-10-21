const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const main = async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [w, h, tag] of [[1280, 1000, 'desktop'], [900, 900, 'tablet'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(1000)
    const sec = p.locator('section[aria-labelledby="exp-title"]')
    await sec.scrollIntoViewIfNeeded()
    await p.waitForTimeout(600)
    const tabs = p.locator('[role="tab"]')
    const n = await tabs.count()
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click()
      await p.waitForTimeout(500)
      const vis = await p.locator('[data-photo]').boundingBox()
      const plate = await p.locator('[data-plate]').boundingBox()
      const body = await p.locator('article').first().boundingBox()
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      console.log(`${tag} #${i}: 图${Math.round(vis.height)} 板${Math.round(plate.height)} 右${Math.round(body.height)} | 左列底-右列底 ${Math.round((plate.y + plate.height) - (body.y + body.height))} | 横向溢出 ${overflow}`)
    }
    if (tag !== 'mobile') {
      await p.locator('[role="tab"]').first().click()
      await p.waitForTimeout(400)
      await sec.screenshot({ path: path.resolve(__dirname, `exp-${tag}.png`) })
    }
    await ctx.close()
  }
  await b.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
