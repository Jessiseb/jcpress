/**
 * 白底 logo → 1:1 方图（webp），供「实习经历」缩略图用。
 *
 * 为什么需要这一步：缩略图框是 1:1 + object-fit: cover（CVTE 那张原图就是
 * 1080×1080 方图，框的比例由它定）。用友是横排 logo、三和是竖排 logo，
 * 直接塞进方框会被 cover 切掉两端。所以先把四周白边裁掉，再把 logo 居中
 * 放进方形白色画布 —— cover 之后一个像素都不裁。
 *
 * 与 make-company-photo.cjs 一样，借 Chromium 自带的 webp 编码器，零新依赖
 * （本机 EDR 拦原生子进程，sharp 装不上；Pillow 也没装）。
 *
 * 用法：
 *   node .tmp/tools/make-company-logo.cjs <源图> <输出> [边长] [质量] [留白比例] [--dry]
 * 例：
 *   node .tmp/tools/make-company-logo.cjs yonyou.png frontend/public/companies/yonyou.webp 640 0.9 0.08
 *
 * `--dry` 只打印量到的内容边界，不落盘 —— 白底裁边最怕阈值定错，
 * 先看一眼框合不合理再写文件。
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const args = process.argv.slice(2).filter((a) => a !== '--dry')
const dry = process.argv.includes('--dry')
const [src, out, edgeArg, qualityArg, padArg] = args

if (!src || !out) {
  console.error('用法：node .tmp/tools/make-company-logo.cjs <源图> <输出> [边长] [质量] [留白比例] [--dry]')
  process.exit(1)
}
const edge = Number(edgeArg) || 640
const quality = Number(qualityArg) || 0.9
const pad = Number(padArg) || 0.08

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

const main = async () => {
  const buf = fs.readFileSync(src)
  const mime = MIME[path.extname(src).toLowerCase()] || 'image/png'
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto('about:blank')

  const result = await page.evaluate(
    async ({ dataUrl, edge, quality, pad }) => {
      const blob = await (await fetch(dataUrl)).blob()
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      const w = bitmap.width
      const h = bitmap.height

      const flat = new OffscreenCanvas(w, h)
      const fctx = flat.getContext('2d', { willReadFrequently: true })
      fctx.drawImage(bitmap, 0, 0)
      const px = fctx.getImageData(0, 0, w, h).data

      // 判定「墨」：亮度低于 235 且不是全透明像素。白底 255，
      // 用友那个灰色 yonyou 约 128、三和的蓝约 150，离阈值都很远。
      const ink = (x, y) => {
        const i = (y * w + x) * 4
        if (px[i + 3] < 16) return false
        return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 235
      }

      // 按行 / 列统计，而不是「扫到第一个非白像素就停」——
      // 压缩噪点和截图边缘的 1px 灰线会把框撑满整张图。
      const rowMin = Math.max(2, Math.round(w * 0.002))
      const colMin = Math.max(2, Math.round(h * 0.002))
      let top = -1
      let bottom = -1
      let left = -1
      let right = -1
      for (let y = 0; y < h; y += 1) {
        let n = 0
        for (let x = 0; x < w; x += 1) if (ink(x, y)) n += 1
        if (n >= rowMin) {
          if (top < 0) top = y
          bottom = y
        }
      }
      for (let x = 0; x < w; x += 1) {
        let n = 0
        for (let y = 0; y < h; y += 1) if (ink(x, y)) n += 1
        if (n >= colMin) {
          if (left < 0) left = x
          right = x
        }
      }
      if (top < 0 || left < 0) throw new Error('整张图都是白的，没找到内容边界')

      const cw = right - left + 1
      const ch = bottom - top + 1

      // 方形画布边长：内容占 (1 - 2pad)，不超过 edge，并取偶数（retina 缩放不糊）
      const size = Math.min(edge, Math.round(Math.max(cw, ch) / (1 - 2 * pad) / 2) * 2)

      const outCanvas = new OffscreenCanvas(size, size)
      const octx = outCanvas.getContext('2d')
      octx.imageSmoothingEnabled = true
      octx.imageSmoothingQuality = 'high'
      octx.fillStyle = '#ffffff'
      octx.fillRect(0, 0, size, size)

      const k = Math.min((size * (1 - 2 * pad)) / cw, (size * (1 - 2 * pad)) / ch)
      const dw = cw * k
      const dh = ch * k
      octx.drawImage(bitmap, left, top, cw, ch, (size - dw) / 2, (size - dh) / 2, dw, dh)
      bitmap.close()

      const outBlob = await outCanvas.convertToBlob({ type: 'image/webp', quality })
      const ab = await outBlob.arrayBuffer()
      const bytes = new Uint8Array(ab)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])

      return {
        source: { w, h },
        box: { left, top, right, bottom, cw, ch },
        size,
        scale: k,
        base64: btoa(bin),
        bytes: bytes.length,
      }
    },
    { dataUrl, edge, quality, pad },
  )

  await browser.close()

  const { source, box, size, scale } = result
  console.log(`源图 ${source.w}×${source.h}`)
  console.log(
    `内容框 x ${box.left}…${box.right} / y ${box.top}…${box.bottom} → ${box.cw}×${box.ch}` +
      `（占源宽 ${((box.cw / source.w) * 100).toFixed(0)}%，高 ${((box.ch / source.h) * 100).toFixed(0)}%）`,
  )
  console.log(`输出 ${size}×${size}，内容缩放 ${scale.toFixed(2)}×`)

  if (dry) {
    console.log('（--dry：未写文件）')
    return
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(result.base64, 'base64'))
  const after = fs.statSync(out).size
  console.log(`已写入 ${out} · ${(after / 1024).toFixed(0)}KB`)
}

main().catch((e) => {
  console.error('处理失败：', e)
  process.exit(1)
})
