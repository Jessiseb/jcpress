const { chromium } = require('playwright-core')

const PROBE = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const lum = ({ r, g, b }) => {
    const ch = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  const effBg = (el) => {
    let node = el
    let acc = null
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor)
      if (bg && bg.a > 0) {
        acc = acc ? over(acc, bg) : bg
        if (acc.a >= 0.999) return acc
      }
      node = node.parentElement
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 }
  }
  const out = []
  // CSS Modules 会改写类名，不能按 .errorTitle 选 —— 直接遍历 alert 里所有带直接文本的节点
  for (const el of document.querySelectorAll('[role="alert"] *')) {
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!hasText) continue
    {
      const s = getComputedStyle(el)
      const fg = over(parse(s.color), effBg(el))
      const size = parseFloat(s.fontSize)
      const bold = Number(s.fontWeight) >= 700
      const large = size >= 24 || (bold && size >= 18.66)
      const r = ratio(fg, effBg(el))
      out.push({
        sel: el.tagName.toLowerCase() + '.' + (el.className || '-').split(' ')[0].slice(0, 22),
        text: (el.textContent || '').trim().slice(0, 18),
        size: size + 'px',
        ratio: r.toFixed(2),
        need: large ? 3 : 4.5,
        pass: r >= (large ? 3 : 4.5),
      })
    }
  }
  return out
}

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let bad = 0
  for (const scheme of ['light', 'dark']) {
    for (const [url, w, h] of [['/tech', 1280, 900], ['/', 390, 844]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
      const p = await ctx.newPage()
      await p.route('**/api/**', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502</body></html>' }))
      await p.goto('http://127.0.0.1:5175' + url, { waitUntil: 'domcontentloaded' })
      await p.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null)
      await p.waitForTimeout(500)
      const rows = await p.evaluate(PROBE)
      console.log(`\n== ${scheme} ${url} ${w}x${h} ==`)
      for (const r of rows) {
        if (!r.pass) bad++
        console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.sel.padEnd(12)} ${r.size.padEnd(7)} ${r.ratio}:1 (need ${r.need})  「${r.text}」`)
      }
      await ctx.close()
    }
  }
  await b.close()
  console.log(bad === 0 ? '\n全部达标' : `\n${bad} 处未达标`)
  process.exit(bad === 0 ? 0 : 1)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
