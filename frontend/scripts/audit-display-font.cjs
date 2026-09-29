const { chromium } = require('playwright-core')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * 展示字覆盖断言（二期 phase-2-visual）。
 *
 * 断言三件事：
 *   1. 展示字元素（`h1` / `h2` / `[data-display]`）的计算字重是 700，且**不是合成粗体**
 *      （`font-synthesis: none` 必须生效）；
 *   2. 700 档字体文件被浏览器成功加载（`document.fonts` 里有对应的已加载 face）；
 *   3. **页面上真实渲染的展示字中文字符集 ⊆ 700 子集字体的 cmap**。
 *
 * 第 3 条是核心：700 子集只打包展示字。若漏字，浏览器会为那个字回落到 500 档，
 * 于是**同一行标题里出现两档字重**，观感就是「发糊」（阶段 11 的根因形态）。
 * 判断「字体文件里到底有没有这个字形」不能靠 `document.fonts.check()` ——
 * 两个 face 声明的 `unicode-range` 完全相同，check() 只回答「按 unicode-range 该用哪个 face」，
 * 不回答「字形存在与否」。因此这里**直接读字体文件的 cmap**（用 Python fontTools，
 * 与生成子集用的是同一套工具链），拿真实字符表做集合比较。
 *
 * 前置：dev server 在 5173 上跑着。
 * 用法：node scripts/audit-display-font.cjs
 *
 * 负向自检（验证这个断言真的会失败）：临时把子集里没有的字塞进标题再跑一次 ——
 *   PowerShell: $env:AUDIT_INJECT_CHAR='龘'; node scripts/audit-display-font.cjs
 *   期望：退出码 1，并报出「展示字缺字」。
 */

const ROUTES = ['/', '/tech', '/algo', '/projects', '/no-such-page']
const BASE = process.env.FONT_PROBE_BASE || 'http://127.0.0.1:5173'
const PUBLIC = path.resolve(__dirname, '../public/fonts')
const FONT_700 = path.join(PUBLIC, 'serif-sc-700.woff2')
const FONT_500 = path.join(PUBLIC, 'serif-sc-500.woff2')

const isCjk = (cp) =>
  (cp >= 0x3000 && cp <= 0x303f) ||
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0xff00 && cp <= 0xffef) ||
  cp === 0x2018 ||
  cp === 0x2019 ||
  cp === 0x201c ||
  cp === 0x201d ||
  cp === 0x2026

/** 从 woff2 的 cmap 读真实字符表（fontTools 与生成子集时是同一套工具链）。
 *
 * ⚠️ 必须走 `sys.stdout.buffer.write(...encode('utf-8'))`：Windows 上 Python 的 stdout
 * 默认按本地码页（GBK）编码，中文经过一次错误编码/解码后会变成一堆互不相同的乱码字符 ——
 * 表现为「cmap 里只有 17 个字」这种假失败（本脚本第一版就踩了这个坑，531 字被读成 161 字）。 */
