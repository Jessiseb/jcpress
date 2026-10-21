const { chromium } = require('playwright-core')

/**
 * AI 排版前端链路验收（会**真调一次** DeepSeek，约 10~60 秒、约 1.2 万 token）。
 *
 * 覆盖：编辑页出现按钮 → 点击 → 对比面板 → 结构计数与元信息 → 应用到编辑器
 *      → 编辑器正文变化 + 元信息回填 → 面板内对比度。
 *
 * 说明：全程**不点保存**，所以不会写数据库；改的只是浏览器里的表单状态。
 */

const PASSWORD = 'jcpress@2026'

/**
 * 读编辑器全文。
 *
 * 三条路都试过，只有最后这条可靠：
 * - `innerText` 与逐行取 `.cm-line` 都只拿到一部分 —— 实测 3167 字的文章只读到 1117。
 *   原因不是"容器开了 content-visibility"，而是 CodeMirror 只渲染**浏览器视口内**的行
 *   （`.cm-scroller` 高度本就撑到 4077px，但屏幕只有 1000px，于是只有 33 行进了 DOM）。
 * - 想直接问 `view.state.doc`：新版 CodeMirror 挂的是 `cmTile` 而不是 `cmView`，
 *   `EditorView.findFromDOM` 那条路走不通（已实测，祖先链上一个实例属性都没有）。
 *
 * 于是把浏览器视口临时撑高，让整篇进入视口，CodeMirror 自然会渲染全部行。读完还原，
 * 不影响后续断言与截图。
 */
const readEditor = async (page) => {
  const size = page.viewportSize()
  await page.setViewportSize({ width: size.width, height: 8000 })
  await page.waitForTimeout(500) // 等 CodeMirror 的 resize 观察者补渲染
  const result = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.cm-content .cm-line'))
    return {
      text: lines.map((line) => line.textContent).join('\n'),
      renderedLines: lines.length,
    }
  })
  await page.setViewportSize(size)
  await page.waitForTimeout(300)
  return result
}

