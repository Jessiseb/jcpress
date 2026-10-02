/**
 * 后台三页截图（登录页 / 文章列表 / 编辑页）—— 取证工具，给人看「后台长什么样」。
 *
 * 与 `probe-admin.cjs` 的分工：那个是**功能断言**（走全链路、判通过/失败），
 * 这个是**截图取证**（产出 PNG）。两者都真实登录，不重复。
 *
 * 用法：node .tmp/tools/shot-admin.cjs [输出目录]   默认 .tmp/shots-admin
 * 前置：dev server 在 5173、后端在 8080。
 */
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')

const ORIGIN = 'http://127.0.0.1:5173'
const OUT = process.argv[2] || '.tmp/shots-admin'
const USER = 'admin'
const PASS = 'jcpress@2026'

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // 1) 登录页
  await page.goto(ORIGIN + '/admin/login', { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, 'admin-login.png'), fullPage: true })
  console.log('✔ login  →', path.join(OUT, 'admin-login.png'))

  // 2) 登录拿 token（接口路径已核对：/api/v1/admin/auth/login）
  const resp = await page.evaluate(
    async ([origin, u, p]) => {
      const r = await fetch(origin + '/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      return { status: r.status, body: await r.json() }
    },
    [ORIGIN, USER, PASS],
  )
  const token = resp.body?.data?.token
  if (!token) {
    console.error('登录失败：', JSON.stringify(resp))
    process.exit(1)
  }
  console.log('✔ 登录成功，token 前 12 位：', token.slice(0, 12) + '…')

  await page.evaluate((t) => sessionStorage.setItem('jcpress.admin.token', t), token)

  // 3) 文章列表
  await page.goto(ORIGIN + '/admin/articles', { waitUntil: 'load' })
  await page.waitForSelector('table', { timeout: 15000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, 'admin-article-list.png'), fullPage: true })
  console.log('✔ 列表  →', path.join(OUT, 'admin-article-list.png'))

  // 4) 编辑页（取列表第一行的编辑入口；没有就直奔 /admin/articles/1）
  const firstEdit = await page.$('table a[href*="/admin/articles/"]')
  const editUrl = firstEdit ? await firstEdit.getAttribute('href') : '/admin/articles/1'
  await page.goto(ORIGIN + editUrl, { waitUntil: 'load' })
  await page.waitForSelector('#article-title', { timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT, 'admin-article-edit.png'), fullPage: true })
  console.log('✔ 编辑  →', path.join(OUT, 'admin-article-edit.png'), '（', editUrl, '）')

  // 顺带列一下编辑页上的可交互控件，证明功能真的在
  const controls = await page.evaluate(() => {
    const ids = ['article-title', 'article-slug', 'article-category', 'article-summary']
    const out = {}
    for (const id of ids) {
      const el = document.getElementById(id)
      out[id] = el ? (el.value !== undefined ? 'present' : 'present') : 'MISSING'
    }
    const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean)
    const cm = document.querySelector('.cm-editor')
    return { fields: out, buttons: btns, codeMirror: !!cm }
  })
  console.log('字段：', JSON.stringify(controls.fields))
  console.log('按钮：', controls.buttons.join(' | '))
  console.log('CodeMirror 编辑器：', controls.codeMirror ? '存在' : '不存在')

  await browser.close()
})().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
