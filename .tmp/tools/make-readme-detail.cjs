/** 重拍 README 的技术分享详情页（2026-10-21，版式已改：页内目录进左栏、正文 828px） */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const OUT = path.resolve(__dirname, '../../docs/assets')

async function toWebp(page, buf, maxWidth, q) {
  const b64 = buf.toString('base64')
  return page.evaluate(async ([data, maxW, quality]) => {
    const img = new Image()
    img.src = `data:image/png;base64,${data}`
    await img.decode()
    const s = Math.min(1, maxW / img.naturalWidth)
    const w = Math.round(img.naturalWidth * s)
    const h = Math.round(img.naturalHeight * s)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    const url = c.toDataURL('image/webp', quality)
    return { b64: url.slice(url.indexOf(',') + 1), w, h }
  }, [b64, maxWidth, q])
}

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const helper = await browser.newPage()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tech/phase-3-backend-retro`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1600)
  const buf = await page.screenshot({ fullPage: false })
  const r = await toWebp(helper, buf, 1280, 0.82)
  const file = path.join(OUT, 'tech-detail-light.webp')
  fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
  console.log(`tech-detail-light.webp  ${r.w}×${r.h}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
