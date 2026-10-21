/**
 * 定位 `public/companies/*.webp` 里公司 logo 的像素边界（2026-10-16）。
 *
 * 用途：换公司照片之后重跑一次，把输出填回 `probe-photo-margins.cjs` 的 `LOGO_SAFE`。
 * 那个安全区是「照片不许被裁掉的部分」——本探针负责量它，那个探针负责判定裁没裁到。
 *
 * 判据（第一版用「亮度 < 110」是错的：照片本身的墙面色阶、玻璃暗角大片低于这个阈值，
 * 扫出来每一段都是 x 0–1079，等于什么都没定位到）。改成认**彩色**：
 *   · 红：CVTE 标  r-g > 50 且 r-b > 40
 *   · 蓝：seewo 字  b-r > 40 且 b > 90
 * 墙面花纹是中性灰（三通道接近）、暗角也是灰，都落不进这两个判据。
 * MAXHUB 是深灰中性色，色彩上分不出来，所以它的左边界靠人工在原图上核对 ——
 * 本探针会先把红/蓝两块测准，人工再补上 MAXHUB（它是整排里最靠左的）。
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SRC = process.argv[2] || '/companies/cvte.webp'

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const r = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const W = img.naturalWidth
    const H = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, W, H).data

    const scan = (test, yRange) => {
      const [yFrom, yTo] = yRange
      let xMin = W
      let xMax = -1
      let yMin = H
      let yMax = -1
      let total = 0
      // 按列统计，要求每列至少 3 个命中像素 —— 单点噪点不算
      const colHit = new Array(W).fill(0)
      for (let y = yFrom; y < yTo; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = (y * W + x) * 4
          const p = [d[i], d[i + 1], d[i + 2]]
          if (!test(p)) continue
          colHit[x] += 1
          if (x < xMin) xMin = x
          if (x > xMax) xMax = x
          if (y < yMin) yMin = y
          if (y > yMax) yMax = y
          total += 1
        }
      }
      // 去掉只有零星命中的列后重算 x 范围
      let solidMin = W
      let solidMax = -1
      for (let x = 0; x < W; x += 1) {
        if (colHit[x] >= 3) {
          if (x < solidMin) solidMin = x
          if (x > solidMax) solidMax = x
        }
      }
      return { total, x: [xMin, xMax], xSolid: [solidMin, solidMax], y: [yMin, yMax] }
    }

    return {
      size: `${W}×${H}`,
      red: scan(([r, g, b]) => r - g > 50 && r - b > 40, [200, 700]),
      /* 蓝色必须限 y：照片左下 / 右下各有一只蓝色喇叭（y 780 往下），
         不限高的话 seewo 的 x 范围会被喇叭撑到 84–1069，等于没量到。 */
      blue: scan(([r, g, b]) => b - r > 40 && b > 90, [200, 700]),
      /* MAXHUB 是中性深灰，只能用亮度。限在它所在那一行带（y 430–570）：
         这个带里的暗块只有 MAXHUB 和右侧的玻璃幕墙，玻璃在 x 900 以外，
         所以**左边界**是可信的（右边界不可信，要以上面的 blue.xSolid[1] 为准）。 */
      dark: scan(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b < 105 && Math.max(r, g, b) - Math.min(r, g, b) < 45, [430, 570]),
      /* 但上面这条判据在这个带上会被照片左侧的墙缝阴影污染（x=0 就有命中），
         所以再给一份**分箱**：每 20px 一箱，统计「该列命中像素 ≥ 8」（= 笔画级粗块，
         墙缝阴影到不了这个数）。M 的左缘就是第一个进入高箱的 x。 */
      darkBins: (() => {
        const yFrom = 430
        const yTo = 570
        const colHit = new Array(W).fill(0)
        for (let y = yFrom; y < yTo; y += 1) {
          for (let x = 0; x < W; x += 1) {
            const i = (y * W + x) * 4
            const r = d[i]
            const g = d[i + 1]
            const b = d[i + 2]
            if (0.299 * r + 0.587 * g + 0.114 * b < 105 && Math.max(r, g, b) - Math.min(r, g, b) < 45) colHit[x] += 1
          }
        }
        const bins = []
        for (let x0 = 0; x0 < W; x0 += 20) {
          let cols = 0
          let peak = 0
          for (let x = x0; x < Math.min(x0 + 20, W); x += 1) {
            if (colHit[x] >= 8) cols += 1
            if (colHit[x] > peak) peak = colHit[x]
          }
          bins.push({ x0, cols, peak })
        }
        return bins
      })(),
    }
  }, SRC)

  console.log(`${SRC}  ${r.size}`)
  for (const [name, s] of [
    ['红（CVTE 标）', r.red],
    ['蓝（seewo 字）', r.blue],
    ['深灰（MAXHUB，仅左边界可信）', r.dark],
  ]) {
    console.log(
      `${name}  像素 ${String(s.total).padStart(6)}  x ${s.x[0]}–${s.x[1]}（≥3 像素/列 ${s.xSolid[0]}–${s.xSolid[1]}）  y ${s.y[0]}–${s.y[1]}`,
    )
  }
  console.log('\nMAXHUB 左缘（y 430–570 带内每 20px 的「笔画级列」数，cols≥8 表示这一箱进入文字区）：')
  const line = r.darkBins
    .filter((b) => b.peak >= 3)
    .map((b) => `${b.x0}:${b.cols}`)
    .join('  ')
  console.log(line || '（无）')
  console.log('\nMAXHUB 是中性深灰，色彩判据抓不到 —— 它是整排最靠左的一块，左边界看上面第一个 cols 拉满的箱。')
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
