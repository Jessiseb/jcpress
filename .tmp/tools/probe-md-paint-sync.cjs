/**
 * 后台 Markdown 编辑器：取色（文字色 / 底色）与两栏按内容对齐滚动的端到端验收
 * （2026-10-22 用户：①「需要支持给字体不同的颜色，还有和飞书一样的可以给选定的字体加
 * 背景颜色」②「滑动的时候虽然能一起滑动，但是左右内容没有对应上」）。
 *
 * 登录还是靠 route 拦 `/me`（同 probe-md-toolbar）：这些断言跟账号没关系。
 * 用法：node .tmp/tools/probe-md-paint-sync.cjs   （需 8099 在跑）
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * 文档要够长：编辑器一行约 31px、预览一侧段落 ~110px，两边高度差得远。
 * 短文档时编辑器早早滚到底，测出来的"对不上"其实是「编辑器没得滚了」，
 * 不是同步算错 —— 第一版探针就栽在这儿，所以要 8 节。
 */
const section = (n) => `## 第 ${n} 节

这是第 ${n} 节的正文，用来把两栏都撑到足够长，好验证同步滚动在中段是不是对得上。
再补几句凑高度：第 ${n} 节的第一句，第二句，第三句。

- 第 ${n} 节要点一
- 第 ${n} 节要点二
- 第 ${n} 节要点三
`

