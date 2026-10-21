/**
 * 本地图片 → webp（零新依赖：借 Chromium 自带的 webp 编码器）。
 *
 * 为什么不用 sharp / Pillow：本机 EDR 拦 esbuild 那类原生子进程，npm 装 sharp 大概率
 * 拿不到原生二进制；Pillow 也没装。而 playwright-core + msedge 本来就在用，
 * Chromium 内置 webp 编码，`canvas.toBlob('image/webp', q)` 就够用。
 *
 * 用法：
 *   node .tmp/tools/make-company-photo.cjs <源图> <输出> [长边上限] [质量]
 * 例：
 *   node .tmp/tools/make-company-photo.cjs "E:/.../cvte.jpg" frontend/public/companies/cvte.webp 1080 0.82
 *
 * 只缩不放：源图长边小于上限时保持原样，避免插值放大出虚边。
 * `imageOrientation: 'from-image'` 是必须的 —— 手机 / 微信转存的 JPEG 常带 EXIF 旋转，
 * 不读它会把照片转错 90°（而且只在某些图片上出现，很难第一眼发现）。
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const [src, out, maxEdgeArg, qualityArg] = process.argv.slice(2)
if (!src || !out) {
  console.error('用法：node .tmp/tools/make-company-photo.cjs <源图> <输出> [长边上限] [质量]')
  process.exit(1)
}
const maxEdge = Number(maxEdgeArg) || 1080
const quality = Number(qualityArg) || 0.82

const main = async () => {
  const buf = fs.readFileSync(src)
  const before = fs.statSync(src).size
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`

  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto('about:blank')

  const result = await page.evaluate(
    async ({ dataUrl, maxEdge, quality }) => {
      const blob = await (await fetch(dataUrl)).blob()
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      const source = { w: bitmap.width, h: bitmap.height }
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)

      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      // webp 无 alpha 需求时铺白底可避免透明区变黑（JPEG 源本来也没透明，保险起见）
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()

      const outBlob = await canvas.convertToBlob({ type: 'image/webp', quality })
      const ab = await outBlob.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(ab)
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])

      return {
        source,
        written: { w, h },
        base64: btoa(bin),
        bytes: bytes.length,
      }
    },
    { dataUrl, maxEdge, quality },
  )

  await browser.close()

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(result.base64, 'base64'))
  const after = fs.statSync(out).size

  console.log(`源图 ${result.source.w}×${result.source.h} · ${(before / 1024).toFixed(0)}KB`)
  console.log(
    `输出 ${result.written.w}×${result.written.h} · ${(after / 1024).toFixed(0)}KB → ${out}`,
  )
  console.log(`压缩到原来的 ${((after / before) * 100).toFixed(0)}%`)
}

main().catch((e) => {
  console.error('处理失败：', e)
  process.exit(1)
})