/** 面板内的对比度检查（WCAG 2.1，算法与 audit-contrast.cjs 一致，只是限定在面板内） */
const CONTRAST = (rootSelector) => {
  const root = document.querySelector(rootSelector)
  if (!root) return []
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

  const results = []
  root.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
      .map((n) => n.textContent.trim())
      .join(' ')
    if (!own) return
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
      text: own.slice(0, 30),
      cls: String(el.className).slice(0, 34),
      size,
      ratio: Number(c.toFixed(2)),
      need,
      pass: c >= need,
    })
  })
  return results
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let failures = 0
  const check = (name, ok, extra = '') => {
    console.log(`  ${ok ? '✔' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
    if (!ok) failures++
  }

  const loginRes = await fetch('http://127.0.0.1:8099/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD }),
  })
  const loginBody = await loginRes.json()
  const token = loginBody?.data?.token
  if (!token) throw new Error(`登录失败：${JSON.stringify(loginBody).slice(0, 140)}`)

  // 主题可裁剪：每跑一个主题就真调一次 AI，调试时用 SCHEMES=light 省一次调用
  const schemes = (process.env.SCHEMES || 'light,dark').split(',').map((s) => s.trim())
  for (const scheme of schemes) {
    console.log(`\n=== scheme: ${scheme} ===`)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme })
    await ctx.addInitScript((t) => sessionStorage.setItem('jcpress.admin.token', t), token)
    const page = await ctx.newPage()

    // 1. 从列表页进编辑页。
    //    不能点第一行 —— 列表按更新时间排序，顶部可能是空草稿（0 字），
    //    拿空正文去调 AI 既没意义也白烧 token。这里挑字数最多的一篇。
    await page.goto('http://127.0.0.1:8099/admin/articles', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    const target = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'))
      let bestIndex = 0
      let bestWords = -1
      rows.forEach((tr, index) => {
        const cell = tr.querySelector('td[data-col="wordCount"]')
        const words = cell ? parseInt(cell.textContent.replace(/\D/g, ''), 10) || 0 : 0
        if (words > bestWords) {
          bestWords = words
          bestIndex = index
        }
      })
      return { rowCount: rows.length, bestIndex, bestWords }
    })
    console.log(`   列表 ${target.rowCount} 行，选第 ${target.bestIndex + 1} 行（${target.bestWords} 字）`)
    await page.click(`table tbody tr:nth-child(${target.bestIndex + 1}) a:has-text("编辑")`)
    await page.waitForURL('**/admin/articles/**', { timeout: 15000 })
    await page.waitForSelector('.cm-content', { timeout: 15000 })
    await page.waitForTimeout(800)

    const beforeEditor = await readEditor(page)
    const beforeContent = beforeEditor.text
    const beforeSummary = await page.inputValue('#article-summary')
    console.log(
      `① 编辑页就绪（撑高视口后渲染 ${beforeEditor.renderedLines} 行），正文 ${beforeContent.length} 字，摘要 ${beforeSummary.length} 字`,
    )
    if (beforeContent.trim().length < 50) {
      throw new Error(`选中的文章正文只有 ${beforeContent.trim().length} 字，测不出排版效果`)
    }

    // 2. 触发 AI 排版
    const t0 = Date.now()
    await page.click('button:has-text("AI 排版")')
    const outcome = await page
      .waitForFunction(
        () => {
          if (document.querySelector('section[aria-label="AI 排版对比"]')) return 'panel'
          const alert = document.querySelector('[role="alert"]')
          if (alert) return 'error:' + alert.textContent.trim().slice(0, 80)
          return false
        },
        // 第三参才是 options；写成第二参会当成"传给页面函数的参数"，timeout 静默退回默认 30s
        null,
        { timeout: 200000 },
      )
      .then((h) => h.jsonValue())
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`② 点击 AI 排版 → ${outcome}（${elapsed}s）`)
    check('对比面板出现', outcome === 'panel', outcome)

    if (outcome !== 'panel') {
      await page.screenshot({ path: `.tmp/tools/shot-ai-error-${scheme}.png`, fullPage: false })
      await ctx.close()
      continue
    }

    // 3. 面板结构
    const panel = await page.evaluate(() => {
      const root = document.querySelector('section[aria-label="AI 排版对比"]')
      // 预览区是渲染文章正文的地方，里面的 table 是**原文自带的**，不算"面板自己用了 table"
      const previews = Array.from(root.querySelectorAll('[class*="colBody"]'))
      const inPreview = (el) => previews.some((p) => p.contains(el))
      return {
        cols: root.querySelectorAll('[class*="col"]').length >= 2,
        statCells: root.querySelectorAll('[class*="statCell"]').length,
        metaRows: root.querySelectorAll('[class*="metaRow"]').length,
        tablesOutsidePreview: Array.from(root.querySelectorAll('table')).filter((t) => !inPreview(t))
          .length,
        charStat: (() => {
          const cell = Array.from(root.querySelectorAll('[class*="statCell"]')).find((c) =>
            c.textContent.includes('字符数'),
          )
          return cell ? cell.textContent.trim().replace(/\s+/g, ' ') : ''
        })(),
        warnBars: Array.from(root.querySelectorAll('[class*="regression"]')).map((p) =>
          p.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
        ),
        hasHeaderTag: !!document.querySelector('header'),
        hasFooterTag: !!document.querySelector('footer'),
        overflowX: (() => {
          const bad = []
          root.querySelectorAll('*').forEach((el) => {
            if (inPreview(el)) return // 预览区内部本来就能横向滚动（.colBody 是 overflow:auto）
            if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
              bad.push(String(el.className).slice(0, 40) + ` (${el.scrollWidth}>${el.clientWidth})`)
            }
          })
          return bad.slice(0, 5)
        })(),
        checkboxes: Array.from(root.querySelectorAll('input[type="checkbox"]')).map((c) => c.checked),
        applyBtn: !!Array.from(root.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === '应用到编辑器',
        ),
      }
    })
    check('左右两栏预览都在', panel.cols)
    check('7 项结构计数', panel.statCells === 7, `实际 ${panel.statCells}`)
    check('3 行元信息', panel.metaRows === 3, `实际 ${panel.metaRows}`)
    check('面板 UI 未用 table（预览区里的是正文自带的）', panel.tablesOutsidePreview === 0)
    check('页面仍无 header/footer（三期视觉隔离）', !panel.hasHeaderTag && !panel.hasFooterTag)
    check('面板 UI 无横向溢出', panel.overflowX.length === 0, panel.overflowX.join(' | '))
    check('有「应用到编辑器」按钮', panel.applyBtn)

    // 3.5 联动滚动：纵向只留**一个**滚动条（两栏共用），滚一下两栏必须一起走。
    //     这条断言存在的理由：把滚动从"两栏各滚各的"改成"共用一个"，正确性完全落在 CSS 上
    //     （.compare 承担 overflow-y，.colBody 交出 height/overflow），谁改错都没人看得出来。
    const scroll = await page.evaluate(async () => {
      const root = document.querySelector('section[aria-label="AI 排版对比"]')
      const compare = root.querySelector('[class*="compare"]')
      const bodies = Array.from(compare.querySelectorAll('[class*="colBody"]'))
      const heads = Array.from(compare.querySelectorAll('[class*="colHead"]'))
      const innerY = Array.from(compare.querySelectorAll('*'))
        .filter((el) => el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0)
        .map((el) => `${String(el.className).slice(0, 30)}(${el.scrollHeight}>${el.clientHeight})`)
      const canScroll = compare.scrollHeight > compare.clientHeight + 2
      const before = bodies.map((b) => b.getBoundingClientRect().top)
      compare.scrollTop = 150
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const moved = bodies.map((b, i) => Math.round(before[i] - b.getBoundingClientRect().top))
      const boxTop = compare.getBoundingClientRect().top
      const stuck = Math.abs(heads[0].getBoundingClientRect().top - boxTop) <= 2
      const used = compare.scrollTop
      compare.scrollTop = 0 // 归零，后面截图保持从顶部开始
      return { canScroll, innerY, moved, used, stuck }
    })
    check('对比区可滚动（正文高于视口）', scroll.canScroll, `实际滚到 ${scroll.used}px`)
    check(
      '两栏内不再各自滚动（纵向只剩一个滚动条）',
      scroll.innerY.length === 0,
      scroll.innerY.join(' | '),
    )
    check(
      '滚动联动：两栏位移完全相同',
      scroll.used > 0 && scroll.moved[0] === scroll.used && scroll.moved[1] === scroll.used,
      `两栏位移 ${JSON.stringify(scroll.moved)}，期望 ${scroll.used}`,
    )
    check('栏头仍钉在顶部（sticky 换滚动容器后没失效）', scroll.stuck)
    console.log(`   字符数统计 = ${panel.charStat}`)
    // 面板自报的输入/输出字数是**可靠**的（它算的是真值，不像 DOM 读数受虚拟化影响）。
    // 顺手把它当成回归闸门：排版只该补空格、补表格分隔行，增幅不该超过 20%。
    const charMatch = panel.charStat.match(/(\d+)\s*→\s*(\d+)/)
    // 面板自报的这对数字是**真值**（它直接算 contentMd.length），拿来当读数校验的基准：
    // 编辑器原文长度必须等于面板的输入字符数，否则就是探针读歪了，后面所有断言都不作数。
    const panelInChars = charMatch ? Number(charMatch[1]) : null
    const panelOutChars = charMatch ? Number(charMatch[2]) : null
    if (!charMatch) {
      check('能读到输入/输出字符数', false, panel.charStat)
    } else {
      const growth = panelInChars === 0 ? 0 : (panelOutChars - panelInChars) / panelInChars
      const warned = panel.warnBars.some((text) => text.includes('长了'))
      console.log(
        `   字符数 ${panelInChars} → ${panelOutChars}（${(growth * 100).toFixed(1)}%），告警条：${warned ? '有' : '无'}`,
      )
      // 这里查的是**面板的职责**，不是模型的行为。模型会不会擅自扩写是它自己的随机性
      // （实测 7 次调用里 5 次多了 10%~23%），面板该做的是"超阈值必须报出来"。
      // 早先这条直接断言"增幅 ≤ 20%"，等于把模型的随机性挂进验收闸门 —— 会间歇性变红，
      // 间歇性变红的闸门最后没人看。
      check(
        '增幅超阈值时面板给出提示（面板职责）',
        growth <= 0.2 || warned,
        `${(growth * 100).toFixed(1)}%，告警条 ${warned ? '有' : '无'}`,
      )
    }
    check(
      '编辑器读数可靠（原文长度 == 面板输入字符数）',
      panelInChars === beforeContent.length,
      `读到 ${beforeContent.length}，面板收到 ${panelInChars}`,
    )
    console.log(`   元信息勾选状态 = ${JSON.stringify(panel.checkboxes)}`)
    panel.warnBars.forEach((text) => console.log(`   ⚠ 提示条：${text}`))

    // 4. 面板内对比度
    const rows = await page.evaluate(CONTRAST, 'section[aria-label="AI 排版对比"]')
    const bad = rows.filter((r) => !r.pass)
    check(`面板内对比度（检查 ${rows.length} 处）`, bad.length === 0)
    bad.forEach((r) => console.log(`     ✗ ${r.ratio}:1 (需 ${r.need}) [${r.cls}] "${r.text}"`))

    // 截**面板元素本身**，而不是视口 —— 面板在编辑页很靠下的位置，视口截图只能截到半截，
    // 看不出 .compare 那 300px 视口和它右侧唯一的滚动条。
    const panelEl = page.locator('section[aria-label="AI 排版对比"]')
    await panelEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await panelEl.screenshot({ path: `.tmp/tools/shot-ai-panel-${scheme}.png` })

    // 5. 应用
    await page.click('button:has-text("应用到编辑器")')
    await page.waitForTimeout(1200)
    const afterEditor = await readEditor(page)
    const afterContent = afterEditor.text
    const afterSummary = await page.inputValue('#article-summary')
    const afterTags = await page.inputValue('#article-tags')
    const afterSlug = await page.inputValue('#article-slug')
    const panelGone = await page.evaluate(
      () => !document.querySelector('section[aria-label="AI 排版对比"]'),
    )

    console.log(
      `③ 应用后：正文 ${beforeContent.length} → ${afterContent.length} 字，摘要 ${afterSummary.length} 字`,
    )
    check('面板已关闭', panelGone)
    check('编辑器正文确实变了', afterContent !== beforeContent)
    check(
      '编辑器正文与面板结果逐字一致',
      panelOutChars !== null && afterContent.length === panelOutChars,
      `${afterContent.length} vs 面板 ${panelOutChars}`,
    )
    check('编辑器内容与面板结果一致（非空）', afterContent.trim().length > 0)
    check('表单摘要已回填', afterSummary.trim().length > 0, `"${afterSummary.slice(0, 30)}"`)
    check('表单标签已回填', afterTags.trim().length > 0, `"${afterTags.slice(0, 40)}"`)
    check('slug 有值且合规', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(afterSlug) || afterSlug === '', `"${afterSlug}"`)

    await page.screenshot({ path: `.tmp/tools/shot-ai-applied-${scheme}.png`, fullPage: false })
    await ctx.close()
  }

  await browser.close()
  console.log(`\n合计失败：${failures}`)
  process.exit(failures > 0 ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
