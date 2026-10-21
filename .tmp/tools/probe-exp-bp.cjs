const { chromium } = require('playwright-core')
const main = async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const w of [1440, 1280, 1200, 1100, 1024, 960, 900]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } })
    const p = await ctx.newPage()
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(800)
    const photo = await p.locator('[data-photo]').boundingBox()
    const plate = await p.locator('[data-plate]').boundingBox()
    const body = await p.locator('article').first().boundingBox()
    console.log(`${w}px: 照片宽${Math.round(photo.width)} 高${Math.round(photo.height)} | 信息板${Math.round(plate.height)} | 右栏${Math.round(body.height)} | 板占左栏 ${Math.round((plate.height / body.height) * 100)}%`)
    await ctx.close()
  }
  await b.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
