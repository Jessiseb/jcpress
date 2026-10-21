/**
 * 后台 Markdown 工具条的端到端验收（2026-10-20：用户要「像飞书/语雀那样点击修饰」）。
 *
 * 为什么要用 route 拦 `/me`：真的登录要账号口令，而这些断言（点按钮 → 正文变成什么样、
 * 按钮亮不亮、快捷键生不生效）跟账号没关系。拦掉那一条之后 `/admin/articles/new`
 * 就是个普通的编辑器页面，不上报、不落库。
 *
 * 用法：node .tmp/tools/probe-md-toolbar.cjs   （需 dev server 在 8099）
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 1360, height: 940 },
      colorScheme: scheme,
    })
    await ctx.addInitScript(() => {
      sessionStorage.setItem('jcpress.admin.token', 'probe-token')
      if (window.location.pathname.startsWith('/admin')) {
        // 主题由脚本切换：data-theme 挂在 <html> 上
      }
    })
    await ctx.route('**/api/v1/admin/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { id: '1', username: 'probe', nickname: '探针', role: 'ADMIN' },
          traceId: null,
        }),
      }),
    )

    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}/admin/articles/new`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.cm-content', { timeout: 30000 })
    if (scheme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    }

    const doc = () => page.evaluate(() => document.querySelector('.cm-content').innerText.trimEnd())
    const pressed = (label) =>
      page.evaluate((name) => {
        const el = document.querySelector(`button[aria-label="${name}"]`)
        return el ? el.getAttribute('aria-pressed') : null
      }, label)

    if (scheme === 'light') {
      // ── 工具条本身 ──
      const buttons = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="toolbar"] button')).map((b) => b.getAttribute('aria-label')),
      )
      // 13 个格式按钮 + 文字颜色 + 文字底色（2026-10-22 加的两个取色入口）
      check('工具条挂了 15 个按钮', buttons.length === 15, buttons.join(' / '))

      // ── 点按钮加粗 ──
      await page.click('.cm-content')
      await page.keyboard.type('并发编程')
      await page.keyboard.press('Shift+Home')
      await page.click('button[aria-label="加粗"]')
      check('选中文字点「加粗」→ **包裹**', (await doc()) === '**并发编程**', await doc())
      check('加粗后按钮亮起（aria-pressed）', (await pressed('加粗')) === 'true')

      await page.click('button[aria-label="加粗"]')
      check('再点一次是取消，不是套第二层', (await doc()) === '并发编程', await doc())
      check('取消后按钮熄灭', (await pressed('加粗')) === 'false')

      // ── 快捷键 ──
      await page.keyboard.press('Control+b')
      check('Ctrl+B 与按钮等价', (await doc()) === '**并发编程**', await doc())
      await page.keyboard.press('Control+b')

      // 快捷键按「遍历按钮清单」建出来，理论上 13 个都在；这里再抽一条验证绑定真的生效
      await page.keyboard.press('Control+Home')
      await page.keyboard.press('Shift+End')
      await page.keyboard.press('Control+i')
      check('Ctrl+I 与按钮等价', (await doc()).split('\n')[0] === '*并发编程*', await doc())
      await page.keyboard.press('Control+i')
      check('Ctrl+I 再按一次取消', (await doc()).split('\n')[0] === '并发编程', await doc())

      // ── 块级：列表与标题互不叠加 ──
      await page.keyboard.press('Control+End')
      await page.keyboard.press('Enter')
      await page.keyboard.type('第二行')
      await page.keyboard.press('Shift+Home')
      await page.click('button[aria-label="无序列表"]')
      const afterList = await doc()
      check('第二行变成无序列表', afterList.split('\n')[1] === '- 第二行', JSON.stringify(afterList))

      await page.click('button[aria-label="二级标题"]')
      const afterHeading = await doc()
      check(
        '列表行点「二级标题」是换类而不是叠加',
        afterHeading.split('\n')[1] === '## 第二行',
        JSON.stringify(afterHeading),
      )

      await page.click('button[aria-label="二级标题"]')
      const afterOff = await doc()
      check('再点一次标题取消', afterOff.split('\n')[1] === '第二行', JSON.stringify(afterOff))

      // ── 链接：选中文字 → [文字](https://)，并且 URL 那一段被选中（下一步是粘贴）──
      // 必须先 End：上一步「取消标题」之后光标停在**行首**，行首再按 Shift+Home
      // 选不中任何东西，会落到「无选区」分支（插入占位 [链接文字]）——
      // 那是另一条正确的路径，但不是这里要测的。第一版脚本就错在这儿，
      // 报出来是「链接没把选中文字当链接文字」，看着像产品缺陷。
      await page.keyboard.press('End')
      await page.keyboard.press('Shift+Home')
      await page.click('button[aria-label="链接"]')
      const afterLink = await doc()
      check('选中文字点「链接」→ [文字](https://)', afterLink.split('\n')[1] === '[第二行](https://)', JSON.stringify(afterLink))
      const selectedUrl = await page.evaluate(() => window.getSelection()?.toString() ?? '')
      check('插入后 URL 占位符已被选中（可直接粘贴覆盖）', selectedUrl === 'https://', JSON.stringify(selectedUrl))

      // ── 无选区点「链接」：插占位，并选中「链接文字」让用户直接改写 ──
      await page.keyboard.press('Control+End')
      await page.keyboard.press('Enter')
      await page.click('button[aria-label="链接"]')
      const afterBareLink = await doc()
      check(
        '无选区点「链接」→ 插入 [链接文字](https://) 占位',
        afterBareLink.endsWith('[链接文字](https://)'),
        JSON.stringify(afterBareLink.slice(-28)),
      )

      // ── 代码块（选中几行包进围栏）──
      await page.keyboard.press('Control+a')
      await page.click('button[aria-label="代码块"]')
      const afterCode = await doc()
      check(
        '选中正文点「代码块」→ 整段包进围栏',
        afterCode.startsWith('```') && afterCode.endsWith('```'),
        JSON.stringify(afterCode.slice(0, 40)),
      )

      // ── 表格 ──
      await page.keyboard.press('Control+End')
      await page.click('button[aria-label="表格"]')
      const afterTable = await doc()
      check('正文末尾插入表格骨架', afterTable.includes('| --- | --- |'), JSON.stringify(afterTable.slice(-60)))

      // ── 预览同步 ──
      const previewHtml = await page.evaluate(() => {
        const panes = document.querySelectorAll('[class*="preview"]')
        return panes.length ? panes[0].innerHTML : ''
      })
      check('右侧预览跟着变（表格出现在预览里）', previewHtml.includes('<table'), `${previewHtml.length} 字符`)
      check('无脚本报错', errors.length === 0, errors.join(' | '))
    }

    // 布局：工具条不撑破面板
    const layout = await page.evaluate(() => {
      const bar = document.querySelector('[role="toolbar"]')
      const pane = bar ? bar.parentElement : null
      const rect = bar ? bar.getBoundingClientRect() : null
      return {
        barH: rect ? Math.round(rect.height) : 0,
        barW: rect ? Math.round(rect.width) : 0,
        paneW: pane ? Math.round(pane.getBoundingClientRect().width) : 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    check(
      `[${scheme}] 工具条在面板内、页面无横向溢出`,
      layout.barW > 0 && layout.barW <= layout.paneW && layout.overflow <= 0,
      JSON.stringify(layout),
    )

    await page.screenshot({ path: `.tmp/tools/md-toolbar-${scheme}.png` })
    await ctx.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error('断言失败：', error)
  process.exit(1)
})
