const { chromium } = require('playwright-core')

/**
 * 字体探针：这台机器上到底装了哪些中文衬线字体？
 *
 * 两种方法交叉验证：
 *  ① document.fonts.check()：Chrome/Edge 对「本地已安装字体」返回 true；
 *  ② canvas 宽度比对：用候选字体与一个「一定不存在」的字名渲染同一串字，
 *     宽度不同 → 候选字体真的生效了（方法②可以证伪方法①的误报）。
 */
const CANDIDATES = [
  'Songti SC',
  'STSong',
  'STZhongsong',
  'Source Han Serif SC',
  'Source Han Serif CN',
  'Noto Serif CJK SC',
  'Noto Serif SC',
  'SimSun',
  'NSimSun',
  'FangSong',
  'KaiTi',
  'Microsoft YaHei',
  'SimHei',
  'Georgia',
  'Times New Roman',
  '__definitely_not_a_font__',
]

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })

  const result = await page.evaluate((candidates) => {
    const SAMPLE = '庄家希 AI 应用开发工程师'
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const widthOf = (family) => {
      ctx.font = `84px ${family}`
      return Math.round(ctx.measureText(SAMPLE).width * 100) / 100
    }

    const baseline = widthOf('__definitely_not_a_font__, serif')

    const rows = candidates.map((name) => {
      const w = widthOf(`"${name}", __definitely_not_a_font__, serif`)
      let check = null
      try {
        check = document.fonts.check(`84px "${name}"`)
      } catch (e) {
        check = 'err'
      }
      return { name, width: w, differsFromBaseline: Math.abs(w - baseline) > 0.5, fontsCheck: check }
    })

    // 站点实际生效的展示字体（H1 computed font-family 的第一项实际命中情况由浏览器决定，
    // 这里只能读到声明栈，命中哪个由上面的逐项比对推断）
    const h1 = document.querySelector('h1')
    const declared = h1 ? getComputedStyle(h1).fontFamily : null
    const nameSpan = h1 ? h1.querySelector('span') : null
    const declaredName = nameSpan ? getComputedStyle(nameSpan).fontFamily : null

    return { sample: SAMPLE, baseline, rows, declared, declaredName }
  }, CANDIDATES)

  console.log('样本：', result.sample)
  console.log('基线宽度（serif 兜底）：', result.baseline)
  console.log('H1 声明栈：', result.declared)
  console.log('姓名 span 声明栈：', result.declaredName)
  console.log('')
  console.log('字体名                          宽度      与基线不同  fonts.check')
  for (const r of result.rows) {
    console.log(
      `${r.name.padEnd(30)} ${String(r.width).padStart(8)}  ${r.differsFromBaseline ? '  ✔ 是' : '  ✘ 否'}       ${r.fontsCheck}`,
    )
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
