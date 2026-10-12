/**
 * 「项目经历」展开态细查：量文本首字符位置、按钮贴边距离、面板内容宽度分布，
 * 并输出 3 倍放大的局部截图，用来肉眼确认「文字是否被裁」「短横线位置」。
 *
 * 用法：node .tmp/tools/diag-project.cjs
 * 前置：dev server 在 8099。
 */
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')

const ORIGIN = process.env.JCPRESS_ORIGIN || 'http://127.0.0.1:8099'
const OUT = '.tmp/shots-project'

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 })
  const page = await ctx.newPage()

  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await page.waitForTimeout(600)

  const target = page.locator('section').filter({ has: page.locator('#projects-title') }).first()
  await target.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)

  await target.getByRole('button', { name: '展开' }).first().click()
  await page.waitForTimeout(600)
  // 把指针移开，避免聚光干扰观察
  await page.mouse.move(20, 20)
  await page.waitForTimeout(400)

  const m = await page.evaluate(() => {
    const R = (el) => {
      const b = el.getBoundingClientRect()
      return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1), t: +b.top.toFixed(1) }
    }
    const firstChar = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const node = walker.nextNode()
      if (!node || !node.textContent.trim()) return null
      const range = document.createRange()
      range.setStart(node, 0)
      range.setEnd(node, 1)
      const b = range.getBoundingClientRect()
      return { text: node.textContent.slice(0, 6), firstCharLeft: +b.left.toFixed(1) }
    }
    const sec = document.querySelector('#projects-title').closest('section')
    const table = sec.querySelector('[data-glass]')
    const cs = getComputedStyle(table)
    const innerLeft = table.getBoundingClientRect().left + parseFloat(cs.paddingLeft)
    const innerRight = table.getBoundingClientRect().right - parseFloat(cs.paddingRight)

    const btn = table.querySelector('button[aria-expanded="true"]')
    const row = btn.closest('div')
    const panel = document.getElementById(btn.getAttribute('aria-controls'))

    const summary = panel.querySelector('p')
    const ul = panel.querySelector('ul')
    const lis = Array.from(ul.querySelectorAll('li'))
    const tech = panel.querySelector('p:last-of-type')

    const liRects = lis.map((li) => {
      const b = li.getBoundingClientRect()
      const mark = getComputedStyle(li, '::before')
      return {
        textHead: li.textContent.slice(0, 14),
        l: +b.left.toFixed(1),
        w: +b.width.toFixed(1),
        paddingLeft: getComputedStyle(li).paddingLeft,
        marker: { left: mark.left, top: mark.top, width: mark.width, height: mark.height },
      }
    })

    return {
      tableInner: { innerLeft: +innerLeft.toFixed(1), innerRight: +innerRight.toFixed(1) },
      row: R(row),
      toggle: { ...R(btn), gapToInnerRight: +(innerRight - btn.getBoundingClientRect().right).toFixed(1) },
      panel: R(panel),
      panelLeftVsInnerLeft: +(panel.getBoundingClientRect().left - innerLeft).toFixed(1),
      panelRightVsInnerRight: +(innerRight - panel.getBoundingClientRect().right).toFixed(1),
      summary: { ...R(summary), ...firstChar(summary) },
      firstLi: { ...R(lis[0]), ...firstChar(lis[0]) },
      tech: { ...R(tech), ...firstChar(tech) },
      liRects,
      // 行内是否有绝对定位的覆盖层
      overlays: Array.from(row.querySelectorAll('*'))
        .filter((el) => getComputedStyle(el).position === 'absolute')
        .map((el) => el.className.toString().slice(0, 30)),
    }
  })

  console.log(JSON.stringify(m, null, 2))

  // 整行 3 倍清晰截图（deviceScaleFactor=3），用来肉眼核字与留白
  const openRow = page
    .locator('[data-glass] > div')
    .filter({ has: page.locator('button[aria-expanded="true"]') })
    .first()
  await openRow.screenshot({ path: path.join(OUT, 'zoom-open-row.png') })
  console.log('\n✔ 展开行 3x 图 →', path.join(OUT, 'zoom-open-row.png'))

  await browser.close()
})().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
