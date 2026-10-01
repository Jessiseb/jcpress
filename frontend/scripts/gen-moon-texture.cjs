/**
 * 生成月球贴图（等距圆柱，左右无缝）。
 *
 * 为什么是「生成」而不是「下载」：
 *  · 地球贴图有公有领域的现成资产（NASA Blue Marble），月球没有同等干净的一张；
 *  · 生成的资产**可复现**：用确定性伪随机（LCG）而不是 `Math.random()`，
 *    同一条命令永远产出同一张图，才能进版本库（与 FlowField 的「确定性错峰」同一条纪律）；
 *  · 零外部依赖 —— 用项目里已有的 playwright-core 把一段 SVG 渲染成 JPEG。
 *
 * 用法：`node scripts/gen-moon-texture.cjs`（在 frontend/ 下执行）
 * 产物：`public/textures/moon-surface.jpg`
 */
const fs = require('node:fs')
const path = require('node:path')
// playwright-core 装在 `.tmp/tools/`（验收脚本的家），不在 frontend 的依赖里 ——
// 不为一个「偶尔跑一次」的资产生成脚本往 frontend 里再塞一份浏览器驱动。
function loadPlaywright() {
  for (const id of ['playwright-core', '../../.tmp/tools/node_modules/playwright-core']) {
    try {
      return require(id)
    } catch {
      /* 试下一个 */
    }
  }
  throw new Error('找不到 playwright-core：先跑 `cd .tmp/tools && npm install`')
}
const { chromium } = loadPlaywright()

/** 线性同余伪随机：种子固定 ⇒ 资产可复现 */
function lcg(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const W = 1024
const H = 512
const OUT = path.join(__dirname, '..', 'public', 'textures', 'moon-surface.jpg')

const rnd = lcg(20260930)

/** 月海：几块大的暗区。坐标是 0–1 的相对值，便于换尺寸 */
const MARIA = [
  { x: 0.18, y: 0.36, r: 0.13 },
  { x: 0.27, y: 0.52, r: 0.1 },
  { x: 0.42, y: 0.3, r: 0.09 },
  { x: 0.62, y: 0.46, r: 0.12 },
  { x: 0.74, y: 0.33, r: 0.08 },
  { x: 0.86, y: 0.55, r: 0.1 },
  { x: 0.08, y: 0.62, r: 0.07 },
]

/** 环形山：大小混合，越靠两极越压扁（等距圆柱在两极必然形变） */
const CRATERS = Array.from({ length: 190 }, () => {
  const y = rnd()
  const lat = (y - 0.5) * Math.PI
  return {
    x: rnd(),
    y,
    r: 0.004 + rnd() ** 2.6 * 0.052,
    squash: Math.max(0.28, Math.cos(lat)),
  }
})

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 1000 500">
  <defs>
    <radialGradient id="regolith" cx="38%" cy="30%" r="95%">
      <stop offset="0%" stop-color="#c8cbd3"/>
      <stop offset="55%" stop-color="#aaaeb9"/>
      <stop offset="100%" stop-color="#84888f"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="soft2"><feGaussianBlur stdDeviation="2.4"/></filter>
  </defs>
  <rect width="1000" height="500" fill="url(#regolith)"/>
  <g filter="url(#soft)" opacity="0.55">
    ${MARIA.map((m) => `<ellipse cx="${m.x * 1000}" cy="${m.y * 500}" rx="${m.r * 1000}" ry="${m.r * 500 * 0.78}" fill="#5f6470"/>`).join('')}
  </g>
  <g filter="url(#soft2)">
    ${MARIA.map((m) => `<ellipse cx="${m.x * 1000}" cy="${m.y * 500}" rx="${m.r * 1000 * 0.62}" ry="${m.r * 500 * 0.5}" fill="#4e535e" opacity="0.6"/>`).join('')}
  </g>
  <g>
    ${CRATERS.map((c) => {
      const cx = c.x * 1000
      const cy = c.y * 500
      const rx = c.r * 1000
      const ry = c.r * 1000 * c.squash * 0.5
      return `<g>
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#6d727d" opacity="0.9"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.82}" ry="${ry * 0.82}" fill="#9298a3" opacity="0.55"/>
        <path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}" fill="none" stroke="#e6e8ee" stroke-width="${Math.max(0.7, rx * 0.14)}" opacity="0.62"/>
        <path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" stroke="#5a5f6a" stroke-width="${Math.max(0.6, rx * 0.11)}" opacity="0.5"/>
      </g>`
    }).join('')}
  </g>
</svg>`

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    await page.setContent(`<body style="margin:0">${svg}</body>`)
    await page.waitForTimeout(300)
    const buf = await page.screenshot({ type: 'jpeg', quality: 82 })
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, buf)
    console.log(`written ${OUT} (${(buf.length / 1024).toFixed(1)}KB)`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
