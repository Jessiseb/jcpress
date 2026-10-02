const { chromium } = require('playwright-core')

/**
 * 后台写入口的浏览器验收（替代跑不起来的 vitest —— 本机 esbuild 磁盘读取被拒）。
 * 全链路：/admin 未登录守卫 → 登录 → 列表 → 编辑改标题保存 → 发布 → 前台可见。
 */
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const log = (...a) => console.log(...a)

  // 1. 未登录访问 /admin/articles 必须被弹到 /admin/login
  await page.goto('http://127.0.0.1:5173/admin/articles', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(400)
  log('① 未登录访问 /admin/articles →', new URL(page.url()).pathname)
  const isolation = await page.evaluate(() => ({
    hasTopNav: !!document.querySelector('header'), // 公开站顶栏
    hasFooter: !!document.querySelector('footer'),
    hasFlow: !!document.querySelector('[data-flow]'), // 流线层
  }))
  log('   后台隔离（应全 false）:', JSON.stringify(isolation))

  // 2. 登录
  await page.fill('#admin-username', 'admin')
  await page.fill('#admin-password', 'jcpress@2026')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/articles', { timeout: 15000 })
  await page.waitForTimeout(800)
  log('② 登录后 →', new URL(page.url()).pathname)

  // 3. 列表：抓第一行的标题与状态
  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table tbody tr')).map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
      return { title: cells[0], status: cells[1] }
    }),
  )
  log(`③ 列表行数 = ${rows.length}`)
  rows.slice(0, 6).forEach((r) => log(`   · [${r.status}] ${r.title}`))

  const target = rows.find((r) => r.title && r.title.length > 0)
  if (!target) {
    log('!! 列表为空，无法继续编辑链路')
    await browser.close()
    return
  }

  // 4. 进编辑页
  await page.click('table tbody tr:first-child a:has-text("编辑")')
  await page.waitForURL('**/admin/articles/**', { timeout: 15000 })
  await page.waitForTimeout(1200)
  const origTitle = await page.inputValue('#article-title')
  log('④ 编辑页回填标题 =', JSON.stringify(origTitle))

  // 4b. 中文标题 + 空 slug → 必须本地拦下
  await page.fill('#article-title', '中文标题测试')
  await page.fill('#article-slug', '')
  await page.click('button:has-text("保存草稿")')
  await page.waitForTimeout(400)
  const slugErr = await page.evaluate(() => {
    const el = document.querySelector('[class*="fieldError"]')
    return el ? el.textContent.trim() : null
  })
  log('   中文标题+空slug 拦截提示 =', JSON.stringify(slugErr))

  // 5. 改回合法标题并保存草稿。**必须把 4b 清空的 slug 填回去** ——
  //    否则第 5 步会被同一条校验拦下（这是探针自己的坑，不是应用的 bug）。
  const newTitle = origTitle + '（后台改）'
  await page.fill('#article-slug', 'phase-3-backend-retro')
  await page.fill('#article-title', newTitle)
  await page.click('button:has-text("保存草稿")')
  await page.waitForFunction(
    () => new URL(location.href).pathname === '/admin/articles',
    { timeout: 15000 },
  ).catch(() => {})
  await page.waitForTimeout(800)
  log('⑤ 保存后 →', new URL(page.url()).pathname)

  // 6. 前台刷新看是否可见（先发布）
  //    回到列表，找到刚改的那篇点「发布」（若已是发布态则跳过）
  await page.goto('http://127.0.0.1:5173/admin/articles', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const pubRow = await page.evaluate((needle) => {
    const trs = Array.from(document.querySelectorAll('table tbody tr'))
    const tr = trs.find((t) => t.textContent.includes(needle))
    if (!tr) return null
    const btn = Array.from(tr.querySelectorAll('button')).find((b) => b.textContent.trim() === '发布')
    if (btn) btn.click()
    const st = tr.querySelector('td:nth-child(2)').textContent.trim()
    return { status: st, clicked: !!btn }
  }, newTitle)
  log('⑥ 列表中找到改后文章:', JSON.stringify(pubRow))
  // 等状态徽标变成「已发布」（发布请求是异步的）
  await page
    .waitForFunction(
      (needle) => {
        const tr = Array.from(document.querySelectorAll('table tbody tr')).find((t) =>
          t.textContent.includes(needle),
        )
        return tr && tr.querySelector('td:nth-child(2)').textContent.includes('已发布')
      },
      newTitle,
      { timeout: 10000 },
    )
    .catch(() => {})
  await page.waitForTimeout(800)

  // 7. 前台 /tech 刷新，确认标题出现
  await page.goto('http://127.0.0.1:5173/tech', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  const visible = await page.evaluate(
    (needle) => document.body.innerText.includes(needle),
    newTitle,
  )
  log('⑦ 前台 /tech 可见改后标题 =', visible)

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