function cmap(pathname) {
  const script = [
    'import sys',
    'from fontTools.ttLib import TTFont',
    'f = TTFont(sys.argv[1])',
    "text = ''.join(sorted({chr(c) for c in f.getBestCmap()}))",
    "sys.stdout.buffer.write(text.encode('utf-8'))",
  ].join('\n')
  return execFileSync('python', ['-c', script, pathname], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
}

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

;(async () => {
  for (const f of [FONT_500, FONT_700]) {
    if (!fs.existsSync(f)) {
      console.error(`✘ 字体文件不存在：${f}\n  先跑 npm run fonts:build（500）或 npm run fonts:build:display（700）`)
      process.exit(1)
    }
  }

  const cover700 = new Set(cmap(FONT_700))
  const cover500 = new Set(cmap(FONT_500))
  console.log(
    `700 子集字符数 ${cover700.size} / 500 子集字符数 ${cover500.size}（${(
      fs.statSync(FONT_700).size / 1024
    ).toFixed(1)}KB / ${(fs.statSync(FONT_500).size / 1024).toFixed(1)}KB）\n`,
  )

  const inject = process.env.AUDIT_INJECT_CHAR || ''
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const domChars = new Set()
  const markedChars = new Set()
  const markedWeights = []
  const weights = new Set()
  const samples = []

  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-reveal')
      document.querySelectorAll('button[aria-expanded="false"]').forEach((b) => b.click())
    })
    if (inject) {
      // 负向自检用：把子集里没有的字塞进第一个 h2，断言必须因此失败
      await page.evaluate((ch) => {
        const h2 = document.querySelector('h2')
        if (h2) h2.textContent = `${h2.textContent}${ch}`
      }, inject)
    }
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(200)

    // ⚠️ 必须按**文本节点**判字重，不能按元素：
    // 评审指出 `h1` 里其实并存两档 —— 姓名的 SPAN 是 700，定位行 `.nameSub` 显式写回 500
    // （Hero.module.css 里有说明，这是刻意的层级）。只看元素的话，
    // 「同一行标题不混两档字重」这条契约只被判了一半。
    const info = await page.evaluate(() => {
      const out = []
      const walk = (el) => {
        for (const node of el.childNodes) {
          if (node.nodeType === 3) {
            const text = node.textContent.trim()
            if (!text) continue
            const cs = getComputedStyle(el)
            out.push({
              text,
              weight: cs.fontWeight,
              marked: el.getAttribute('data-weight'),
              family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
            })
          } else if (node.nodeType === 1) {
            walk(node)
          }
        }
      }
      document.querySelectorAll('h1, h2, [data-display]').forEach(walk)
      return out
    })
    for (const node of info) {
      if (node.marked) {
        markedWeights.push(`${node.text.slice(0, 8)}=${node.weight}(标记 ${node.marked})`)
        for (const ch of node.text) if (isCjk(ch.codePointAt(0))) markedChars.add(ch)
      } else {
        weights.add(node.weight)
        for (const ch of node.text) if (isCjk(ch.codePointAt(0))) domChars.add(ch)
      }
      samples.push(`${route} [${node.weight} ${node.family}] ${node.text.slice(0, 24)}`)
    }
    await ctx.close()
  }

  // 字体加载状态（在首页上查）
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  const fontState = await page.evaluate(() => {
    const faces = Array.from(document.fonts).map((f) => ({
      family: f.family,
      weight: f.weight,
      status: f.status,
    }))
    const h1 = document.querySelector('h1')
    return {
      faces,
      h1Weight: h1 ? getComputedStyle(h1).fontWeight : null,
      synthesis: getComputedStyle(document.body).fontSynthesis,
      // 姓名那三个字是否命中了 CJK 子集（unicode-range 只认 CJK，所以中文会命中）
      serif700: document.fonts.check('700 104px "JCPress Serif SC"', '庄家希'),
    }
  })

  /**
   * 700 档是否**真的被用于中文**。
   *
   * 不能用 `document.fonts.check()` 证明：两个 face 声明的 `unicode-range` 完全相同，
   * check() 只回答「按 unicode-range 该用哪个 face」，不回答「字形存在与否、笔画粗细如何」。
   * 也不能用宽度证明：CJK 字形在 Noto Serif SC 里是等宽全角（每个汉字 1000/1000 em），
   * 500 与 700 的**宽度完全一样**，宽度比较恒为「相同」。
   * 能区分字重的是**墨量**（笔画覆盖的像素数）—— 把同一串汉字画到 canvas 上数非透明像素。
   */
  const ink = await page.evaluate(() => {
    const text = '庄家希拿得出手的数字技术栈'
    const draw = (weight) => {
      const cv = document.createElement('canvas')
      cv.width = 1400
      cv.height = 200
      const c = cv.getContext('2d')
      c.fillStyle = '#fff'
      c.fillRect(0, 0, cv.width, cv.height)
      c.fillStyle = '#000'
      c.font = `${weight} 100px "JCPress Serif SC"`
      c.textBaseline = 'top'
      c.fillText(text, 10, 20)
      const data = c.getImageData(0, 0, cv.width, cv.height).data
      let dark = 0
      for (let i = 0; i < data.length; i += 4) if (data[i] < 128) dark++
      return dark
    }
    return { ink500: draw(500), ink700: draw(700) }
  })
  const inkDelta = ((ink.ink700 - ink.ink500) / ink.ink500) * 100
  await ctx.close()
  await browser.close()

  const serif = fontState.faces.filter((f) => f.family.includes('JCPress'))
  check(
    '两档展示字子集都已加载',
    serif.filter((f) => f.status === 'loaded').length >= 2,
    serif.map((f) => `${f.weight}:${f.status}`).join(' '),
  )
  check(
    '展示字文本节点（未显式标记的）计算字重都是 700',
    weights.size === 1 && weights.has('700'),
    `字重集合={${[...weights].join(',')}}｜显式标记为非 700 的节点：${markedWeights.join(' / ') || '无'}`,
  )
  const mismatchedMarks = markedWeights.filter((m) => {
    const weight = m.split('=')[1].split('(')[0].trim()
    const mark = m.split('标记 ')[1].replace(')', '').trim()
    return weight !== mark
  })
  check(
    '显式标记的非 700 文本节点与标记值一致（防止「标记了却没生效」）',
    mismatchedMarks.length === 0,
    markedWeights.length ? markedWeights.join(' / ') : '无标记节点',
  )
  check(
    '被标记为非 700 的展示字也在 500 档子集里（回落不回落到系统字体）',
    [...markedChars].every((c) => cover500.has(c)),
    `${[...markedChars].join('')} ⊆ 500 档 ${[...markedChars].every((c) => cover500.has(c))}`,
  )
  check(
    '合成字重被禁用（缺档不会被浏览器拉粗）',
    fontState.synthesis === 'none',
    `font-synthesis=${fontState.synthesis}`,
  )
  check(
    '700 档真的被用于中文（墨量显著高于 500 档）',
    inkDelta > 3,
    `墨量 500=${ink.ink500} / 700=${ink.ink700}（+${inkDelta.toFixed(1)}%）`,
  )

  const missing = [...domChars].filter((c) => !cover700.has(c)).sort()
  check(
    '展示字字符集被 700 子集完整覆盖',
    missing.length === 0,
    missing.length
      ? `缺 ${missing.length} 个字：${missing.join('')} → 跑 npm run fonts:build:display`
      : `覆盖 ${domChars.size} 个展示字（子集共 ${cover700.size} 字）`,
  )

  // 附注：500 档必须覆盖展示字（回落时的兜底），不然缺字会直接掉到系统宋体
  const notIn500 = [...domChars].filter((c) => !cover500.has(c))
  check(
    '500 档也覆盖展示字（兜底不回落到系统字体）',
    notIn500.length === 0,
    notIn500.length ? `缺 ${notIn500.join('')}` : `ok`,
  )

  console.log('\n采集到的展示字样本（前 12 条）：')
  for (const s of samples.slice(0, 12)) console.log(`  ${s}`)

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`)
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
