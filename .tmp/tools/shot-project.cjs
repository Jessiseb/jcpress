/**
 * 首页「项目经历」区块：折叠 / 展开两态的排版取证。
 *
 * 产出一张折叠态、一张展开态 PNG，并把关键元素的矩形打印出来 ——
 * 「按钮贴边」「展开后排版怪」这类问题只有量出来才知道差多少像素。
 *
 * 用法：node .tmp/tools/shot-project.cjs [输出目录]   默认 .tmp/shots-project
 * 前置：dev server 在 8099。
 */
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')

const ORIGIN = process.env.JCPRESS_ORIGIN || 'http://127.0.0.1:8099'
const OUT = process.argv[2] || '.tmp/shots-project'
const W = Number(process.env.VIEWPORT_W || 1440)

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: W, height: 1000 } })
  const page = await ctx.newPage()

  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await page.waitForTimeout(600)

  const target = page.locator('section').filter({ has: page.locator('#projects-title') }).first()
  await target.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000) // 等 data-reveal 动画落定

  await target.screenshot({ path: path.join(OUT, 'projects-collapsed.png') })
  console.log('✔ 折叠态 →', path.join(OUT, 'projects-collapsed.png'))

  const btn = target.getByRole('button', { name: '展开' }).first()
  await btn.click()
  await page.waitForTimeout(600)

  await target.screenshot({ path: path.join(OUT, 'projects-expanded.png') })
  console.log('✔ 展开态 →', path.join(OUT, 'projects-expanded.png'))

  const m = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return {
        x: Math.round(b.x),
        right: Math.round(b.right),
        w: Math.round(b.width),
        h: Math.round(b.height),
      }
    }
    const sec = document.querySelector('#projects-title')?.closest('section')
    const table = sec.querySelector('[data-glass]')
    const cs = getComputedStyle(table)
    const pad = { l: cs.paddingLeft, r: cs.paddingRight, t: cs.paddingTop, b: cs.paddingBottom }

    const row = table.querySelector('button[aria-expanded="true"]').closest('div')
    const panelId = table.querySelector('button[aria-expanded="true"]').getAttribute('aria-controls')
    const panel = document.getElementById(panelId)
    const toggle = table.querySelector('button[aria-expanded="true"]')

    const kids = Array.from(panel.children).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 28),
      ...box(el),
    }))

    return {
      viewportW: window.innerWidth,
      section: box(sec),
      table: box(table),
      tablePadding: pad,
      row: box(row),
      toggle: box(toggle),
      panel: box(panel),
      panelGapFromToggleRight_to_tableRight: Math.round(
        table.getBoundingClientRect().right - toggle.getBoundingClientRect().right,
      ),
      panelLeftVsTableInnerLeft: Math.round(
        panel.getBoundingClientRect().left -
          (table.getBoundingClientRect().left + parseFloat(pad.l)),
      ),
      panelChildren: kids,
    }
  })

  console.log('\n=== 测量（viewport ' + m.viewportW + 'px）===')
  console.log('section      ', JSON.stringify(m.section))
  console.log('table(panel) ', JSON.stringify(m.table), 'padding', JSON.stringify(m.tablePadding))
  console.log('row          ', JSON.stringify(m.row))
  console.log('toggle 按钮  ', JSON.stringify(m.toggle))
  console.log('  ↳ 按钮右缘距 panel 内右缘:', m.panelGapFromToggleRight_to_tableRight, 'px')
  console.log('panel        ', JSON.stringify(m.panel))
  console.log('  ↳ panel 左缘相对 panel 内容区左缘:', m.panelLeftVsTableInnerLeft, 'px')
  console.log('panel 子元素：')
  for (const k of m.panelChildren) console.log('   ', JSON.stringify(k))

  await browser.close()
})().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
