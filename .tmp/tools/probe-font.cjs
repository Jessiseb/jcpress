const { chromium } = require('playwright-core')
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  const r = await p.evaluate(() => {
    const h1 = document.querySelector('h1')
    const h2 = document.querySelector('h2')
    const body = document.body
    const cs = (el) => {
      const s = getComputedStyle(el)
      return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, spacing: s.letterSpacing, lineHeight: s.lineHeight, color: s.color }
    }
    // 用 canvas 测「庄」在宋体 vs 无衬线下的宽度，判断实际命中哪个字体
    const probe = (font) => {
      const c = document.createElement('canvas').getContext('2d')
      c.font = `700 100px ${font}`
      return c.measureText('庄家希').width.toFixed(1)
    }
    return {
      h1: cs(h1), h2: cs(h2), body: cs(body),
      fallbacks: { simsun: probe('SimSun'), serif: probe('serif'), sans: probe('sans-serif'), yahei: probe('Microsoft YaHei') },
      measure: {
        highlight: getComputedStyle(document.querySelectorAll('[data-reveal]')[20] || body).width,
      },
    }
  })
  console.log(JSON.stringify(r, null, 2))
  await b.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
