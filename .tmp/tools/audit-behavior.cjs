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

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
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
      // 装饰性渐变只允许出现在三类元素上：环装置（data-ring）、姓名渐变（data-gradient）、
      // 顶栏功能性遮罩（data-scrim）。卡片底、按钮、区块背景一旦引入渐变，这里立刻亮红。
      gradientLabels: qa('*')
        .filter((el) => {
          if (el === document.body || el === document.documentElement) return false
          const bg = getComputedStyle(el).backgroundImage
          return bg && bg.includes('gradient')
        })
        .map((el) =>
          el.hasAttribute('data-ring')
            ? 'ring'
            : el.hasAttribute('data-gradient')
              ? 'gradient'
              : el.hasAttribute('data-scrim')
                ? 'scrim'
                : el.tagName,
        ),
    }
  })

  check(
    '渲染姓名与一句话定位',
    dom.h1Count === 1 && dom.h1Text.startsWith('庄家希') && dom.hasHeadline,
    `h1="${dom.h1Text}"`,
  )
  check('三个实习经历都出现在页面上', dom.companies.every(Boolean))
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
  const strayGradients = dom.gradientLabels.filter((l) => l !== 'ring' && l !== 'gradient' && l !== 'scrim')
  check(
    '渐变只出现在环装置 / 姓名 / 顶栏遮罩上',
    strayGradients.length === 0 && dom.gradientLabels.filter((l) => l === 'gradient').length === 1,
    `环=${dom.gradientLabels.filter((l) => l === 'ring').length} 姓名=${
      dom.gradientLabels.filter((l) => l === 'gradient').length
    } 遮罩=${dom.gradientLabels.filter((l) => l === 'scrim').length} 其他=${strayGradients.join(',') || '无'}`,
  )

  // ---- 运行期才成立的两项：入场序列 + 触摸目标 ----
  const revealTotal = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[data-reveal]')).filter((el) => el.tagName !== 'HTML')
    return all.length
  })
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 80))
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
    return { armed: document.documentElement.getAttribute('data-reveal'), total: nodes.length, hidden }
  })
  check(
    'reduced-motion 下入场不接管、正文不隐藏',
    rm.armed === null && rm.hidden === 0,
    `armed=${rm.armed} 隐藏=${rm.hidden}/${rm.total}`,
  )
  await rmCtx.close()

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
  check('计数取自数据长度（共 5 篇）', tech.countText === '共 5 篇 · 更新至 2026.08.12', `${tech.countText}`)
  check('列表渲染 5 行', tech.rowCount === 5, `行=${tech.rowCount}`)
  check('列表项内无链接（无死链）', tech.linksInRows === 0, `链接=${tech.linksInRows}`)
  check('有数据时不渲染空态', tech.hasEmptyState === false)
  check('列表页有环 badge', tech.ringBadges === 1, `环=${tech.ringBadges}`)
  check('/tech 无横向滚动', tech.overflow <= 0, `溢出=${tech.overflow}px`)

  await techCtx.close()

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
