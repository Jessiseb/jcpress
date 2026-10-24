/**
 * 重拍 README 里「技术分享」那两张图（2026-10-24）。
 *
 * 为什么单独写一个，而不是跑 make-readme-shots.cjs：
 * 那个脚本会连首页亮/暗、后台 AI 面板一起重拍。这次只改了技术分享
 * （搜索框改版、标签不可点），首页没动 —— 重拍首页只会让 diff 里多两张
 * 相位不同的噪点图。
 *
 * 输出仍是 1280 宽、webp(q=0.82)，落 `docs/assets/`（正式资源目录）。
 * 转码借 Chromium 的 webp 编码器，零新依赖（本机没有 sharp / Pillow）。
 *
 * 用法：node .tmp/tools/make-readme-tech.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const OUT = path.resolve(__dirname, '../../docs/assets')

/** 无限动画的帧冻结：与 make-readme-shots.cjs 同一套做法，保证每次拍出来一样 */
async function freezeFlowFrame(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-flow] path').forEach((p, idx) => {
      p.style.animation = 'none'
      p.style.strokeDashoffset = String(-((idx * 0.37) % 1))
      p.style.strokeDasharray = '0.62 0.38'
      p.style.opacity = '0.5'
    })
  })
}

async function toWebp(page, buf, maxWidth, quality) {
  const b64 = buf.toString('base64')
  return page.evaluate(
    async ([data, maxW, q]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${data}`
      await img.decode()
      const scale = Math.min(1, maxW / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      const url = c.toDataURL('image/webp', q)
      return { b64: url.slice(url.indexOf(',') + 1), w, h }
    },
    [b64, maxWidth, quality],
  )
}

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const helper = await browser.newPage()

  // 列表页：等真实文章行出来再拍（等错选择器就会拍到空骨架）
  // 详情页：等 meta 行（「N 次阅读」）出现，说明数据到位、标签也渲染了
  //
  // `clip` 是裁剪高度。列表页内容短，900 高会把页脚「有合适的机会，随时找我」
  // 一起拍进来 —— 那是站点页脚，不是「技术分享」的内容，README 里不需要。
  const shots = [
    ['tech-list-light', '/tech', '[data-card]', 780],
    ['tech-detail-light', '/tech/phase-3-backend-retro', 'text=次阅读', null],
  ]

  for (const [name, route, ready, clipHeight] of shots) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
    })
    // 站点的主题真相在 localStorage（index.html 首帧脚本会按它写 data-theme），
    // 只设 colorScheme 不够 —— 用户上次切成暗色的话，这里会拍出暗图
    await ctx.addInitScript(() => localStorage.setItem('jcpress-theme', 'light'))
    const page = await ctx.newPage()
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector(ready, { timeout: 30000 })
    // 入场动画跑完 + 字体到位，否则会拍到半透明的中间态
    await page.waitForTimeout(1400)
    await freezeFlowFrame(page)
    await page.waitForTimeout(200)

    const buf = await page.screenshot({
      fullPage: false,
      ...(clipHeight === null ? {} : { clip: { x: 0, y: 0, width: 1280, height: clipHeight } }),
    })
    const r = await toWebp(helper, buf, 1280, 0.82)
    const file = path.join(OUT, `${name}.webp`)
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
    console.log(`✔ ${name}.webp  ${r.w}×${r.h}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
    await ctx.close()
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
