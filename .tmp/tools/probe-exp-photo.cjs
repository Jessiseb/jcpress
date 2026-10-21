/**
 * 量「实习经历」照片容器的真实渲染尺寸（2026-10-16，换真实公司照片前先量）。
 *
 * 为什么要量而不是照抄代码里的 560×840：`width/height` 属性只是比例占位，
 * 真实框长什么样由 `.switcher` 的栅格 + 内容高度共同决定，而照片是 `object-fit: cover`——
 * 喂错比例就白裁掉一批像素（右侧的 seewo 字样首当其冲）。
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const VIEWPORTS = [
  [1280, 900],
  [1024, 900],
  [768, 900],
  [390, 844],
]

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
    // 滚到实习区块再量：不入场的话 data-reveal 还带着位移
    await page.evaluate(() => {
      document.querySelector('[data-photo]')?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(900)
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-photo]')
      if (!el) return null
      const box = el.getBoundingClientRect()
      const img = el.querySelector('img')
      const ib = img ? img.getBoundingClientRect() : null
      const plate = el.querySelector('[data-plate]')
      const pb = plate ? plate.getBoundingClientRect() : null
      return {
        box: { w: Math.round(box.width), h: Math.round(box.height) },
        ratio: +(box.width / box.height).toFixed(3),
        img: ib ? { w: Math.round(ib.width), h: Math.round(ib.height) } : null,
        /* 底部那条不透明带的高度，以及留给照片的可见高度。
           水平裁切只由 box 的宽高比决定（.visualPhoto 是 absolute inset:0 铺满整个左栏），
           但**垂直方向**有多少被这条带压住，直接决定照片露出来多少。 */
        plateH: pb ? Math.round(pb.height) : null,
        photoH: pb ? Math.round(box.height - pb.height) : null,
        photoShare: pb ? +((box.height - pb.height) / box.height).toFixed(3) : null,
        src: img ? img.currentSrc || img.src : null,
        natural: img ? `${img.naturalWidth}×${img.naturalHeight}` : null,
      }
    })
    console.log(`${w}×${h} →`, JSON.stringify(r))
    await ctx.close()
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
