/**
 * 把用户手动截的后台图处理成 README 用的 webp（2026-10-21）。
 *
 * 原图 1913×939（高 DPI 截屏），有三处不属于页面的浮层，都要清掉：
 *  ① 右侧粉色 AI 浮球（约 x1860–1904 / y330–375），压在表格右边界上
 *     → 逐列从左侧干净列（x=1844）复制；表格之外的列从页面底色列（x=1908）复制
 *  ② 右下白色圆形浮窗，压在分页条右边 → 连同分页条一起裁掉（裁到 y=690）
 *  ③ 更下方的截图工具悬浮条（y≥857）→ 同一刀裁掉
 *
 * 用法：node .tmp/tools/make-readme-admin-shot.cjs <输入png>
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const SRC = process.argv[2]
const OUT = path.resolve(__dirname, '../../docs/assets/admin-articles.webp')
const CROP_H = 670
const MAX_W = 1600

const main = async () => {
  if (!SRC || !fs.existsSync(SRC)) {
    console.error('输入图不存在: ' + SRC)
    process.exit(2)
  }
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64')
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const out = await page.evaluate(
    async ([url, cropH, maxW]) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const W = img.naturalWidth
      const H = Math.min(cropH, img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, W, H, 0, 0, W, H)
      const data = g.getImageData(0, 0, W, H)
      const px = data.data

      // ① 自动找粉球：右上区域里偏粉的像素
      let x1 = W, x2 = 0, y1 = H, y2 = 0
      for (let y = 250; y < 450; y++) {
        for (let x = Math.floor(W * 0.93); x < W; x++) {
          const i = (y * W + x) * 4
          const r = px[i], gg = px[i + 1], b = px[i + 2]
          if (r > 225 && r - gg > 25 && b - gg > 8) {
            if (x < x1) x1 = x
            if (x > x2) x2 = x
            if (y < y1) y1 = y
            if (y > y2) y2 = y
          }
        }
      }
      const patch = x1 <= x2 ? { x1: x1 - 8, x2: Math.min(W - 1, x2 + 8), y1: y1 - 8, y2: y2 + 8 } : null

      if (patch) {
        const EDGE = 1894 // 表格卡片右边界，右侧是页面底色
        const CARD_X = 1844 // 表格内、浮层左边的干净列
        const BG_X = 1908 // 表格外的页面底色列
        /** 把 srcX 那一列整列复制到 [xFrom, xTo] 的每一列 */
        const fill = (srcX, xFrom, xTo, yFrom, yTo) => {
          for (let x = xFrom; x <= xTo; x++) {
            for (let y = yFrom; y <= yTo; y++) {
              const s = (y * W + srcX) * 4
              const d = (y * W + x) * 4
              px[d] = px[s]
              px[d + 1] = px[s + 1]
              px[d + 2] = px[s + 2]
              px[d + 3] = 255
            }
          }
        }
        fill(CARD_X, patch.x1, Math.min(EDGE - 1, patch.x2), patch.y1, patch.y2)
        if (patch.x2 >= EDGE) fill(BG_X, EDGE, patch.x2, patch.y1, patch.y2)
      }
      g.putImageData(data, 0, 0)

      const s = Math.min(1, maxW / W)
      const w = Math.round(W * s)
      const h = Math.round(H * s)
      const c2 = document.createElement('canvas')
      c2.width = w
      c2.height = h
      const g2 = c2.getContext('2d')
      g2.imageSmoothingQuality = 'high'
      g2.drawImage(c, 0, 0, W, H, 0, 0, w, h)
      const webp = c2.toDataURL('image/webp', 0.88)
      return {
        b64: webp.slice(webp.indexOf(',') + 1),
        w, h, srcW: W, srcH: img.naturalHeight,
        patch: patch ? { ...patch } : null,
      }
    },
    [dataUrl, CROP_H, MAX_W],
  )
  fs.writeFileSync(OUT, Buffer.from(out.b64, 'base64'))
  console.log(`原图 ${out.srcW}×${out.srcH} → 处理 ${out.w}×${out.h}，粉球补丁 ${JSON.stringify(out.patch)}`)
  console.log(`${path.basename(OUT)}  ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
