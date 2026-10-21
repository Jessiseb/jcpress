/**
 * 对比面板布局验收（不调 AI，纯算样式，秒级）。
 *
 * 位置：`frontend/src/components/admin/AiFormatPanel.module.css`
 * 用法：`node .tmp/tools/audit-compare-layout.mjs`
 *
 * 盯两件事：
 * 1. **两栏共用一个纵向滚动条**：`.compare` 承担 overflow-y，`.colBody` 必须交出 height
 *    与 overflow-y —— 谁改回去都会退回"各滚各的"，而常规高度下看不出来。
 * 2. **窄屏那三条覆盖规则真的生效**：媒体查询**不提升特异性**，同选择器下源码顺序靠后的
 *    赢，所以它必须写在基础规则之后；写在前面会被整个吃掉，且在 1440px 下完全看不出来。
 *
 * 做法是把源 CSS 内联进一个最小 DOM（用原始类名，不经过 CSS Module 散列），
 * 分别在 1440 / 760 两个宽度下读 computed style 对答案。
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const css = readFileSync('frontend/src/components/admin/AiFormatPanel.module.css', 'utf8')
const tokens = `:root{--ds-space-1:4px;--ds-space-2:8px;--ds-space-3:12px;--ds-space-4:16px;
--ds-fw-medium:500;--ds-fw-semibold:600;--ds-font-mono:monospace;--adm-border:#ddd;--adm-border-strong:#bbb;
--adm-bg:#f5f5f5;--adm-card:#fff;--adm-text:#111;--adm-text-2:#444;--adm-text-3:#666;--adm-text-4:#888;
--adm-solid:#0a58ca;--adm-solid-hover:#084298;--adm-primary:#0a58ca;--adm-danger:#b02a37;
--adm-danger-soft:#f8d7da;--adm-warning:#664d03;--adm-warning-soft:#fff3cd;--adm-table-head:#f0f0f0;--adm-r:4px}`

const html = `<!doctype html><meta charset="utf-8">
<style>${tokens}</style>
<style>${css}</style>
<div class="panel"><div class="compare">
  <div class="col"><div class="colHead">当前正文</div><div class="colBody"><p>${'左栏内容 '.repeat(200)}</p></div></div>
  <div class="col"><div class="colHead">AI 整理后</div><div class="colBody"><p>${'右栏内容 '.repeat(150)}</p></div></div>
</div></div>`

const file = '.tmp/compare-css-probe.html'
writeFileSync(file, html)

const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
let bad = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✔' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) bad++
}

const probe = async (width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto('file://' + process.cwd() + '/' + file)
  const r = await page.evaluate(() => {
    const compare = document.querySelector('.compare')
    const cs = getComputedStyle(compare)
    const col2 = document.querySelectorAll('.col')[1]
    const head = document.querySelector('.colHead')
    const cols = Array.from(document.querySelectorAll('.col'))
    return {
      overflowY: cs.overflowY,
      maxHeight: cs.maxHeight,
      columns: cs.gridTemplateColumns.split(' ').length,
      col2BorderLeft: getComputedStyle(col2).borderLeftWidth,
      col2BorderTop: getComputedStyle(col2).borderTopWidth,
      headPosition: getComputedStyle(head).position,
      colTops: cols.map((c) => Math.round(c.getBoundingClientRect().top)),
      colHeights: cols.map((c) => Math.round(c.getBoundingClientRect().height)),
    }
  })
  await page.close()
  return r
}

console.log('=== 1440px（两栏并排，共用一个滚动条）===')
const wide = await probe(1440)
check('纵向滚动在 .compare 上', wide.overflowY === 'auto', wide.overflowY)
check('视口高度受限', wide.maxHeight === '300px', wide.maxHeight)
check('两栏并排', wide.columns === 2, `${wide.columns} 列`)
check('第二栏用竖分隔线', wide.col2BorderLeft === '1px', wide.col2BorderLeft)
check('两栏等高（矮的那栏被栅格拉伸）', wide.colHeights[0] === wide.colHeights[1], JSON.stringify(wide.colHeights))
check('栏头 sticky', wide.headPosition === 'sticky', wide.headPosition)

console.log('\n=== 760px（挤成一列，交还页面滚动）===')
const narrow = await probe(760)
check('不再固定视口', narrow.overflowY === 'visible' && narrow.maxHeight === 'none', `${narrow.overflowY} / ${narrow.maxHeight}`)
check('变成单列', narrow.columns === 1, `${narrow.columns} 列`)
check('竖分隔线已撤', narrow.col2BorderLeft === '0px', narrow.col2BorderLeft)
check('改用横分隔线', narrow.col2BorderTop === '1px', narrow.col2BorderTop)
check('栏头不再 sticky', narrow.headPosition === 'static', narrow.headPosition)

await browser.close()
console.log(`\n合计失败：${bad}`)
process.exit(bad > 0 ? 1 : 0)
