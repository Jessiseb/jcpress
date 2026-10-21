/**
 * 「实习经历」照片的**可见边界余量**探针（2026-10-16）。
 *
 * 回答一个问题：`object-fit: cover` 把 1:1 的照片塞进竖长的左栏之后，那排 logo
 * 离可见区的左右边缘还剩多少像素 —— 余量太薄，换一张构图稍偏的照片就会切字。
 *
 * 为什么必须做像素级复现而不是看截图：上一版 CSS 注释里的「两侧各留约 78px」是手算错的
 * （同一段还写出过 x 上界 1133 > 原图宽 1080）。而 400 多像素宽的缩略图目测，
 * 误差比余量本身还大。
 *
 * 做法：
 *   ① `LOGO_SAFE` 是那排 logo 在原图上的外接矩形，来源是 `probe-logo-bounds.cjs`
 *      的像素扫描 + 原图目测核对：CVTE 红标 y 285–420 居中偏左，MAXHUB 与
 *      seewo 希沃同处一排 y 455–545，最左是 MAXHUB 的 M（x 185），最右是「沃」（x 875）。
 *   ② 每个视口都真实切一遍 viewport，取 [data-photo] 与 [data-plate] 的实际尺寸。
 *   ③ 按 cover 规则（scale = max(Wc/W, Hc/H)，居中）把可见区映射回原图坐标。
 *   ④ 断言 logo 安全区完整落在可见区内，且左右余量 ≥ 20px。
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SRC = '/companies/cvte.webp'
const IMG = { w: 1080, h: 1080 }

// 整排公司 logo 在原图上的外接矩形（像素）
// 来源：`probe-logo-bounds.cjs` 的像素扫描 —— 红标 CVTE x 448–679 / y 292–393、
// 蓝字 seewo 希沃 x 616–876 / y 493–554 都是脚本直接量出来的；
// 最左的 MAXHUB 是中性深灰，靠该脚本的「深灰分箱」定到 x 180（180 箱 10 列、200 箱满列）。
const LOGO_SAFE = { x: [180, 876], y: [292, 554] }
const MIN_MARGIN = 20

const VIEWPORTS = [
  [1280, 900],
  [1024, 900],
  [768, 900],
  [390, 844],
]

/** 在浏览器里按 cover 规则复现裁切，并把可见区映射回原图坐标 */
const MEASURE = () => {
  const el = document.querySelector('[data-photo]')
  if (!el) return null
  const plate = el.querySelector('[data-plate]')
  const box = el.getBoundingClientRect()
  const plateH = plate ? plate.getBoundingClientRect().height : 0
  return {
    box: { w: Math.round(box.width), h: Math.round(box.height) },
    plateH: Math.round(plateH),
  }
}

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })

  let bad = 0
  for (const [vw, vh] of VIEWPORTS) {
    await page.setViewportSize({ width: vw, height: vh })
    await page.evaluate(() => document.querySelector('[data-photo]')?.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(600)

    const m = await page.evaluate(MEASURE)
    if (!m) {
      console.log(`${vw}×${vh}  找不到 [data-photo]`)
      bad += 1
      continue
    }

    const { w: Wc, h: Hc } = m.box
    const scale = Math.max(Wc / IMG.w, Hc / IMG.h)
    const srcW = Wc / scale
    const srcH = Hc / scale
    const sx = (IMG.w - srcW) / 2
    const sy = (IMG.h - srcH) / 2
    // 底部被那条不透明带压住的部分，换算回原图坐标
    const visBottom = sy + srcH * (1 - m.plateH / Hc)

    const visible = { x: [sx, sx + srcW], y: [sy, visBottom] }
    const marginLeft = Math.round(LOGO_SAFE.x[0] - visible.x[0])
    const marginRight = Math.round(visible.x[1] - LOGO_SAFE.x[1])
    const coverX = marginLeft >= 0 && marginRight >= 0
    const coverY = visible.y[0] <= LOGO_SAFE.y[0] && visible.y[1] >= LOGO_SAFE.y[1]
    // 最少一侧的余量（判定用这个）
    const worst = Math.min(marginLeft, marginRight)
    const ok = coverX && coverY && worst >= MIN_MARGIN
    if (!ok) bad += 1

    console.log(
      `${String(vw).padStart(4)}×${vh}  框 ${Wc}×${Hc} 不透明带 ${m.plateH}  ` +
        `可见原图 x ${Math.round(visible.x[0])}–${Math.round(visible.x[1])} y ${Math.round(visible.y[0])}–${Math.round(visible.y[1])}  ` +
        `余量 左 ${marginLeft} / 右 ${marginRight} 比对 ${worst}(需≥${MIN_MARGIN})  ` +
        `${ok ? '✔' : `✘ x=${coverX} y=${coverY}`}`,
    )
  }

  console.log(bad === 0 ? '\n✔ 全部视口：logo 安全区完整，左右余量达标' : `\n✘ ${bad} 个视口不达标`)
  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