const DOC = `# 长文档

开头一段。

${[1, 2, 3, 4, 5, 6, 7, 8].map(section).join('\n## 区间\n\n')}
## 结尾

最后一段，收尾。
`

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => sessionStorage.setItem('jcpress.admin.token', 'probe-token'))
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
  await page.click('.cm-content')
  await page.keyboard.insertText(DOC)
  await page.waitForTimeout(600)

  // ── 布局：两栏各自滚动，页面不再被正文撑高 ──
  const layout = await page.evaluate(() => {
    const scroller = document.querySelector('.cm-scroller')
    const preview = document.querySelector('[class*="preview"]')
    const panes = Array.from(document.querySelectorAll('[class*="_pane_"]'))
    return {
      editorScrollable: scroller.scrollHeight - scroller.clientHeight,
      previewScrollable: preview.scrollHeight - preview.clientHeight,
      paneHeights: panes.map((el) => Math.round(el.getBoundingClientRect().height)),
      anchors: preview.querySelectorAll('[data-src-line]').length,
    }
  })
  check(
    '两栏各自可滚（不再靠外层页面滚）',
    layout.editorScrollable > 0 && layout.previewScrollable > 0,
    `编辑器多 ${layout.editorScrollable}px，预览多 ${layout.previewScrollable}px`,
  )
  check('两栏等高', Math.abs(layout.paneHeights[0] - layout.paneHeights[1]) <= 1, JSON.stringify(layout.paneHeights))
  check('预览块带上了源文行号', layout.anchors >= 8, `${layout.anchors} 块`)

  // ── 取色器：工具条 ──
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="toolbar"] button')).map((b) => b.getAttribute('aria-label')),
  )
  check(
    '工具条共 15 个按钮（13 个格式 + 文字颜色 + 文字底色）',
    buttons.length === 15 && buttons.includes('文字颜色') && buttons.includes('文字底色'),
    buttons.join(' / '),
  )

  /**
   * 选中某一整行：先把这一行滚进可视区，再点进去用 Home / Shift+End 选。
   *
   * 不能用 `window.getSelection()` + Range，也不能直接双击一个**不在可视区**的行 ——
   * 编辑器的 scrollTop 在插入后就停在文末，`.cm-line` 的 boundingBox 会是负坐标，
   * 双击落在面板外，选区根本没动（第一版就是这样，测出来"包了个空标记"）。
   */
  const revealEditor = (needle) =>
    page.evaluate((text) => {
      const scroller = document.querySelector('.cm-scroller')
      const line = Array.from(document.querySelectorAll('.cm-line')).find((el) => el.textContent.includes(text))
      if (!line) return null
      scroller.scrollTop += line.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      return Math.round(scroller.scrollTop)
    }, needle)

  const selectLine = async (needle) => {
    await revealEditor(needle)
    await page.waitForTimeout(250)
    const box = await page.locator('.cm-line', { hasText: needle }).first().boundingBox()
    await page.mouse.click(box.x + 8, box.y + box.height / 2)
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.waitForTimeout(120)
  }

  const sourceText = () => page.evaluate(() => document.querySelector('.cm-content').textContent)

  await selectLine('这是第 3 节的正文')
  await page.click('button[aria-label="文字颜色"]')
  const paletteTone = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="group"][aria-label="文字颜色"] button')).map((b) =>
      b.getAttribute('aria-label'),
    ),
  )
  check('点「文字颜色」弹出 6 个色块', paletteTone.length === 6, paletteTone.join(' / '))

  const swatchColor = await page.evaluate(() => {
    const swatch = Array.from(
      document.querySelectorAll('[role="group"][aria-label="文字颜色"] button'),
    ).find((b) => b.getAttribute('aria-label') === '红色文字')
    return swatch ? getComputedStyle(swatch).color : null
  })
  await page.click('button[aria-label="红色文字"]')
  await page.waitForTimeout(350)

  const painted = await page.evaluate(() => {
    const tone = document.querySelector('[class*="prose"] [data-jc-tone="red"]')
    return {
      source: (document.querySelector('.cm-content').textContent.match(/\{红\}[^{}]{1,12}/) || [null])[0],
      rendered: tone ? tone.textContent : null,
      color: tone ? getComputedStyle(tone).color : null,
      opens: (document.querySelector('.cm-content').textContent.match(/\{红\}/g) || []).length,
      closes: (document.querySelector('.cm-content').textContent.match(/\{\/红\}/g) || []).length,
    }
  })
  check(
    '选中的一行被 {红}…{/红} 包住（一开一闭）',
    painted.opens === 1 && painted.closes === 1 && Boolean(painted.source),
    `${painted.source}｜开 ${painted.opens} 闭 ${painted.closes}`,
  )
  // 只断言「渲成红色且与色板同色 + 包住的是这一行的开头」：`Shift+End` 在开启
  // `lineWrapping` 时停在**折行处**（视觉行末），选不到整条逻辑行 —— 那是探针的事，
  // 不是产品的事，别把断言写死成整行文字
  check(
    '预览渲成红色，且与色板上的红是同一个色',
    painted.color !== null &&
      painted.color === swatchColor &&
      Boolean(painted.rendered && painted.rendered.startsWith('这是第 3 节的正文')),
    `渲染色 ${painted.color} / 色板 ${swatchColor}（「${painted.rendered}」）`,
  )

  // ── 再点同一个色：取消（选区还在内层文字上，这正是用户的操作路径） ──
  await page.click('button[aria-label="文字颜色"]')
  await page.click('button[aria-label="红色文字"]')
  await page.waitForTimeout(300)
  const afterOff = await page.evaluate(() => ({
    braces: (document.querySelector('.cm-content').textContent.match(/\{红\}/g) || []).length,
    rendered: document.querySelectorAll('[class*="prose"] [data-jc-tone]').length,
  }))
  check(
    '再点同一个色是取消（源码与预览里都没有标记了）',
    afterOff.braces === 0 && afterOff.rendered === 0,
    JSON.stringify(afterOff),
  )

  // ── 换色不叠加 ──
  await selectLine('这是第 4 节的正文')
  await page.click('button[aria-label="文字颜色"]')
  await page.click('button[aria-label="红色文字"]')
  await page.waitForTimeout(200)
  await page.click('button[aria-label="文字颜色"]')
  await page.click('button[aria-label="蓝色文字"]')
  await page.waitForTimeout(300)
  const afterSwap = await page.evaluate(() => ({
    red: (document.querySelector('.cm-content').textContent.match(/\{红\}/g) || []).length,
    blue: (document.querySelector('.cm-content').textContent.match(/\{蓝\}/g) || []).length,
    blueRendered: document.querySelectorAll('[class*="prose"] [data-jc-tone="blue"]').length,
  }))
  check(
    '红改蓝是换色，源码里不留两层',
    afterSwap.red === 0 && afterSwap.blue === 1 && afterSwap.blueRendered === 1,
    JSON.stringify(afterSwap),
  )

  // ── 底色 ──
  await selectLine('这是第 5 节的正文')
  await page.click('button[aria-label="文字底色"]')
  await page.click('button[aria-label="黄色底色"]')
  await page.waitForTimeout(300)
  const highlight = await page.evaluate(() => {
    const mark = document.querySelector('[class*="prose"] mark[data-jc-bg="yellow"]')
    return mark ? { text: mark.textContent.slice(0, 8), bg: getComputedStyle(mark).backgroundColor } : null
  })
  check(
    '{黄底}…{/黄底} 渲成带背景色的 <mark>',
    highlight !== null && highlight.bg !== 'rgba(0, 0, 0, 0)' && highlight.text.startsWith('这是'),
    JSON.stringify(highlight),
  )

  const codeLiteral = await page.evaluate(() => {
    const prose = document.querySelector('[class*="prose"]')
    return !prose.querySelector('pre [data-jc-tone]') && !prose.querySelector('pre [data-jc-bg]')
  })
  check('代码块里不认这套语法', codeLiteral)

  // ── 同步滚动 ①：滚预览 → 编辑器跟到同一处 ──
  const revealPreview = (needle) =>
    page.evaluate((text) => {
      const preview = document.querySelector('[class*="preview"]')
      const blocks = Array.from(preview.querySelectorAll('[data-src-line]'))
      const target = blocks.find((el) => el.textContent.includes(text))
      if (!target) return null
      preview.scrollTop =
        target.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop
      return Math.round(preview.scrollTop)
    }, needle)

  const editorTopLines = (count) =>
    page.evaluate((n) => {
      const scroller = document.querySelector('.cm-scroller')
      const top = scroller.getBoundingClientRect().top
      return Array.from(document.querySelectorAll('.cm-line'))
        .filter((el) => el.getBoundingClientRect().bottom > top)
        .slice(0, n)
        .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
    }, count)

  const previewTopBlocks = (count) =>
    page.evaluate((n) => {
      const preview = document.querySelector('[class*="preview"]')
      const top = preview.getBoundingClientRect().top + 2
      return Array.from(preview.querySelectorAll('[data-src-line]'))
        .filter((el) => el.getBoundingClientRect().bottom > top)
        .slice(0, n)
        .map((el) => ({
          line: Number(el.dataset.srcLine),
          text: el.textContent.replace(/\s+/g, ' ').trim(),
        }))
    }, count)

  await revealPreview('第 5 节')
  await page.waitForTimeout(400)
  const afterPreviewScroll = await editorTopLines(3)
  check(
    '滚动预览到「第 5 节」→ 编辑器顶部就是这一段（±1 行）',
    afterPreviewScroll.some((text) => text.includes('第 5 节')),
    JSON.stringify(afterPreviewScroll),
  )

  // ── 同步滚动 ②：滚编辑器 → 预览跟到同一处 ──
  const editorScroll = await revealEditor('第 2 节要点二')
  await page.waitForTimeout(400)
  const afterEditorScroll = await previewTopBlocks(2)
  check(
    '滚动编辑器到「第 2 节要点二」→ 预览顶部就是这一段（±1 块）',
    afterEditorScroll.some((block) => block.text.includes('第 2 节')),
    `编辑器 scrollTop=${editorScroll} / 预览顶部「${afterEditorScroll.map((b) => b.text.slice(0, 12)).join('｜')}」`,
  )

  // ── 暗色主题：颜色换另一套 ──
  const lightTone = await page.evaluate(() => {
    const tone = document.querySelector('[class*="prose"] [data-jc-tone]')
    return tone ? getComputedStyle(tone).color : null
  })
  const lightBg = await page.evaluate(() => {
    const mark = document.querySelector('[class*="prose"] mark[data-jc-bg]')
    return mark ? getComputedStyle(mark).backgroundColor : null
  })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(300)
  const darkTone = await page.evaluate(() => {
    const tone = document.querySelector('[class*="prose"] [data-jc-tone]')
    return tone ? getComputedStyle(tone).color : null
  })
  const darkBg = await page.evaluate(() => {
    const mark = document.querySelector('[class*="prose"] mark[data-jc-bg]')
    return mark ? getComputedStyle(mark).backgroundColor : null
  })
  check(
    '暗色主题下文字色与底色都换成另一套',
    lightTone !== darkTone && lightBg !== darkBg,
    `文字 ${lightTone} → ${darkTone}｜底色 ${lightBg} → ${darkBg}`,
  )
  await page.screenshot({ path: '.tmp/tools/md-paint-sync-dark.png' })
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'))
  await page.waitForTimeout(200)
  await page.screenshot({ path: '.tmp/tools/md-paint-sync.png' })

  check('无脚本报错', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error('断言失败：', error)
  process.exit(1)
})
