// 实习经历竖向时间轴验收：三段是否都渲染、期间是否只出现一次、
// 正文每行字数、轴线是否连续、各档视口是否溢出。
const path = require('path')
const { chromium } = require('playwright-core')

const main = async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [w, h, tag] of [
    [1280, 1000, 'desktop'],
    [900, 900, 'tablet'],
    [390, 844, 'mobile'],
  ]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(800)
    const sec = p.locator('section[aria-labelledby="exp-title"]')
    const y = await sec.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    await p.evaluate((v) => window.scrollTo(0, v), y - 80)
    await p.waitForTimeout(700)

    const r = await p.evaluate(() => {
      const root = document.querySelector('section[aria-labelledby="exp-title"]')
      const items = Array.from(root.querySelectorAll('ol > li'))
      const entry = items[0].querySelector('article')
      const cs = getComputedStyle(entry)
      const innerW = entry.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const period = (el) => el.querySelector('span').textContent.trim()

      // 期间在这段里出现几次（每段正文里不该再写一遍）
      const dup = items.map((li) => {
        const t = li.innerText
        const p = period(li)
        return (t.split(p).length - 1)
      })

      // 轴线：::before 的几何 + 是否真的上色
      const axis = items.map((li) => {
        const s = getComputedStyle(li, '::before')
        return { h: Math.round(parseFloat(s.height) || 0), bg: s.backgroundColor, display: s.display }
      })

      // 相邻两段的轴线首尾是否接上（无缝隙 / 不重叠）
      const boxes = items.map((li) => li.getBoundingClientRect())

      return {
        count: items.length,
        periods: items.map(period),
        dup,
        innerW: Math.round(innerW),
        perLine: Math.floor(innerW / parseFloat(cs.fontSize)),
        axis,
        height: Math.round(root.getBoundingClientRect().height),
        rowHeights: boxes.map((box) => Math.round(box.height)),
        dotAlign: items.map((li) => {
          const dot = li.querySelector('span[aria-hidden]')
          const name = li.querySelector('h3')
          if (!dot || !name) return -1
          const d = dot.getBoundingClientRect()
          const n = name.getBoundingClientRect()
          return Math.round(d.top + d.height / 2) - Math.round(n.top + n.height / 2)
        }),
      }
    })

    const ovX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    console.log(
      `${tag} ${w}px | 三段 ${r.count} 条，行高 ${r.rowHeights.join('/')}，区块高 ${r.height} ` +
        `| 正文 ${r.innerW}px → ${r.perLine} 字/行 | 期间重复 ${r.dup.join('/')} ` +
        `| 轴线 ${r.axis.map((a) => `${a.display}/${a.h}px/${a.bg}`).join(' ')} ` +
        `| 圆点与公司名中线偏差 ${r.dotAlign.join('/')}px | 横向溢出 ${ovX}`,
    )
    if (tag !== 'tablet') await sec.screenshot({ path: path.resolve(__dirname, `exp-timeline-${tag}.png`) })
    await ctx.close()
  }
  await b.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
