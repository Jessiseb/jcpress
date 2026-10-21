/**
 * 生成 README 用的后台截图（2026-10-21）。
 *
 * 后台要登录，口令不写进仓库：从环境变量读 JC_ADMIN_USER / JC_ADMIN_PASS。
 * 拍两张：文章列表（管理系统的样子）、新建文章（Markdown 工具条）。
 * 输出到 docs/assets/，转码借 Chromium 自带 webp 编码器（本机没有 sharp / Pillow）。
 *
 * 用法：
 *   NODE_PATH=C:/Users/O/node_modules JC_ADMIN_USER=admin JC_ADMIN_PASS=xxx \
 *     node .tmp/tools/make-readme-admin.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const OUT = path.resolve(__dirname, '../../docs/assets')

const USER = process.env.JC_ADMIN_USER || 'admin'
const PASS = process.env.JC_ADMIN_PASS

async function toWebp(page, buf, maxWidth, q) {
  const b64 = buf.toString('base64')
  return page.evaluate(
    async ([data, maxW, quality]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${data}`
      await img.decode()
      const s = Math.min(1, maxW / img.naturalWidth)
      const w = Math.round(img.naturalWidth * s)
      const h = Math.round(img.naturalHeight * s)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      const url = c.toDataURL('image/webp', quality)
      return { b64: url.slice(url.indexOf(',') + 1), w, h }
    },
    [b64, maxWidth, q],
  )
}

const main = async () => {
  if (!PASS) {
    console.error('缺 JC_ADMIN_PASS')
    process.exit(2)
  }
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const helper = await browser.newPage()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.fill('#admin-username', USER)
  await page.fill('#admin-password', PASS)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/admin\/articles/, { timeout: 30000 })
  await page.waitForTimeout(1500)

  const shots = [
    ['admin-articles', '/admin/articles'],
    ['admin-editor', '/admin/articles/new'],
  ]
  for (const [name, route] of shots) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1400)
    const buf = await page.screenshot({ fullPage: false })
    const r = await toWebp(helper, buf, 1280, 0.85)
    const file = path.join(OUT, `${name}.webp`)
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
    console.log(`${name}.webp  ${r.w}×${r.h}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
  }
  await browser.close()
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e).split('\n').slice(0, 4).join('\n'))
  process.exit(1)
})
