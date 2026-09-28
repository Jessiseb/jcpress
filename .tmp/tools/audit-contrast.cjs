const { chromium } = require('playwright-core')

/**
 * 对比度审计：遍历页面上所有含直接文本的元素，按 WCAG 2.1 计算
 * 「文字色合成到有效背景色」后的对比度，标出未达 AA 的项。
 *
 * 有效背景 = 沿祖先链向上找第一个非透明 background-color，逐层 alpha 合成。
 * 已知近似：body 上叠了两枚峰值 6% 的径向渐变，这里按纯底色计算，
 * 误差量级 <0.3:1，不影响「是否过 AA」的判定。
 */

const AUDIT = () => {
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
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]
    return (hi + 0.05) / (lo + 0.05)
  }

  const effectiveBg = (el) => {
    let node = el
    let acc = null
    while (node && node !== document.documentElement.parentElement) {
      const c = parse(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0) acc = acc ? over(acc, c) : c
      if (acc && acc.a === 1) return acc
      node = node.parentElement
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 }
  }

  const findBgImage = (el) => {
    let node = el
    while (node) {
      if (getComputedStyle(node).backgroundImage !== 'none') return node.tagName
      node = node.parentElement
    }
    return null
  }

  const results = []
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return

    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
      .map((n) => n.textContent.trim())
      .join(' ')
    if (!own) return

    // 渐变文字（background-clip: text）走单独通道，这里跳过
    const fill = cs.webkitTextFillColor || cs.color
    if (fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent') return

    const fg = parse(cs.color)
    if (!fg) return
    const bg = effectiveBg(el)
    const composited = fg.a < 1 ? over(fg, bg) : fg
    const c = ratio(composited, bg)

    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = isLarge ? 3 : 4.5

    results.push({
      text: own.slice(0, 34),
      cls: String(el.className).slice(0, 40),
      size,
      weight,
      ratio: Number(c.toFixed(2)),
      need,
      pass: c >= need,
      bgImageAncestor: c >= need ? undefined : findBgImage(el),
    })
  })
  return results
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let failures = 0
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    await page.evaluate(() => document.documentElement.removeAttribute('data-reveal'))
    await page.waitForTimeout(200)

    const rows = await page.evaluate(AUDIT)
    const bad = rows.filter((r) => !r.pass)
    failures += bad.length
    console.log(`\n=== ${scheme} === 检查 ${rows.length} 处文本，未达标 ${bad.length} 处`)
    bad.forEach((r) =>
      console.log(
        `  ✗ ${r.ratio}:1 (需 ${r.need}) ${r.size}px/${r.weight} [${r.cls}] "${r.text}"`,
      ),
    )
    if (bad.length === 0) console.log('  ✔ 全部通过 AA')

    const worst = [...rows].sort((a, b) => a.ratio - b.ratio).slice(0, 3)
    worst.forEach((r) => console.log(`  · 最低三处之一：${r.ratio}:1 ${r.size}px "${r.text}"`))
    await ctx.close()
  }
  await browser.close()
  console.log(`\n合计未达标：${failures}`)
  process.exit(failures > 0 ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
