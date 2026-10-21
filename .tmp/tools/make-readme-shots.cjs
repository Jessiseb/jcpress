/**
 * 生成 README 用的预览图（2026-10-18）。
 *
 * 为什么要专门做一套，而不是直接复用 `.tmp/tools/shot-*.png`：
 *  ① 那些截图是**验收证据**（整屏、带动画相位、部分带滚动条），体积 300–500KB 一张，
 *     塞进仓库当展示图太重；
 *  ② README 的图要 1280 宽、压成 webp，并且必须**冻结无限动画**——否则每次重拍，
 *     流线相位都不一样，diff 里全是噪点。
 *
 * 输出到 `docs/assets/`（这是仓库正式资源目录，不是临时区）。
 * 转码借 Chromium 自带编码器，零新依赖（本机没有 sharp / Pillow）。
 *
 * 用法：node .tmp/tools/make-readme-shots.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const OUT = path.resolve(__dirname, '../../docs/assets')

/** 无限动画的帧冻结：与 shot-final.cjs 同一套做法，保证每次拍出来一样 */
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

/** 把一张图（Buffer）转成指定宽度的 webp，返回 base64 */
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
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const helper = await browser.newPage()
  const rows = []

  const write = async (name, buf, maxWidth = 1280, quality = 0.82) => {
    const r = await toWebp(helper, buf, maxWidth, quality)
    const file = path.join(OUT, `${name}.webp`)
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    rows.push(`${name}.webp  ${r.w}×${r.h}  ${kb}KB`)
    return file
  }

  // ── 站点截图：首页亮 / 暗、技术分享详情 ──
  const shots = [
    ['home-light', '/', 'light'],
    ['home-dark', '/', 'dark'],
    ['tech-detail-light', '/tech/phase-3-backend-retro', 'light'],
    ['tech-list-light', '/tech', 'light'],
  ]
  for (const [name, route, scheme] of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    // 入场动画跑完 + 字体到位，否则会拍到半透明的中间态
    await page.waitForTimeout(1400)
    await freezeFlowFrame(page)
    await page.waitForTimeout(200)
    const buf = await page.screenshot({ fullPage: false })
    await write(name, buf)
    await ctx.close()
  }

  // ── 后台：AI 排版对比面板（这张要登录态，直接用当时带 token 截的验收图转码）──
  const aiSrc = path.join(__dirname, 'shot-ai-panel-light.png')
  if (fs.existsSync(aiSrc)) {
    await write('admin-ai-format', fs.readFileSync(aiSrc), 1174, 0.85)
  } else {
    console.log('⚠ 没找到 shot-ai-panel-light.png，跳过后台截图')
  }

  console.log(rows.map((r) => `✔ ${r}`).join('\n'))
  const total = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith('.webp'))
    .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0)
  console.log(`\n合计 ${(total / 1024).toFixed(0)}KB → ${OUT}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
