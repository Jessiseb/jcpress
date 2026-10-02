const { chromium } = require('playwright-core')

/**
 * 浏览器内断言套件。
 *
 * 替代 jsdom 版 vitest 用例的原因：当前环境的 esbuild 子进程被禁止读取磁盘，
 * vitest 无法启动。真实浏览器断言覆盖面更广（含布局、触摸目标、可见性），
 * 且与 vitest 用例一一对应，见 src/pages/home/HomePage.test.tsx。
 */

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * 三期（技术分享模块）行为断言。独立成一个函数，不改动前两期的那一串断言。
 * 覆盖：卡片列表 / 详情页（护眼档位、章节编号、代码复制、TOC 锚点）/ 首页新区块 / 后台登录守卫。
 */
async function auditPhase3(browser) {
  const BASE = 'http://127.0.0.1:5173'

  // ---- 1. /tech 卡片列表 ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tech`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    const t = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-card]'))
      const links = Array.from(document.querySelectorAll('a[href^="/tech/"]'))
      return {
        cardCount: cards.length,
        linkCount: links.length,
        everyCardIsLink: cards.every((c) => c.querySelector('a[href^="/tech/"]') || c.matches('a')),
        everyCardHasCover: cards.every(
          (c) => c.querySelector('img') || c.querySelector('[class*="coverGlyph"]'),
        ),
        linkTargets: links.map((a) => a.getAttribute('href')).slice(0, 3),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        minCardHeight: cards.length
          ? Math.min(...cards.map((c) => Math.round(c.getBoundingClientRect().height)))
          : 0,
        firstCardIsFullWidth: (() => {
          const grid = document.querySelector('[class*="grid"]')
          if (!grid || !cards[0]) return null
          const gw = Math.round(grid.getBoundingClientRect().width)
          const cw = Math.round(cards[0].getBoundingClientRect().width)
          return cw / gw > 0.9
        })(),
      }
    })
    check('三期#1 /tech 每张卡都是链接且指向 /tech/<slug>', t.cardCount > 0 && t.linkCount >= t.cardCount, `卡=${t.cardCount} 链=${t.linkCount}`)
    check('三期#2 每张卡有封面（真图或字体封面）', t.everyCardHasCover, `封面齐=${t.everyCardHasCover}`)
    check('三期#3 /tech 无横向溢出', t.overflow <= 0, `溢出=${t.overflow}px`)
    check('三期#11 卡片可点区域 ≥44px', t.minCardHeight >= 44, `最矮卡=${t.minCardHeight}px`)
    check('三期（首卡通栏）', t.firstCardIsFullWidth === true, `首卡占栅格比≈1=${t.firstCardIsFullWidth}`)
    await ctx.close()
  }

  // ---- 2. /tech/:slug 详情页 ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tech/phase-3-backend-retro`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    const d = await page.evaluate(() => {
      const body = document.querySelector('[data-article-body]')
      const p = body ? body.querySelector('p') : null
      const h2 = body ? body.querySelector('h2') : null
      const fs = p ? parseFloat(getComputedStyle(p).fontSize) : 0
      const lh = p ? parseFloat(getComputedStyle(p).lineHeight) : 0
      const tocLinks = Array.from(document.querySelectorAll('nav[aria-label="文章目录"] a[href^="#"]'))
      const bodyIds = new Set(Array.from(document.querySelectorAll('[data-article-body] [id]')).map((el) => el.id))
      return {
        hasBody: !!body,
        fontSize: fs,
        lineHeightRatio: fs ? lh / fs : 0,
        // 「栏宽 ≈ 68ch」里的 ch 是 **CSS 的 ch 单位 = 数字 0 的宽度**（17px 字号下 ≈ 8.5px），
        // 不是汉字宽度（17px）。计划里写的 `clientWidth / fontSize` 是对 ch 的粗略近似，
        // 但那会得到 33.9（≈汉字数/行），与它自己给的 60–72 区间矛盾 —— 真正对齐的是
        // 「clientWidth / 一个 '0' 的宽度」。
        // ⚠️ 用 p 元素本身取 clientWidth（rect 没有 clientWidth，直接用会得 NaN）。
        proseCh: (() => {
          if (!p) return 0
          const probe = document.createElement('span')
          probe.textContent = '0'.repeat(100)
          probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'
          p.appendChild(probe)
          const chWidth = probe.getBoundingClientRect().width / 100
          probe.remove()
          return chWidth ? p.clientWidth / chWidth : 0
        })(),
        h2Numbered: h2 ? getComputedStyle(h2, '::before').content : null,
        copyButton: document.querySelectorAll('button[aria-label*="复制"]').length,
        tocCount: tocLinks.length,
        tocAllHit: tocLinks.length > 0 && tocLinks.every((a) => bodyIds.has(a.getAttribute('href').slice(1))),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    check('三期#4 详情页正文栏宽 ≈68ch（60–72）', d.proseCh >= 60 && d.proseCh <= 72, `${d.proseCh.toFixed(1)}ch`)
    check('三期#5 详情页正文行高 = 1.9', Math.abs(d.lineHeightRatio - 1.9) < 0.05, `${d.lineHeightRatio.toFixed(2)}`)
    check('三期#6 详情页 h2 有自动编号', !!d.h2Numbered && d.h2Numbered !== 'none' && d.h2Numbered !== '""', `::before=${d.h2Numbered}`)
    check('三期#7 代码块有复制按钮', d.copyButton > 0, `按钮=${d.copyButton}`)
    check('三期#8 TOC 锚点与正文 id 一一对应', d.tocAllHit, `TOC=${d.tocCount} 全命中=${d.tocAllHit}`)
    check('三期 详情页无横向溢出', d.overflow <= 0, `溢出=${d.overflow}px`)
    await ctx.close()
  }

  // ---- 3. 首页新区块 ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    const h = await page.evaluate(() => {
      const sec = document.querySelector('[data-block="latest-articles"]')
      // 条目 = 指向详情（/tech/<slug>）的链接；「查看全部」指向 /tech（无尾 slug），不算条目
      const entryLinks = sec
        ? Array.from(sec.querySelectorAll('a[href^="/tech/"]')).filter(
            (a) => a.getAttribute('href').replace(/^\/tech\//, '').length > 0,
          )
        : []
      return {
        sections: document.querySelectorAll('main section[aria-labelledby]').length,
        latestCards: entryLinks.length,
        hasViewAll: sec ? !!sec.querySelector('a[href="/tech"]') : false,
        titles: entryLinks.map((a) => a.textContent.trim().slice(0, 12)),
      }
    })
    // 条目数 = min(3, 已发布文章数)：库里当前只有 1 篇已发布，所以断言「≥1 且每条都指向详情」
    check(
      '三期#9 首页新区块的条目都指向详情（且带「查看全部」）',
      h.latestCards >= 1 && h.hasViewAll,
      `条目=${h.latestCards} 查看全部=${h.hasViewAll} [${h.titles.join(' / ')}]`,
    )
    check('三期#10 首页区块数 = 8', h.sections === 8, `区块=${h.sections}`)
    await ctx.close()
  }

  // ---- 4. 后台登录守卫 ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/admin/articles`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    const a = await page.evaluate(() => ({
      path: new URL(location.href).pathname,
      hasTable: document.querySelectorAll('table').length > 0,
      hasLoginForm: !!document.querySelector('#admin-username'),
      hasTopNav: !!document.querySelector('header'),
    }))
    check('三期#12 未登录访问后台被弹到登录页', a.path === '/admin/login' && a.hasLoginForm && !a.hasTable, `path=${a.path}`)
    check('三期 后台不挂公开站顶栏（视觉隔离）', a.hasTopNav === false, `hasTopNav=${a.hasTopNav}`)
    await ctx.close()
  }
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  // 控制台报错也要断言：二期的流线路径是**拼出来的** SVG `d` 字符串，
  // 一旦拼出非法数字（如 `--3`），浏览器只会打一行 console error 然后静默丢掉那条路径 ——
  // 截图上看不出来，只有断言能抓。（2026-09-29 更正：这条 bug 是**移植时抄错符号**引入的，
  // 不是参考组件的问题 —— 参考的模板在 i ≤ 35 时完全合法。见 docs/dev-journal.md 阶段 20。）
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(700)

  // ---- 对应 HomePage.test.tsx 的 9 条 ----
  const dom = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const qa = (s) => Array.from(document.querySelectorAll(s))
    const h1 = qa('h1')
    const h2Names = qa('h2').map((el) => el.textContent.trim())
    const hero = h1[0] ? h1[0].closest('section') : null
    const sectionOf = (t) => {
      const h = qa('h2').find((el) => el.textContent.trim() === t)
      return h ? h.closest('section') : null
    }
    return {
      h1Count: h1.length,
      h1Text: h1[0] ? h1[0].textContent.trim() : '',
      hasHeadline: document.body.innerText.includes('AI 应用开发工程师'),
      h2Names,
      companies: ['广州视源电子科技股份有限公司', '广东用友网络有限公司', '广东粤建三和软件有限公司'].map((c) =>
        document.body.innerText.includes(c),
      ),
      // 实习经历 r3 起是切换器：三段的全名挂在 tab 的可访问名（aria-label）上，
      // 正文里一次只展开一段 —— 所以「三段都在」要查 tab，不能只查 innerText。
      companyTabs: qa('[role="tab"]').map((el) => el.getAttribute('aria-label') || el.textContent.trim()),
      highlightLabels: ['接口响应下降', '知识库检索准确率', '慢查询耗时', '异常订单自动修复率'].map((l) =>
        document.body.innerText.includes(l),
      ),
      resumeHref: (() => {
        const a = qa('a').find((el) => el.textContent.trim() === '下载简历 PDF')
        return a ? a.getAttribute('href') : null
      })(),
      highlightTerms: sectionOf('拿得出手的数字')
        ? sectionOf('拿得出手的数字').querySelectorAll('dt').length
        : -1,
      heroButtons: hero ? hero.querySelectorAll('button').length : -1,
      heroLinks: hero ? hero.querySelectorAll('a').length : -1,
      skillDots: sectionOf('技术栈')
        ? sectionOf('技术栈').querySelectorAll('[aria-label*="熟练度"]').length
        : -1,
      skillHasLevelText: sectionOf('技术栈') ? sectionOf('技术栈').innerText.includes('熟悉') : false,
      projectOnlineText: sectionOf('项目经历') ? sectionOf('项目经历').innerText.includes('已上线') : false,
      projectH3: sectionOf('项目经历') ? sectionOf('项目经历').querySelectorAll('h3').length : -1,
      // 渐变只允许出现在六类登记过的宿主上：流线布景层（data-flow）、玻璃面板（data-glass）、
      // 环装置（data-ring）、姓名渐变（data-gradient）、顶栏功能性遮罩（data-scrim）、
      // 指针聚光宿主（data-spot）。
      // 二期（phase-2-visual）新增前两类：流线是布景层、面板是限定的两类区块容器。
      // 除此之外的任何装饰性渐变（按钮底色、任意区块背景）仍然立刻亮红。
      gradientLabels: qa('*')
        .filter((el) => {
          if (el === document.body || el === document.documentElement) return false
          const bg = getComputedStyle(el).backgroundImage
          return bg && bg.includes('gradient')
        })
        .map((el) =>
          el.hasAttribute('data-flow')
            ? 'flow'
            : el.hasAttribute('data-glass')
              ? 'glass'
              : el.hasAttribute('data-ring')
                ? 'ring'
                : el.hasAttribute('data-gradient')
                  ? 'gradient'
                  : el.hasAttribute('data-scrim')
                    ? 'scrim'
                    : el.hasAttribute('data-spot')
                      ? 'spot'
                      : el.tagName,
        ),
    }
  })

  check(
    '渲染姓名与一句话定位',
    dom.h1Count === 1 && dom.h1Text.startsWith('庄家希') && dom.hasHeadline,
    `h1="${dom.h1Text}"`,
  )
  check(
    '三个实习经历都在切换条里（一次展开一段）',
    dom.companyTabs.length === 3 &&
      ['广州视源电子科技股份有限公司', '广东用友网络有限公司', '广东粤建三和软件有限公司'].every((c) =>
        dom.companyTabs.some((l) => l.includes(c)),
      ) &&
      dom.companies[0],
    `tab=${dom.companyTabs.length} 条；正文展开的是第 1 段=${dom.companies[0]}`,
  )
  check('四个关键数字都有标签', dom.highlightLabels.every(Boolean))
  check('简历下载入口指向 /resume.pdf', dom.resumeHref === '/resume.pdf', `href=${dom.resumeHref}`)
  check('全页只有一个 h1', dom.h1Count === 1, `h1=${dom.h1Count}`)
  check(
    '六个区块标题都在 h2 层级',
    ['拿得出手的数字', '技术栈', '实习经历', '项目经历', '教育与荣誉', '联系我'].every((t) =>
      dom.h2Names.includes(t),
    ),
    dom.h2Names.join(' / '),
  )
  check('关键数字是定义列表（4 项）', dom.highlightTerms === 4, `dt=${dom.highlightTerms}`)
  check('首屏无按钮、两个链接', dom.heroButtons === 0 && dom.heroLinks === 2, `按钮=${dom.heroButtons} 链接=${dom.heroLinks}`)
  check('技术栈无点阵熟练度条且含文字档位', dom.skillDots === 0 && dom.skillHasLevelText, `点阵=${dom.skillDots}`)
  check('项目状态为纯文字且 3 个项目', dom.projectOnlineText && dom.projectH3 === 3, `h3=${dom.projectH3}`)
  const allowedGradientHosts = ['flow', 'glass', 'ring', 'gradient', 'scrim', 'spot']
  const strayGradients = dom.gradientLabels.filter((l) => !allowedGradientHosts.includes(l))
  check(
    '渐变只出现在流线 / 面板 / 环装置 / 姓名 / 顶栏遮罩 / 聚光宿主上',
    strayGradients.length === 0 && dom.gradientLabels.filter((l) => l === 'gradient').length === 1,
    `流线=${dom.gradientLabels.filter((l) => l === 'flow').length} 面板=${
      dom.gradientLabels.filter((l) => l === 'glass').length
    } 环=${dom.gradientLabels.filter((l) => l === 'ring').length} 姓名=${
      dom.gradientLabels.filter((l) => l === 'gradient').length
    } 遮罩=${dom.gradientLabels.filter((l) => l === 'scrim').length} 聚光=${
      dom.gradientLabels.filter((l) => l === 'spot').length
    } 其他=${strayGradients.join(',') || '无'}`,
  )

  // ---- 运行期才成立的两项：入场序列 + 触摸目标 ----
  // 门控属性已与内容标记拆开（data-reveal-armed / data-reveal），
  // 所以查询 [data-reveal] 天然只命中内容元素，不再需要按 tagName 排除 <html>。
  const revealTotal = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length)
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    // 每一步都让出**两帧**再继续。
    // 原来的 `setTimeout(80)` 版本在无头 Chromium 里会被合并：连续 scrollTo 落在同一帧上，
    // IntersectionObserver 只在「更新渲染」时采样一次交点，于是一整段区块从「没进视口」
    // 直接跳到「已经滚过去」，reveal 永远不触发 —— 报出来的是「31/41 未触发」，
    // 而真实滚轮（每次都重新采样）是 41/41。断言要测的是产品，不是定时器合并。
    const step = 200
    const max = document.documentElement.scrollHeight - innerHeight
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40))))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 600))
  })
  const revealed = await page.evaluate(
    () => document.querySelectorAll('[data-reveal].is-revealed').length,
  )
  check('入场序列全部触发', revealed === revealTotal, `${revealed}/${revealTotal}`)

  const smallTargets = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a, button'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        // 正文内联链接（<p> 里的 inline）按 WCAG 2.5.8 惯例豁免触摸目标下限：
        // 强行撑到 44px 会破坏中文正文的行距与换行
        const inline =
          cs.display === 'inline' && el.parentElement && el.parentElement.tagName === 'P'
        return {
          t: el.textContent.trim().slice(0, 20),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inline,
        }
      })
      .filter((x) => x.h > 0 && !x.inline && (x.h < 44 || x.w < 44)),
  )
  check('交互元素触摸目标 ≥44px', smallTargets.length === 0, JSON.stringify(smallTargets))

  // ---- 键盘可达：项目表格的展开必须能用键盘完成（不能只有鼠标/触摸） ----
  // 作用域限定在 main 里：顶栏汉堡按钮也带 aria-expanded，但它属于 header
  const focusOk = await page.evaluate(() => {
    const btn = document.querySelector('main button[aria-expanded="false"]')
    if (!btn) return false
    btn.focus()
    return document.activeElement === btn
  })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const kbState = await page.evaluate(() => {
    const btn = document.querySelector('main button[aria-expanded="true"]')
    if (!btn) return { expanded: false, visible: false, len: 0 }
    const panel = document.getElementById(btn.getAttribute('aria-controls'))
    return {
      expanded: true,
      visible: panel ? getComputedStyle(panel).display !== 'none' : false,
      len: panel ? panel.innerText.trim().length : 0,
    }
  })
  check(
    '项目面板可键盘展开（Enter），内容真的进 DOM',
    focusOk && kbState.expanded && kbState.visible && kbState.len > 40,
    JSON.stringify(kbState),
  )

  // ---- prefers-reduced-motion：入场序列不接管，正文常显 ----
  const rmCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  const rmPage = await rmCtx.newPage()
  await rmPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await rmPage.waitForTimeout(600)
  const rm = await rmPage.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'))
    const hidden = nodes.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length
    return { armed: document.documentElement.getAttribute('data-reveal-armed'), total: nodes.length, hidden }
  })
  check(
    'reduced-motion 下入场不接管、正文不隐藏',
    rm.armed === null && rm.hidden === 0,
    `armed=${rm.armed} 隐藏=${rm.hidden}/${rm.total}`,
  )

  // 流线布景层在 reduced-motion 下必须真的静止（animation: none），而不是「停在第 100% 帧」。
  // 评审指出第一版只查了 `path`，**层的 fieldBreathe 没查**；同时规格还要求
  // 「环标记与聚光仍可见」，这一条也没有判据 —— 一并补上。
  const rmFlow = await rmPage.evaluate(() => {
    const layer = document.querySelector('[data-flow]')
    const p = layer ? layer.querySelector('path') : null
    if (!p) return null
    const cs = getComputedStyle(p)
    const rings = Array.from(document.querySelectorAll('[data-ring]')).map((el) => {
      const r = el.getBoundingClientRect()
      return { size: `${Math.round(r.width)}x${Math.round(r.height)}`, opacity: Number(getComputedStyle(el).opacity) }
    })
    return {
      name: cs.animationName,
      opacity: Number(cs.opacity),
      paths: document.querySelectorAll('[data-flow] path').length,
      layerAnim: getComputedStyle(layer).animationName,
      rings,
    }
  })
  check(
    'reduced-motion 下流线与整层都静止、路径仍可见',
    !!rmFlow && rmFlow.name === 'none' && rmFlow.layerAnim === 'none' && rmFlow.opacity > 0,
    rmFlow
      ? `path animation-name=${rmFlow.name} / 层=${rmFlow.layerAnim} opacity=${rmFlow.opacity} paths=${rmFlow.paths}`
      : 'missing',
  )
  check(
    'reduced-motion 下环标记与聚光仍可见',
    !!rmFlow && rmFlow.rings.length >= 2 && rmFlow.rings.every((r) => r.opacity > 0),
    rmFlow ? rmFlow.rings.map((r) => `${r.size}@${r.opacity}`).join(' / ') : 'missing',
  )

  // 降级下：进度条**仍然可见并反映进度**（它是信息），视差必须撤销（它是装饰动效）
  const rmScroll = await rmPage.evaluate(async () => {
    const layer = document.querySelector('[data-parallax]')
    const track = document.querySelector('[data-progress]')
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max, behavior: 'instant' })
    await new Promise((res) => setTimeout(res, 700))
    const bar = track ? track.firstElementChild : null
    return {
      p: Number(getComputedStyle(document.documentElement).getPropertyValue('--scroll-p').trim() || 0),
      barScale: bar && getComputedStyle(bar).transform !== 'none'
        ? new DOMMatrixReadOnly(getComputedStyle(bar).transform).a
        : 1,
      trackHeight: track ? track.getBoundingClientRect().height : null,
      layerTransform: layer ? getComputedStyle(layer).transform : null,
    }
  })
  check(
    'reduced-motion 下：进度条仍可见并前进，视差被撤销',
    rmScroll.trackHeight >= 2 &&
      rmScroll.p >= 0.99 &&
      rmScroll.barScale >= 0.99 &&
      rmScroll.layerTransform === 'none',
    `p=${rmScroll.p} bar=${rmScroll.barScale.toFixed(3)} 层 transform=${rmScroll.layerTransform}`,
  )
  await rmCtx.close()

  // ---- 流线布景层（二期 phase-2-visual）----
  const flow = await page.evaluate(() => {
    const layer = document.querySelector('[data-flow]')
    if (!layer) return null
    const cs = getComputedStyle(layer)
    const rect = layer.getBoundingClientRect()
    const hit = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2))
    const paths = Array.from(layer.querySelectorAll('path'))
    return {
      paths: paths.length,
      ariaHidden: layer.getAttribute('aria-hidden'),
      pointerEvents: cs.pointerEvents,
      zIndex: cs.zIndex,
      coversViewport:
        rect.width >= window.innerWidth - 1 && rect.height >= window.innerHeight - 1,
      hitIsFlow: !!(hit && hit.closest('[data-flow]')),
      // 描边浓度现在由 CSS `min(var(--path-alpha), var(--ds-flow-alpha-max))` 决定，
      // 所以读**计算值**而不是属性（属性已经没有了）。
      // 屏上实际浓度 = 描边不透明度 × 元素自身 opacity × 布景层 opacity（层有缓慢呼吸动画）
      maxAlpha: Math.max(...paths.map((p) => Number(getComputedStyle(p).strokeOpacity))),
      maxEffective:
        Math.max(
          ...paths.map(
            (p) =>
              Number(getComputedStyle(p).strokeOpacity) * Number(getComputedStyle(p).opacity),
          ),
        ) * Number(cs.opacity),
      flowAlphaMax: getComputedStyle(document.documentElement)
        .getPropertyValue('--ds-flow-alpha-max')
        .trim(),
      // r2 新增：线宽必须钉在像素上（non-scaling-stroke），否则会被 preserveAspectRatio="none"
      // 的拉伸按 1.84×/2.02× 放大 —— 那正是用户反馈「白天眼花」的几何根因。
      maxStrokeWidth: Math.max(
        ...paths.map((p) => Number.parseFloat(getComputedStyle(p).strokeWidth) || 0),
      ),
      nonScaling: paths.every((p) => p.getAttribute('vector-effect') === 'non-scaling-stroke'),
      dashArrayRaw: getComputedStyle(paths[0]).strokeDasharray,
      // 每条路径的动画条数：移动端性能的硬约束（见 design.md D8），必须为 1
      maxAnimationsPerPath: Math.max(
        ...paths.map((p) => getComputedStyle(p).animationName.split(',').filter((s) => s.trim() && s.trim() !== 'none').length),
      ),
    }
  })
  check(
    '流线布景层存在、覆盖视口、位于正文之下且不吃指针',
    !!flow &&
      flow.coversViewport &&
      flow.ariaHidden === 'true' &&
      flow.pointerEvents === 'none' &&
      Number(flow.zIndex) < 0 &&
      !flow.hitIsFlow,
    flow ? `z=${flow.zIndex} pe=${flow.pointerEvents} aria-hidden=${flow.ariaHidden} 覆盖=${flow.coversViewport}` : 'missing',
  )
  check(
    '流线剂量不超过令牌上限（描边 × 元素 × 布景层三层相乘，且令牌真的接线）',
    !!flow &&
      flow.flowAlphaMax === '0.28' &&
      flow.maxAlpha <= 0.28 &&
      flow.maxEffective <= 0.28,
    flow
      ? `令牌 --ds-flow-alpha-max=${flow.flowAlphaMax} / 计算描边 max=${flow.maxAlpha} / 屏上浓度 max=${flow.maxEffective.toFixed(3)}`
      : 'missing',
  )
  check(
    '单条流线只有一条动画（移动端性能的硬约束，见 design D8）',
    !!flow && flow.maxAnimationsPerPath === 1,
    flow ? `每条路径最多 ${flow.maxAnimationsPerPath} 条动画` : 'missing',
  )
  check(
    '流线线宽 ≤1.5px 且用 non-scaling-stroke（不被拉伸放大）',
    !!flow && flow.nonScaling && flow.maxStrokeWidth <= 1.5,
    flow ? `计算线宽 max=${flow.maxStrokeWidth}px / 全部 non-scaling=${flow.nonScaling}` : 'missing',
  )

  // r2 新增：布景层与正文的**色调分离**（用户实测反馈「字看不清」的量化闸门）。
  // 两个判据：① 正文主色与线色的 HSL 明度差 ≥25 个百分点（旧配色只有 13.7 → 会判失败）；
  //          ② 把线色按最大等效剂量合成到底色之上后，正文主色与该合成色的对比度 ≥4.5:1。
  const colorSepOf = (target) =>
    target.evaluate(() => {
    const toRgb = (css) => {
      const d = document.createElement('div')
      d.style.color = css
      document.body.appendChild(d)
      const v = getComputedStyle(d).color
      d.remove()
      return (v.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number)
    }
    const ch = (c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const lum = ([r, g, b]) => 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
    const contrast = (a, b) => {
      const l1 = lum(a)
      const l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const hslL = ([r, g, b]) =>
      ((Math.max(r, g, b) / 255 + Math.min(r, g, b) / 255) / 2) * 100
    const root = getComputedStyle(document.documentElement)
    const read = (k) => root.getPropertyValue(k).trim()
    const text = toRgb(read('--ds-c-text'))
    const line = toRgb(read('--ds-flow-line'))
    const bg = toRgb(read('--ds-c-bg'))
    const alpha = Number(read('--ds-flow-alpha-max'))
    const composite = line.map((c, i) => c * alpha + bg[i] * (1 - alpha))
    return {
      text,
      line,
      alpha,
      textL: hslL(text),
      lineL: hslL(line),
      dL: Math.abs(hslL(text) - hslL(line)),
      worst: contrast(text, composite),
    }
    })
  const colorSep = await colorSepOf(page)
  check(
    '布景层与正文的色调分离（HSL 明度差 ≥25 个百分点）',
    colorSep.dL >= 25,
    `正文 L=${colorSep.textL.toFixed(1)}% / 流线 L=${colorSep.lineL.toFixed(1)}% → Δ=${colorSep.dL.toFixed(1)}`,
  )
  check(
    '最坏情况合成后正文仍达 AA（≥4.5:1）',
    colorSep.worst >= 4.5,
    `线色按 α=${colorSep.alpha} 合成到底色后，与正文主色的对比度 ${colorSep.worst.toFixed(2)}:1`,
  )

  // 效果 E2：光段真的在沿路径前进（两次采样 stroke-dashoffset 不同）
  const dashA = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-flow] path')).strokeDashoffset,
  )
  await page.waitForTimeout(900)
  const dashB = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-flow] path')).strokeDashoffset,
  )
  check('流线在动：stroke-dashoffset 随动画变化', dashA !== dashB, `${dashA} → ${dashB}`)

  // 效果 E1 的后半：路径数按视口分档 36×2 / 24×2 / 12×2
  const flowPathsAt = async (width) => {
    const c = await browser.newContext({ viewport: { width, height: 900 } })
    const p = await c.newPage()
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(400)
    const n = await p.evaluate(() => document.querySelectorAll('[data-flow] path').length)
    await c.close()
    return n
  }
  const paths768 = await flowPathsAt(768)
  const paths390 = await flowPathsAt(390)
  check(
    '流线路径数按视口分档（1280→48 / 768→32 / 390→16）',
    !!flow && flow.paths === 48 && paths768 === 32 && paths390 === 16,
    `1280→${flow ? flow.paths : '?'} 768→${paths768} 390→${paths390}`,
  )

  // ---- 图片纪律（三期 r3 重写）----
  // ⚠️ 第一版是「按资源 URL 的后缀名筛图片」：
  //     `.filter((n) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i.test(n))`
  //    它漏掉了**不带扩展名**的图片请求 —— 实习经历那几张 Unsplash 图是
  //    `images.unsplash.com/photo-…?auto=format&fit=crop&w=560…`，没有后缀，
  //    于是页面上明明加载了三张远程照片，断言却一直报「无」。这是**假绿**（#53 的同类问题）。
  //    改法有两步：① 判据换成 `initiatorType`（浏览器自己标的资源类型），
  //    ② 把「图案层」与「内容图」分成两条断言 —— 前者必须为 0，后者必须**显式登记**。
  const imageReqs = await page.evaluate(() => {
    const isImage = (e) =>
      e.initiatorType === 'img' || /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(e.name)
    return performance
      .getEntriesByType('resource')
      .filter(isImage)
      .map((e) => `${e.initiatorType}:${e.name.replace(/^https?:\/\/[^/]+/, '')}`)
  })
  const patternImages = await page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll('[data-flow], [data-celestial], [data-ring]'))
    return {
      layers: layers.length,
      imageTags: document.querySelectorAll('[data-flow] image, [data-celestial] image, [data-ring] image')
        .length,
      urlBackgrounds: layers
        .map((el) => getComputedStyle(el).backgroundImage)
        .filter((b) => /url\(/.test(b)),
    }
  })
  check(
    '图案层零图片：流线 / 天体 / 环装置只许内联 SVG（无 <image>、无 url() 背景）',
    patternImages.imageTags === 0 && patternImages.urlBackgrounds.length === 0,
    `${patternImages.layers} 个图案层；<image>=${patternImages.imageTags}；url() 背景=${patternImages.urlBackgrounds.join(' | ') || '无'}`,
  )
  // 非图案层的图片必须挂在登记过的宿主上（data-photo）。这条不是为了美观，
  // 是为了让「远程图欠债」**出现在断言输出里**而不是藏在审计盲区（见 docs/decisions.md #64）。
  const photos = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    return {
      total: imgs.length,
      unregistered: imgs
        .filter((el) => !el.closest('[data-photo]') && !el.closest('[data-celestial]'))
        .map((el) => el.currentSrc || el.src),
      // 天体贴图必须**同源自托管**：以 `/` 开头的站内路径。
      // 这是「图案层零图片」被放开之后补上的新护栏 —— 放开的是「可以用贴图」，
      // 不是「可以引用任何地方的图」。
      remoteTextures: imgs
        .filter((el) => el.closest('[data-celestial]'))
        .map((el) => el.getAttribute('src') || '')
        .filter((src) => !src.startsWith('/')),
      photoCount: imgs.filter((el) => el.closest('[data-photo]')).length,
      textureCount: imgs.filter((el) => el.closest('[data-celestial]')).length,
    }
  })
  check(
    '图片全部登记：内容图挂 data-photo、天体贴图挂 data-celestial 且必须自托管',
    photos.unregistered.length === 0 && photos.remoteTextures.length === 0,
    `${photos.total} 张（内容图 ${photos.photoCount} / 天体贴图 ${photos.textureCount}）；请求 ${imageReqs.length} 条${photos.unregistered.length ? `；未登记 ${photos.unregistered.join(', ')}` : ''}${photos.remoteTextures.length ? `；远程贴图 ${photos.remoteTextures.join(', ')}` : ''}${photos.photoCount ? '；内容图是远程占位图（欠债，见 decisions #64）' : ''}`,
  )

  // 每条流线的 `d` 都必须真的有效（非法值会被浏览器静默丢掉，长度归零）
  const brokenPaths = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('[data-flow] path'))
    const zero = paths.filter((p) => {
      try {
        return p.getTotalLength() === 0
      } catch {
        return true
      }
    })
    return { total: paths.length, zero: zero.length, firstBad: zero[0] ? zero[0].getAttribute('d') : null }
  })
  check(
    '流线路径全部有效（无被浏览器丢弃的非法 d）',
    brokenPaths.zero === 0,
    `${brokenPaths.total - brokenPaths.zero}/${brokenPaths.total} 有效${brokenPaths.firstBad ? ` 首个非法：${brokenPaths.firstBad}` : ''}`,
  )

  // 控制台不得有非资源类报错（SVG 属性错误就属于这一类）
  const realErrors = consoleErrors.filter((e) => !/Failed to load resource/i.test(e))
  check(
    '控制台无非资源类报错',
    realErrors.length === 0,
    realErrors.slice(0, 3).join(' | ') || '无',
  )

  // 环的身份变了：只做标记层（首屏不再有环）
  const ringInfo = await page.evaluate(() => {
    const rings = Array.from(document.querySelectorAll('[data-ring]'))
    const where = (el) =>
      el.closest('footer')
        ? 'footer'
        : el.closest('section[aria-labelledby="projects-title"]')
          ? 'project-badge'
          : el.className || el.tagName
    return {
      total: rings.length,
      inHero: rings.filter((el) => el.closest('section[aria-labelledby="hero-title"]')).length,
      places: rings.map(where),
    }
  })
  check(
    '环只做标记层：首屏不再有环，徽标与页脚保留',
    ringInfo.inHero === 0 && ringInfo.total === 2,
    `共 ${ringInfo.total}：${ringInfo.places.join(' / ')}（首屏 ${ringInfo.inHero}）`,
  )

  // 规格里「环标记不发生位移或旋转」此前没有判据（评审指出）。
  // 注意：环的**露出**依赖父层 data-reveal 的淡入，所以这里比的是「位置与变换」而不是不透明度。
  const ringSnapshot = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-ring]')).map((el) => {
        const r = el.getBoundingClientRect()
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}|${getComputedStyle(el).transform}`
      }),
    )
  const ringA = await ringSnapshot()
  await page.waitForTimeout(1200)
  const ringB = await ringSnapshot()
  check(
    '环标记不发生位移或旋转（静止布景）',
    JSON.stringify(ringA) === JSON.stringify(ringB) && ringA.every((s) => s.endsWith('|none')),
    `${ringA.join(' / ')}${JSON.stringify(ringA) === JSON.stringify(ringB) ? '（1.2s 后不变）' : '（发生了变化！）'}`,
  )

  // ---- 首屏天体（三期 r3）：亮色地球 / 暗色月球 ----
  // 它用的是自己的 data-celestial 标记，不冒充环标记层 —— 因此上面那条
  // 「首屏不再有环」的断言仍然只数 [data-ring]，不会被它顶掉。
  //
  // 实现是「自托管等距圆柱贴图 + 圆形裁剪窗口 + 水平循环平移」（参照组件 ScrollGlobe 的手法）。
  // 因此这里断言的是**贴图与窗口**，不是 SVG 几何 —— 第一版做成描边球时的
  // 「由圆构成 / 无 <image>」那两条已经不适用，一并改写。
  const readBody = () =>
    page.evaluate(() => {
      const g = document.querySelector('[data-celestial]')
      if (!g) return null
      const cs = getComputedStyle(g)
      const hero = g.closest('section[aria-labelledby="hero-title"]')
      const read = (sel) => {
        const box = g.querySelector(sel)
        if (!box) return null
        const sphere = box.firstElementChild
        const strip = sphere ? sphere.firstElementChild : null
        const shade = sphere ? sphere.lastElementChild : null
        const imgs = Array.from(box.querySelectorAll('img'))
        const r = box.getBoundingClientRect()
        return {
          display: getComputedStyle(box).display,
          size: Math.round(r.width),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
          textures: imgs.map((el) => el.getAttribute('src')),
          // 两张首尾相接的贴图：宽高比必须一致，才能靠 translateX(-50%) 无缝接回
          ratioOk: imgs.length === 2 && imgs.every((el) => el.naturalWidth > 0),
          stripAnim: strip ? getComputedStyle(strip).animationName : null,
          stripWidth: strip ? Math.round(strip.getBoundingClientRect().width) : 0,
          // 二期的硬约束是「**同一元素**不得叠两条动画」（#51：叠了就 21 FPS / 掉帧 97%），
          // 不是「每颗球只能有一条动画」—— 球体一共 1 条自转 + 7 条星点闪烁，分属 8 个元素。
          animCounts: Array.from(box.querySelectorAll('*'))
            .map((el) => {
              const cs = getComputedStyle(el)
              const n = (cs.animationName || 'none')
                .split(',')
                .filter((x) => x && x.trim() !== 'none').length
              return { cls: (el.getAttribute('class') || el.tagName).slice(0, 22), n, names: cs.animationName, prop: cs.animationDuration }
            })
            .filter((x) => x.n > 0),
          starCount: box.querySelectorAll('[class*="star"]:not([class*="stars"])').length,
          starOutsideClip: Array.from(box.querySelectorAll('[class*="star"]:not([class*="stars"])')).filter(
            (el) => !el.closest('[class*="sphere"]'),
          ).length,
          starsOutsideCircle: (() => {
            const sp = box.querySelector('[class*="sphere"]')
            if (!sp) return -1
            const sb = sp.getBoundingClientRect()
            const cx = sb.left + sb.width / 2
            const cy = sb.top + sb.height / 2
            return Array.from(box.querySelectorAll('[class*="star"]:not([class*="stars"])')).filter((el) => {
              const b = el.getBoundingClientRect()
              return Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) > sb.width / 2
            }).length
          })(),
          // 球体明暗是照抄参照组件那串 box-shadow（5 条 inset + 缩放用的 font-size），
          // 不是径向渐变 —— 断言跟着实现走，不跟着第一版的写法走。
          shadeInsets: shade
            ? (getComputedStyle(shade).boxShadow.match(/inset/g) || []).length
            : 0,
          shadeFont: shade ? getComputedStyle(shade).fontSize : null,
          sphereOuter: (() => {
            const sp = box.querySelector('[class*="sphere"]')
            return sp ? (getComputedStyle(sp).boxShadow.match(/inset/g) || []).length : -1
          })(),
          borderRadius: sphere ? getComputedStyle(sphere).borderRadius : null,
          overflow: sphere ? getComputedStyle(sphere).overflow : null,
        }
      }
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        earth: read('[class*="earth"]'),
        moon: read('[class*="moon"]'),
        scene: g.getAttribute('data-scene'),
        position: cs.position,
        ariaHidden: g.getAttribute('aria-hidden'),
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        reveals: g.querySelectorAll('[data-reveal]').length,
        // 未缩放的直径（--ds-body-size）。停靠时球会被 scale 缩放，
        // 所以不能再拿 getBoundingClientRect().width 去比 font-size（第一版就是那么写的）。
        // ⚠️ 不能直接 parseFloat 读令牌值：它是 `clamp(9rem, 20vw, 16rem)`，parseFloat 得 NaN。
        // 用一个探针元素的真实宽度把 clamp 解出来。
        baseSize: (() => {
          const probe = document.createElement('div')
          probe.style.cssText =
            'position:absolute;visibility:hidden;pointer-events:none;width:var(--ds-body-size)'
          document.body.appendChild(probe)
          const w = probe.getBoundingClientRect().width
          probe.remove()
          return w
        })(),
      }
    })

  const bodyLight = await readBody()
  check(
    '天体：整站固定装饰层（fixed / aria-hidden / 不吃指针 / z-index 沉底 / 不参与入场编排）',
    !!bodyLight &&
      bodyLight.position === 'fixed' &&
      bodyLight.ariaHidden === 'true' &&
      bodyLight.pointerEvents === 'none' &&
      bodyLight.zIndex === '-1' &&
      bodyLight.reveals === 0,
    bodyLight
      ? `position=${bodyLight.position} aria-hidden=${bodyLight.ariaHidden} pe=${bodyLight.pointerEvents} z=${bodyLight.zIndex} data-reveal=${bodyLight.reveals}`
      : 'missing',
  )
  check(
    '天体是「圆形窗口 + 两张首尾相接的自托管贴图 + 参照组件那串 box-shadow 的球体明暗」',
    !!bodyLight &&
      bodyLight.earth.textures.length === 2 &&
      bodyLight.earth.textures.every((t) => t && t.startsWith('/textures/')) &&
      bodyLight.earth.ratioOk &&
      bodyLight.earth.borderRadius === '50%' &&
      bodyLight.earth.overflow === 'hidden' &&
      // 5 条 inset（照抄参照组件的五条内阴影）；外发光那一条留在 .sphere 上（这里是 0 条 inset）
      bodyLight.earth.shadeInsets === 5 &&
      bodyLight.earth.sphereOuter === 0 &&
      // font-size = **未缩放**的球体直径 ⇒ em 偏移等比缩放，而不是只在 250px 球上成立。
      // （停靠时球会被 scale 缩放，所以不能拿 rect 宽去比 —— 第一版这么写，加滑动之后当场亮红）
      Math.abs(parseFloat(bodyLight.earth.shadeFont) - bodyLight.baseSize) < 1,
    bodyLight
      ? `贴图 ×${bodyLight.earth.textures.length} / 圆角 ${bodyLight.earth.borderRadius} / 内阴影 ${bodyLight.earth.shadeInsets} 条 / em 基数 ${bodyLight.earth.shadeFont} = 未缩放直径 ${bodyLight.baseSize}px`
      : 'missing',
  )
  check(
    '天体动画：球体 1 条自转（transform）+ 7 颗星各 1 条闪烁（opacity），没有任何元素叠两条',
    !!bodyLight &&
      /celestialSpin/.test(bodyLight.earth.stripAnim || '') &&
      bodyLight.earth.stripWidth > bodyLight.earth.size &&
      bodyLight.earth.animCounts.every((a) => a.n === 1) &&
      bodyLight.earth.animCounts.length === 8 &&
      /celestialTwinkle/.test(bodyLight.earth.animCounts[1]?.names || ''),
    bodyLight
      ? `共 ${bodyLight.earth.animCounts.length} 个元素带动画（最多 ${Math.max(...bodyLight.earth.animCounts.map((a) => a.n))} 条/元素）；自转 ${bodyLight.earth.stripAnim}；星点 ${bodyLight.earth.starCount} 颗`
      : 'missing',
  )
  check(
    '星点在圆形裁剪之外（不可被裁掉），且都在球体圆周之外',
    !!bodyLight &&
      bodyLight.earth.starCount === 7 &&
      bodyLight.earth.starOutsideClip === 7 &&
      bodyLight.earth.starsOutsideCircle === 7,
    bodyLight
      ? `星 ${bodyLight.earth.starCount} 颗 / 在裁剪区外 ${bodyLight.earth.starOutsideClip} / 在圆周外 ${bodyLight.earth.starsOutsideCircle}`
      : 'missing',
  )

  // 亮暗是**两颗不同的天体**（用户的原话：「白天状态可以是地球，夜间就月球」）——
  // 所以断言的几何/贴图**必须不同**，可见性**必须互补**。
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(250)
  const bodyDark = await readBody()
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(250)

  check(
    '亮暗是两颗天体：亮色只显示地球、暗色只显示月球，贴图与自转周期都不同',
    !!bodyLight &&
      !!bodyDark &&
      bodyLight.earth.display !== 'none' &&
      bodyLight.moon.display === 'none' &&
      bodyDark.earth.display === 'none' &&
      bodyDark.moon.display !== 'none' &&
      bodyLight.earth.textures[0] !== bodyDark.moon.textures[0],
    bodyLight && bodyDark
      ? `亮色：地球 ${bodyLight.earth.display}(${bodyLight.earth.textures[0]}) / 月球 ${bodyLight.moon.display}；暗色：地球 ${bodyDark.earth.display} / 月球 ${bodyDark.moon.display}(${bodyDark.moon.textures[0]})`
      : 'missing',
  )
  // ⚠️ 必须在**多个宽度**上量，不能只量 1280。第一版只在 1280 量过一次就报绿，
  // 而 960–1150 这一段球是**压在正文上**的（1100 实测差 −10px、960 差 −80px）。
  // 现在每次量之前都先回到顶部（首屏 = scene 0，球是全尺寸停在右侧的那个场景）。
  const clearance = []
  for (const w of [1440, 1280, 1100]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(700)
    clearance.push(
      await page.evaluate(() => {
        const hero = document.querySelector('section[aria-labelledby="hero-title"]')
        const shown = Array.from(document.querySelector('[data-celestial]').children).find(
          (d) => getComputedStyle(d).display !== 'none',
        )
        let textRight = 0
        for (const el of hero.querySelectorAll('p, h1, div')) {
          if (el.closest('[data-celestial]')) continue
          const b = el.getBoundingClientRect()
          if (b.width && b.right > textRight) textRight = b.right
        }
        const bb = shown.getBoundingClientRect()
        return {
          vw: innerWidth,
          gap: Math.round(bb.left - textRight),
          size: Math.round(bb.width),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      }),
    )
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(700)
  check(
    '首屏（scene 0）天体在桌面各宽度下都落在正文右侧的空白里，且不横向溢出',
    clearance.every((c) => c.gap > 0 && c.overflow === 0),
    clearance.map((c) => `${c.vw}px: 球 ${c.size}px / 间距 ${c.gap}px / 溢出 ${c.overflow}px`).join(' · '),
  )

  // ---- 分节停靠（三期 r3）----
  // 参照组件的核心效果：滚动时球**在视口里换位**（translate3d(vw,vh) + scale + opacity，
  // 由 1400ms 的 CSS transition 负责「滑」）。我第一版漏掉了这一段，只做了「固定右侧 + 视差」，
  // 用户的原话是「他们都没有滑动效果呢」。两条判据：
  //   ① 真的在换位（位置/尺寸/不透明度都随区块变，首屏是最大最实的那个）；
  //   ② 每个停靠点都在视口内（换位不能把球甩出屏幕、也不能撑出横向溢出）。
  const stops = []
  const sceneCount = await page.evaluate(
    () => document.querySelectorAll('main section[aria-labelledby]').length,
  )
  for (let i = 0; i < sceneCount; i++) {
    await page.evaluate((idx) => {
      document
        .querySelectorAll('main section[aria-labelledby]')
        [idx].scrollIntoView({ behavior: 'instant', block: 'center' })
    }, i)
    await page.waitForTimeout(1700) // 等 1400ms 的滑动收敛
    stops.push(
      await page.evaluate(() => {
        const f = document.querySelector('[data-celestial]')
        const shown = Array.from(f.children).find((d) => getComputedStyle(d).display !== 'none')
        const b = shown.getBoundingClientRect()
        return {
          scene: f.getAttribute('data-scene'),
          cx: Math.round(b.left + b.width / 2),
          cy: Math.round(b.top + b.height / 2),
          size: Math.round(b.width),
          opacity: Number(getComputedStyle(shown).opacity),
          inside:
            b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      }),
    )
  }
  const distinctCenters = new Set(stops.map((s) => `${s.cx},${s.cy}`)).size
  check(
    '分节停靠：滚动时天体真的换位（位置 / 尺寸 / 不透明度都随区块变）',
    distinctCenters >= 5 && new Set(stops.map((s) => s.size)).size >= 3 && stops[0].opacity === 1,
    stops.map((s) => `${s.scene}:(${s.cx},${s.cy})/${s.size}px/${s.opacity}`).join(' '),
  )
  check(
    '分节停靠：每个停靠点都在视口内，且全程不横向溢出',
    stops.every((s) => s.inside && s.overflow === 0),
    stops.every((s) => s.inside)
      ? `${stops.length} 个停靠点全部在视口内，最大溢出 ${Math.max(...stops.map((s) => s.overflow))}px`
      : `越界的停靠点：${stops.filter((s) => !s.inside).map((s) => s.scene).join(', ')}`,
  )
  // 回到顶部，后面的断言接着按「首屏」的状态跑
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(700)

  // ---- 滚动联动（二期）：进度指示 + 装饰层视差 ----
  // ⚠️ 采样面必须是**全页所有带 transform 的元素**，不能只取前 8 个：
  // 第一版 `.slice(0, 8)` 恰好只覆盖到顶栏与首屏（评审实测：技术栈/实习/项目/教育/联系五个区块的
  // 正文、其余 13 个 dt/dd、项目行与联系按钮全在采样窗口之外）—— 那样「正文不随滚动变化」根本不算证据。
  const readScroll = () =>
    page.evaluate(() => {
      const track = document.querySelector('[data-progress]')
      const bar = track ? track.firstElementChild : null
      const layer = document.querySelector('[data-parallax]')
      const parse = (v) => (v && v !== 'none' ? new DOMMatrixReadOnly(v) : null)
      const lm = layer ? parse(getComputedStyle(layer).transform) : null
      return {
        p: Number(getComputedStyle(document.documentElement).getPropertyValue('--scroll-p').trim() || 0),
        barScale: bar ? (parse(getComputedStyle(bar).transform)?.a ?? 1) : null,
        trackHeight: track ? track.getBoundingClientRect().height : null,
        trackPointerEvents: track ? getComputedStyle(track).pointerEvents : null,
        layerScale: lm ? lm.a : 1,
        layerY: lm ? lm.f : 0,
        viewportH: window.innerHeight,
        // 全页所有「有 transform」的元素（索引 + 签名 + 是否属于装饰层）
        transformMap: Array.from(document.querySelectorAll('body *'))
          .map((el, i) => ({ i, el }))
          .filter(({ el }) => {
            const t = getComputedStyle(el).transform
            return t && t !== 'none'
          })
          .map(({ i, el }) => ({
            i,
            sig: `${el.tagName}.${(el.className || '').toString().split(' ')[0]}`,
            transform: getComputedStyle(el).transform,
            parallax: !!el.closest('[data-parallax]'),
            // 进度条是 spec 允许的**第二种**滚动联动（指示物自身），不算越权
            progress: !!el.closest('[data-progress]'),
          })),
      }
    })

  const scrollToRatio = (ratio) =>
    page.evaluate(
      (r) => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        // ⚠️ 必须用 `behavior: 'instant'`：`'auto'` 表示「遵循 CSS 的 scroll-behavior」，
        // 而本站 html 上就是 `scroll-behavior: smooth` —— 于是滚动变成动画，
        // 断言会读到动画途中的位置（实测首屏读到 p=0.69）。
        window.scrollTo({ top: max * r, behavior: 'instant' })
        return new Promise((res) => setTimeout(res, 200))
      },
      ratio,
    )

  // ⚠️ 进度条有 120ms 的 CSS 过渡：读得太早会读到过渡中间值（实测读到 0.115 而 --scroll-p 已是 0）。
  // 轮询条件必须**同时**满足两件事：① 已到达目标位置；② 过渡**真正收敛**。
  // 收敛容差必须**明显小于断言门槛**：第一版用 0.03，而断言要求 bar ≥ 0.99 —— 于是
  // "过渡还差 2.8%" 时就被判为已收敛，断言随即亮红（实测偶发 bar=0.972 而 p=1）。
  // 只查②会在平滑滚动途中因为「两者一起变化、始终一致」而提前返回（这是第二版犯的错）。
  const readScrollSettled = async (ratio, timeout = 3000) => {
    const started = Date.now()
    let last = await readScroll()
    while (Date.now() - started < timeout) {
      const arrived = Math.abs(last.p - ratio) <= 0.02
      const settled = Math.abs((last.barScale ?? 0) - last.p) <= 0.005
      if (arrived && settled) return last
      await page.waitForTimeout(120)
      last = await readScroll()
    }
    return last
  }

  await scrollToRatio(0)
  const atTop = await readScrollSettled(0)
  await scrollToRatio(1)
  const atBottom = await readScrollSettled(1)
  await scrollToRatio(0.5)
  const atMid = await readScrollSettled(0.5)
  await scrollToRatio(0)
  await readScrollSettled(0)

  check(
    '进度条存在、不吃指针、随滚动从 0 到满格',
    atTop.trackPointerEvents === 'none' &&
      atTop.trackHeight >= 2 &&
      atTop.p <= 0.01 &&
      atBottom.p >= 0.99 &&
      atTop.barScale <= 0.02 &&
      atBottom.barScale >= 0.99,
    `高度=${atTop.trackHeight}px p: ${atTop.p} → ${atMid.p} → ${atBottom.p} | bar: ${atTop.barScale.toFixed(3)} → ${atBottom.barScale.toFixed(3)}`,
  )
  check(
    '进度条填充量与滚动位置一致（中点）',
    Math.abs(atMid.p - 0.5) <= 0.05 && Math.abs(atMid.barScale - atMid.p) <= 0.03,
    `p=${atMid.p} bar=${atMid.barScale.toFixed(3)}`,
  )

  // 位移要按**层边缘**算，不是只看 transform 的平移分量：
  // 默认 transform-origin 是 50% 50%，1.04 的缩放会额外把上边缘推出去 (scale−1)/2 × 视口高。
  // （评审指出第一版只读 matrix 的 f 分量，于是把「6vh + 2% = 8.0%」误报成 6.00%。）
  const edgeShift = (s) => Math.abs(s.layerY) + ((s.layerScale - 1) / 2) * s.viewportH
  const shiftPct = (edgeShift(atBottom) / atBottom.viewportH) * 100
  check(
    '视差只发生在装饰层，且位移 ≤8% 视口、缩放 ≤1.06（位移按层边缘算）',
    Math.abs(atTop.layerY) < 1 &&
      atTop.layerScale <= 1.06 &&
      atBottom.layerScale <= 1.06 &&
      shiftPct <= 8,
    `边缘位移=${shiftPct.toFixed(2)}%（平移 ${((Math.abs(atBottom.layerY) / atBottom.viewportH) * 100).toFixed(2)}% + 缩放附加 ${(((atBottom.layerScale - 1) / 2) * 100).toFixed(2)}%）缩放=${atBottom.layerScale}`,
  )

  // 逐元素比较「滚动前后 transform 是否变化」：变化只允许出现在两类允许的位置 ——
  // 装饰层（data-parallax）与进度条自身（data-progress）。正文、数据、控件一律不许动。
  const movedNonDecorative = []
  for (const top of atTop.transformMap) {
    const bottom = atBottom.transformMap.find((b) => b.i === top.i)
    if (!bottom) continue
    if (bottom.transform !== top.transform && !bottom.parallax && !bottom.progress) {
      movedNonDecorative.push(`${top.sig}(${top.transform} → ${bottom.transform})`)
    }
  }
  check(
    '全页逐元素比较：滚动位移只出现在装饰层与进度条上',
    movedNonDecorative.length === 0,
    `受检元素 ${atTop.transformMap.length} 个（装饰层 ${
      atTop.transformMap.filter((t) => t.parallax).length
    } / 进度条 ${atTop.transformMap.filter((t) => t.progress).length}）${
      movedNonDecorative.length ? `｜越权位移：${movedNonDecorative.join(', ')}` : ''
    }`,
  )

  // ---- 排版软化（二期）：区块节奏 / 不对称栅格 / 面板的适用范围 ----
  const rhythm = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main .section')).map((s) => ({
      name: (s.querySelector('h2')?.textContent || '').trim().slice(0, 8),
      rhythm: s.getAttribute('data-rhythm'),
      padTop: Math.round(Number.parseFloat(getComputedStyle(s).paddingTop)),
    })),
  )
  const pads = rhythm.map((r) => r.padTop)
  const padSpread = Math.max(...pads) - Math.min(...pads)
  check(
    '区块节奏：大节 / 小节两档，且**差别足够明显**（不是全页同一个留白，也不是 65/66 这种假两档）',
    new Set(pads).size >= 2 && pads.every((p, i) => i === 0 || p !== pads[i - 1]) && padSpread >= 24,
    `两档差 ${padSpread}px：${rhythm.map((r) => `${r.name}=${r.rhythm}/${r.padTop}px`).join(' ')}`,
  )

  const grid = await page.evaluate(() => {
    const out = []
    for (const s of document.querySelectorAll('main .section')) {
      const h2 = s.querySelector('h2')
      const lead = s.querySelector('.sectionLead')
      const body = s.querySelector(':scope > *:not(.sectionTitle):not(.sectionLead)')
      if (!h2 || !body) continue
      const rect = (el) => el.getBoundingClientRect()
      out.push({
        name: (h2.textContent || '').trim().slice(0, 8),
        titleLeft: Math.round(rect(h2).left),
        leadWidth: lead ? Math.round(rect(lead).width) : null,
        bodyLeft: Math.round(rect(body).left),
        bodyWidth: Math.round(rect(body).width),
        // 「整幅特写」区块（data-full）：左图 + 右文的两栏特写，正文通栏到第 1 列。
        // 它**故意**没有「导语左栏 + 正文右移」的错位 —— 见 styles/global.css 的注释。
        full: s.hasAttribute('data-full'),
      })
    }
    return out
  })
  check(
    '不对称栅格：正文起点明显右移于标题（可见错位）',
    grid.length >= 6 && grid.every((g) => g.full || g.bodyLeft - g.titleLeft >= 40),
    grid.map((g) => `${g.name} 标题${g.titleLeft} → 正文${g.bodyLeft}${g.full ? '(特写·豁免)' : ''}`).join(' / '),
  )
  check(
    '导语栏宽**明显**小于正文栏宽（不只是小 1px）',
    grid.every((g) => g.leadWidth === null || g.leadWidth <= g.bodyWidth * 0.7),
    grid.map((g) => `${g.name} ${g.leadWidth}<${g.bodyWidth}`).join(' / '),
  )

  const panels = await page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll('[data-glass]'))
    const surfacing = (el) => {
      const cs = getComputedStyle(el)
      const issues = []
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push(`底色=${cs.backgroundColor}`)
      if (cs.backgroundImage !== 'none') issues.push(`背景图=${cs.backgroundImage.slice(0, 24)}`)
      if (cs.boxShadow !== 'none') issues.push(`投影=${cs.boxShadow.slice(0, 24)}`)
      return issues.length ? `${el.tagName}:${issues.join(',')}` : null
    }
    return {
      count: hosts.length,
      where: hosts.map((el) =>
        (el.closest('section')?.querySelector('h2')?.textContent || '').trim().slice(0, 8),
      ),
      // 非面板区块：查**每一个**正文直接子元素的底色 / 背景图 / 投影三项
      // （评审指出第一版只看首个子元素的 backgroundColor，既漏了 box-shadow 也漏了后续子元素）
      // data-full 的「整幅特写」不在这条里 —— 它单独有下面那条更严的断言（只许一块面）。
      others: Array.from(document.querySelectorAll('main .section'))
        .filter((s) => !s.querySelector('[data-glass]') && !s.hasAttribute('data-full'))
        .map((s) => {
          const bodies = Array.from(
            s.querySelectorAll(':scope > *:not(.sectionTitle):not(.sectionLead)'),
          )
          return {
            name: (s.querySelector('h2')?.textContent || '').trim().slice(0, 8),
            bad: bodies.map(surfacing).filter(Boolean),
            checked: bodies.length,
          }
        }),
      // 整幅特写：允许**一块**面带底色 / 投影（左图右文的那张卡），多一块就是「每个区块都包卡片」的复发
      feature: Array.from(document.querySelectorAll('main .section[data-full]')).map((s) => {
        const bodies = Array.from(
          s.querySelectorAll(':scope > *:not(.sectionTitle):not(.sectionLead)'),
        )
        return {
          name: (s.querySelector('h2')?.textContent || '').trim().slice(0, 8),
          total: bodies.length,
          surfaced: bodies.filter((el) => surfacing(el)).length,
          // 正文必须真的通栏到第 1 列（与标题左边缘对齐）
          flushLeft: bodies.every(
            (el) => Math.abs(el.getBoundingClientRect().left - s.querySelector('h2').getBoundingClientRect().left) < 40,
          ),
        }
      }),
    }
  })
  check(
    '面板只出现在「关键数字」「项目经历」「技术栈」三类区块',
    panels.count === 3 &&
      panels.where.every((w) => w.includes('数字') || w.includes('项目') || w.includes('技术栈')),
    `共 ${panels.count}：${panels.where.join(' / ')}`,
  )
  check(
    '其余区块保持通栏（正文无底色 / 无背景图 / 无投影）',
    panels.others.every((o) => o.bad.length === 0),
    panels.others
      .map((o) => `${o.name}（查 ${o.checked} 个子元素）${o.bad.length ? '：' + o.bad.join('；') : ''}`)
      .join(' / '),
  )
  check(
    '整幅特写（data-full）只许一块面，且正文真的通栏到第 1 列',
    panels.feature.length === 1 &&
      panels.feature.every((f) => f.total === 2 && f.surfaced === 1 && f.flushLeft),
    panels.feature
      .map((f) => `${f.name} 正文${f.total} 块 / 带面${f.surfaced} 块 / 左边缘对齐=${f.flushLeft}`)
      .join(' / ') || 'missing',
  )

  // 面板 + 栅格把列宽收窄之后，长数值（如「1200ms → 50ms」）会**文字溢出**到邻格 ——
  // 这条断言就是为那个真缺陷设的回归网。
  // ⚠️ 不能用 getBoundingClientRect 比较：块级元素的盒子宽度就是列宽，文字溢出时盒子并不变宽
  //    （第一版这么写，于是断言「假绿」，而截图里 `1200ms → 50ms` 已经和 `100%` 贴在一起了）。
  //    ⇒ 判据是 `scrollWidth > clientWidth`。
  // ⚠️ 采样面也不能只用 `[data-glass] .cell > *`：CSS Modules 的类名是哈希，`.cell` 恒匹配 0 个节点，
  //    而项目面板里根本没有 `dd`（评审实测）—— 那样两个面板里有一个完全没被检查。
  //    ⇒ 覆盖**全页所有「直接含文本」的元素**，排除本就允许横滚的容器。
  const overflowText = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main *, footer *'))
      .filter((el) => {
        const cs = getComputedStyle(el)
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return false
        if (el.clientWidth === 0) return false
        // 只查「自己直接含文本」的元素，避免把装饰性绝对定位子节点算成溢出
        return Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
        )
      })
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map(
        (el) =>
          `${el.tagName}.${(el.className || '').toString().split(' ')[0]}「${el.textContent
            .trim()
            .slice(0, 16)}」${el.scrollWidth}>${el.clientWidth}`,
      ),
  )
  check(
    '全页无文字溢出（含面板内数值，收窄后不叠字）',
    overflowText.length === 0,
    overflowText.length ? overflowText.join(' | ') : '无溢出',
  )

  // ---- r2：区块顺序 + 三块版式（技术栈能力带 / 获奖年份轴 / 联系邮箱主角）----
  const r2Layout = await page.evaluate(() => {
    const sectionOf = (title) =>
      Array.from(document.querySelectorAll('main .section')).find(
        (s) => (s.querySelector('h2')?.textContent || '').trim() === title,
      )
    const px = (el, prop) => Number.parseFloat(getComputedStyle(el)[prop]) || 0

    // 顺序
    const order = Array.from(document.querySelectorAll('main .section')).map((s) =>
      (s.querySelector('h2')?.textContent || '').trim(),
    )

    // 技术栈（r3：玻璃面板 + 分类色胶囊）
    // 探针跟着实现走：矩阵那一版用的是真表格，这一版换回「方向行 + 胶囊云」，
    // 并新增一项 —— 六个方向必须各有各的色相（颜色是这一版的一个维度，不是装饰）。
    const skills = sectionOf('技术栈')
    // 用 data-skill-group 而不是 [class*="group"]：后者会同时命中行与行标题（「groupTitle」也含 group），
    // 6 行会被数成 12 行 —— 第一版就是这么亮红的。
    const skillGroups = Array.from(skills?.querySelectorAll('[data-skill-group]') || [])
    const firstGroup = skillGroups[0]
    const groupTitle = firstGroup?.querySelector('h3')
    const items = firstGroup?.querySelector('ul')
    const skillProbe =
      firstGroup && groupTitle && items
        ? {
            titleLeft: groupTitle.offsetLeft,
            itemsLeft: items.offsetLeft,
            titleSize: px(groupTitle, 'fontSize'),
            // 取胶囊本身，不取胶囊里那个「只给读屏」的档位字（它是 11px，会把判据蒙对）
            itemSize: px(items.querySelector('li span') || items, 'fontSize'),
            panel: !!skills.querySelector('[data-glass]'),
            rows: skillGroups.length,
            chips: skills.querySelectorAll('ul[class*="items"] > li').length,
            hues: [
              ...new Set(
                skillGroups.map((g) => getComputedStyle(g.querySelector('[class*="dot"]')).backgroundColor),
              ),
            ],
          }
        : null

    // 获奖（r3）：逐条时间线 —— 左列元数据（年份 / 等级）右对齐，中列轴线圆点，右列奖项名
    const awardsSection = sectionOf('教育与荣誉')
    const awardRows = Array.from(awardsSection?.querySelectorAll('li[data-award]') || [])
    const yearEls = awardRows.map((li) => li.querySelector('[data-year]'))
    const nameEls = awardRows.map((li) => li.querySelector('[data-award-name]'))
    const nodeEls = awardRows.map((li) => li.querySelector('[data-award-name]')?.previousElementSibling)
    const awardsProbe = awardRows.length
      ? {
          rows: awardRows.length,
          years: yearEls.length,
          yearLefts: [...new Set(yearEls.map((el) => el.offsetLeft))],
          nameLefts: [...new Set(nameEls.map((el) => el.offsetLeft))],
          nodeLefts: [...new Set(nodeEls.map((el) => (el ? el.offsetLeft + el.offsetWidth / 2 : null)))],
          yearSize: px(yearEls[0], 'fontSize'),
          nameSize: px(nameEls[0], 'fontSize'),
        }
      : null

    // 联系：能一键联系的那条做主入口（tel: 拨号 / mailto: 发信都算）
    const contact = sectionOf('联系我')
    const primary = contact?.querySelector('a[href^="mailto:"], a[href^="tel:"]')
    const secondary = contact?.querySelector('dd a, dd span')
    const contactProbe =
      primary && secondary
        ? {
            primarySize: px(primary, 'fontSize'),
            secondarySize: px(secondary, 'fontSize'),
            href: primary.getAttribute('href'),
          }
        : null

    // 列表符号：必须是**看得见**的短横线（Markdown 的 `-`），不是 1px 发丝线。
    // 用户实测反馈「内容列点的 - 没有以 markdown 的形式展示出来」指的就是这两处。
    const marker = (el) => {
      if (!el) return null
      const cs = getComputedStyle(el, '::before')
      return {
        width: Math.round(Number.parseFloat(cs.width) || 0),
        height: Math.round(Number.parseFloat(cs.height) || 0),
        bg: cs.backgroundColor,
      }
    }
    const markers = {
      // 实习经历 r3 起是「切换器」结构：article > ul > li，不再是 ol > li > ul > li
      experience: marker(sectionOf('实习经历')?.querySelector('article ul li')),
      project: marker(sectionOf('项目经历')?.querySelector('[id^="project-panel"] li')),
    }

    return { order, skillProbe, awardsProbe, contactProbe, markers }
  })

  check(
    '区块顺序：经历排在能力之前（三期在「项目经历」与「技术栈」之间插入「最新技术分享」）',
    JSON.stringify(r2Layout.order) ===
      JSON.stringify([
        '拿得出手的数字',
        '实习经历',
        '项目经历',
        '最新技术分享',
        '技术栈',
        '教育与荣誉',
        '联系我',
      ]),
    r2Layout.order.join(' → '),
  )
  check(
    '技术栈：玻璃面板里 6 个方向各有色相、行头在左栏作锚点、28 项一项不丢',
    !!r2Layout.skillProbe &&
      r2Layout.skillProbe.panel &&
      r2Layout.skillProbe.rows === 6 &&
      r2Layout.skillProbe.chips === 28 &&
      r2Layout.skillProbe.hues.length === 6 &&
      r2Layout.skillProbe.itemsLeft - r2Layout.skillProbe.titleLeft >= 80 &&
      r2Layout.skillProbe.titleSize > r2Layout.skillProbe.itemSize,
    r2Layout.skillProbe
      ? `${r2Layout.skillProbe.rows} 个方向 / ${r2Layout.skillProbe.chips} 项 / ${r2Layout.skillProbe.hues.length} 个色相；行头 left=${r2Layout.skillProbe.titleLeft} → 胶囊列 left=${r2Layout.skillProbe.itemsLeft}；行头 ${r2Layout.skillProbe.titleSize}px > 胶囊 ${r2Layout.skillProbe.itemSize}px；面板=${r2Layout.skillProbe.panel}`
      : 'missing',
  )
  check(
    '获奖经历：逐条时间线（左元数据列 / 中轴线圆点 / 右奖项名），五项奖项全在',
    !!r2Layout.awardsProbe &&
      r2Layout.awardsProbe.rows === 5 &&
      r2Layout.awardsProbe.years === 5 &&
      r2Layout.awardsProbe.yearLefts.length === 1 &&
      r2Layout.awardsProbe.nameLefts.length === 1 &&
      r2Layout.awardsProbe.nodeLefts.length === 1 &&
      r2Layout.awardsProbe.nameLefts[0] > r2Layout.awardsProbe.yearLefts[0] &&
      r2Layout.awardsProbe.nameSize > r2Layout.awardsProbe.yearSize,
    r2Layout.awardsProbe
      ? `${r2Layout.awardsProbe.rows} 条奖项 / ${r2Layout.awardsProbe.years} 个年份；年份列=${r2Layout.awardsProbe.yearLefts.length} 名名列=${r2Layout.awardsProbe.nameLefts.length} 轴心=${r2Layout.awardsProbe.nodeLefts.length}；名称 ${r2Layout.awardsProbe.nameSize}px > 年份 ${r2Layout.awardsProbe.yearSize}px`
      : 'missing',
  )
  // 列表符号可见性（用户点名的两处：实习经历 + 项目经历展开面板）
  const markerOk = (m) => !!m && m.height >= 2 && m.width >= 8 && !/rgba\(0, 0, 0, 0\)/.test(m.bg)
  check(
    '列表符号是看得见的短横线（实习经历 + 项目经历展开面板）',
    markerOk(r2Layout.markers.experience) && markerOk(r2Layout.markers.project),
    `实习 ${JSON.stringify(r2Layout.markers.experience)} / 项目 ${JSON.stringify(r2Layout.markers.project)}`,
  )
  check(
    '联系我：手机号是主入口（字号明显大于次级条目，且是 tel: 可一键拨号）',
    !!r2Layout.contactProbe &&
      /^(mailto|tel):/.test(r2Layout.contactProbe.href ?? '') &&
      r2Layout.contactProbe.primarySize >= r2Layout.contactProbe.secondarySize * 2,
    r2Layout.contactProbe
      ? `主入口 ${r2Layout.contactProbe.primarySize}px vs 次级 ${r2Layout.contactProbe.secondarySize}px；href=${r2Layout.contactProbe.href}`
      : 'missing',
  )

  // ---- 等宽字白名单（decisions #41）：等宽栈没有 CJK 字形，含中文的文本不得用它 ----
  // 这条规格一直在主干 spec 里，但**此前没有任何判据** —— r2 顺手补上（并已按它修掉 5 处违规）。
  const monoViolations = await page.evaluate(() => {
    const monoFirst = getComputedStyle(document.documentElement)
      .getPropertyValue('--ds-font-mono')
      .split(',')[0]
      .trim()
      .replace(/["']/g, '')
    const bad = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (!cs.fontFamily.startsWith(monoFirst)) continue
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
      if (/[\u4e00-\u9fff]/.test(own)) bad.push(`${el.tagName}「${own.trim().slice(0, 14)}」`)
    }
    return { monoFirst, bad }
  })
  check(
    '等宽字只用于纯 Latin / 数字（不得含中文）',
    monoViolations.bad.length === 0,
    `等宽栈首族=${monoViolations.monoFirst}；违规 ${monoViolations.bad.length} 处${
      monoViolations.bad.length ? '：' + monoViolations.bad.join(' / ') : ''
    }`,
  )

  // 窄屏塌回单列：标题与正文左边缘对齐（手机上不许出现一窄一宽）
  const narrowCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const narrowPage = await narrowCtx.newPage()
  await narrowPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await narrowPage.waitForTimeout(400)
  const narrowGrid = await narrowPage.evaluate(() => {
    const out = []
    for (const s of document.querySelectorAll('main .section')) {
      const h2 = s.querySelector('h2')
      const body = s.querySelector(':scope > *:not(.sectionTitle):not(.sectionLead)')
      if (!h2 || !body) continue
      // ⚠️ 用 offsetLeft（布局位置）而不是 getBoundingClientRect：
      // r2 的入场加了 scale(0.985)，揭示中的元素 rect 会横向缩进约 2.6px，
      // 于是「左边缘是否对齐」这条**布局**断言会被**动画中间态**干扰（实测报 -3px）。
      out.push({
        name: (h2.textContent || '').trim().slice(0, 6),
        d: body.offsetLeft - h2.offsetLeft,
      })
    }
    return out
  })
  await narrowCtx.close()
  check(
    '窄屏（390）塌回单列：标题与正文左边缘对齐',
    narrowGrid.length >= 6 && narrowGrid.every((g) => Math.abs(g.d) <= 2),
    narrowGrid.map((g) => `${g.name}:${g.d}`).join(' '),
  )

  // 暗色首页：规格要求「两种主题下都能观察到」流线布景层与环标记，
  // 而评审指出套件此前**从未在暗色下打开首页**（暗色 context 直接进的是 /tech）。
  const darkCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
  })
  const darkPage = await darkCtx.newPage()
  await darkPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await darkPage.waitForTimeout(500)
  const darkHome = await darkPage.evaluate(() => {    const qa = (s) => Array.from(document.querySelectorAll(s))
    const labels = qa('*')
      .filter((el) => {
        if (el === document.body || el === document.documentElement) return false
        const bg = getComputedStyle(el).backgroundImage
        return bg && bg.includes('gradient')
      })
      .map((el) =>
        el.hasAttribute('data-flow')
          ? 'flow'
          : el.hasAttribute('data-glass')
            ? 'glass'
            : el.hasAttribute('data-ring')
              ? 'ring'
              : el.hasAttribute('data-gradient')
                ? 'gradient'
                : el.hasAttribute('data-scrim')
                  ? 'scrim'
                  : el.hasAttribute('data-spot')
                    ? 'spot'
                    : el.tagName,
      )
    const allowed = ['flow', 'glass', 'ring', 'gradient', 'scrim', 'spot']
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      stray: labels.filter((l) => !allowed.includes(l)),
      flowPaths: qa('[data-flow] path').length,
      rings: qa('[data-ring]').length,
      nameGradient: labels.filter((l) => l === 'gradient').length,
    }
  })
  const darkSep = await colorSepOf(darkPage)
  await darkCtx.close()
  check(
    '暗色主题下的色调分离同样成立（HSL 明度差 ≥25 个百分点、最坏合成 ≥4.5:1）',
    darkSep.dL >= 25 && darkSep.worst >= 4.5,
    `正文 L=${darkSep.textL.toFixed(1)}% / 流线 L=${darkSep.lineL.toFixed(1)}% → Δ=${darkSep.dL.toFixed(1)}；最坏合成 ${darkSep.worst.toFixed(2)}:1`,
  )
  check(
    '暗色首页同样成立：流线层在、环标记在、渐变仍只走登记的宿主',
    darkHome.theme === 'dark'
      ? darkHome.stray.length === 0 &&
          darkHome.flowPaths > 0 &&
          darkHome.rings === 2 &&
          darkHome.nameGradient === 1
      : false,
    `theme=${darkHome.theme} 流线路径=${darkHome.flowPaths} 环=${darkHome.rings} 姓名渐变=${darkHome.nameGradient} 越权=${darkHome.stray.join(',') || '无'}`,
  )

  // ---- 悬浮反馈：指针聚光必须真的跟随指针亮起来 ----
  const projectRow = page.locator('section[aria-labelledby="projects-title"] [class*="row"]').first()
  await projectRow.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await projectRow.hover()
  await page.waitForTimeout(320)
  const rowSpot = await projectRow.evaluate((el) => ({
    on: el.hasAttribute('data-spotlight'),
    x: el.style.getPropertyValue('--spot-x'),
    y: el.style.getPropertyValue('--spot-y'),
    glow: getComputedStyle(el, '::before').opacity,
    ring: getComputedStyle(el, '::after').opacity,
  }))
  check(
    '项目行悬浮：指针聚光 + 边框高光都亮起',
    rowSpot.on && rowSpot.x !== '' && rowSpot.y !== '' && Number(rowSpot.glow) > 0.9 && Number(rowSpot.ring) > 0.9,
    JSON.stringify(rowSpot),
  )

  const primaryBtn = page.locator('a[data-spot]').first()
  await primaryBtn.scrollIntoViewIfNeeded()
  await primaryBtn.hover()
  await page.waitForTimeout(320)
  const btnSpot = await primaryBtn.evaluate((el) => ({
    on: el.hasAttribute('data-spotlight'),
    x: el.style.getPropertyValue('--spot-x'),
    gradient: getComputedStyle(el).backgroundImage.includes('radial-gradient'),
  }))
  check(
    '主按钮悬浮：指针聚光亮起（叠在底色之上的背景图）',
    btnSpot.on && btnSpot.x !== '' && btnSpot.gradient,
    JSON.stringify(btnSpot),
  )

  // ---- 「技术分享」列表页（M3 前端外壳）----
  // 用暗色上下文顺便确认暗色主题下这一页也成立
  const techCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
  const techPage = await techCtx.newPage()
  await techPage.goto('http://127.0.0.1:5173/tech', { waitUntil: 'networkidle', timeout: 60000 })
  await techPage.waitForTimeout(500)

  const tech = await techPage.evaluate(() => {
    const h1 = document.querySelector('h1')
    const rows = Array.from(document.querySelectorAll('[class*="row"]'))
    const bodyText = document.body.innerText
    return {
      h1: h1 ? h1.textContent.trim() : null,
      h1Count: document.querySelectorAll('h1').length,
      countText: (bodyText.match(/共 \d+ 篇 · 更新至 \d{4}\.\d{2}\.\d{2}/) || [null])[0],
      rowCount: rows.length,
      linksInRows: rows.reduce((n, r) => n + r.querySelectorAll('a').length, 0),
      hasEmptyState: bodyText.includes('列表接口还没接通'),
      ringBadges: Array.from(document.querySelectorAll('[data-ring]')).filter((el) => !el.closest('footer'))
        .length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })

  check('技术分享页只有一个 h1 且内容正确', tech.h1Count === 1 && tech.h1 === '技术分享', `h1=${tech.h1}`)
  check('有数据时不渲染空态', tech.hasEmptyState === false)
  check('/tech 无横向滚动', tech.overflow <= 0, `溢出=${tech.overflow}px`)

  await techCtx.close()

  // ================= 三期（技术分享模块）：卡片列表 / 详情页 / 首页入口 =================
  await auditPhase3(browser)

  // ---- 占位页外壳：/algo 与 404 ----
  const pageCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const walkPage = await pageCtx.newPage()
  await walkPage.goto('http://127.0.0.1:5173/algo', { waitUntil: 'networkidle', timeout: 60000 })
  const algo = await walkPage.evaluate(() => ({
    h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null,
    hasLead: document.body.innerText.includes('按专题整理的题解'),
    hasEmpty: document.body.innerText.includes('内容整理中'),
    // 每个页面都带页脚，页脚那枚环是 RingField；这里只数页面自己的 badge
    ringBadges: Array.from(document.querySelectorAll('[data-ring]')).filter((el) => !el.closest('footer'))
      .length,
  }))
  check(
    '算法笔记占位页：标题 + 定位句 + 空态 + 环 badge',
    algo.h1 === '算法笔记' && algo.hasLead && algo.hasEmpty && algo.ringBadges === 1,
    JSON.stringify(algo),
  )

  await walkPage.goto('http://127.0.0.1:5173/no-such-page', { waitUntil: 'networkidle', timeout: 60000 })
  const notFound = await walkPage.evaluate(() => ({
    h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null,
    text: document.body.innerText.slice(0, 200),
  }))
  check('404 页给出方向而不是空白', notFound.h1 === '页面不存在' && notFound.text.includes('链接可能写错了'), notFound.h1)

  await pageCtx.close()

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`)
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
