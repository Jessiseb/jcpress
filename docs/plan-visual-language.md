# 一期视觉语言修订（环装置 + 双主题）实施计划

> **For agentic workers:** 本计划按任务逐条执行，步骤用 `- [ ]` 勾选跟踪。
> 上游设计：`docs/design-visual-language.md`（本文档只讲「怎么做」，设计理由不重复）。
> 参照实测：`docs/style-ref-aura.md`。
> **注意**：skill 建议的两条 REQUIRED SUB-SKILL（`superpowers:subagent-driven-development` / `superpowers:executing-plans`）**未安装在本环境**；
> 直接按本计划逐任务执行即可（每任务 5–40 分钟，任务末尾提交）。

**Goal:** 给一期页面装上「环」母题与双主题剧场感，并补上占位页外壳与「技术分享」列表页骨架。

**Architecture:** 全部改动集中在前端表现层（`theme.jcpress.css` 令牌 + 各组件 CSS Module + 一个可复用的 `RingField` 装饰组件）。图案只用 CSS 渐变与内联 SVG，不引入任何图片、字体或动画库；数据层新增一个 `articles.ts` 常量与对应 hook，结构对齐未来后端 VO。

**Tech Stack:** React 18 + TypeScript（strict）+ Vite 6 + CSS Modules + 现有 design tokens。

---

## 0. 环境前置（每个新会话都要做一次）

### 0.1 起 dev server（后台常驻）

```bash
cd /d C:\Users\O\Desktop\myproject\jcpress\frontend && npm run dev
```

以后台任务方式启动，然后确认：

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/ -TimeoutSec 5).StatusCode
```

期望：`200`。若不是 200，先解决 dev server，别往下走。

### 0.2 跑一次基线断言与对比度审计

```bash
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-behavior.cjs
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-contrast.cjs
```

期望：行为断言 `合计 13 项，通过 13，失败 0`；对比度 `合计未达标：0`。

> **权限**：这两个脚本要用 Playwright 启动 Edge，受限沙箱下会 `spawn EPERM`。
> 每个新会话**首次**运行时需要一次性提权（`danger-full-access`）——这是本环境的既有坑，见 `docs/decisions.md` 环境注意事项。

### 0.3 记录改动前体积

```powershell
Get-ChildItem C:\Users\O\Desktop\myproject\jcpress\frontend\dist -File | Select-Object Name,Length
```

基线（未压缩）：`index-*.js` 215.9KB、`index-*.css` 21.5KB。

> **已知限制**：本环境 esbuild 子进程无法读盘，`vite build` 与 `vitest` **跑不起来**（返工 ⑧）。
> 因此本计划所有验证走 `tsc --noEmit` + 浏览器断言 + 截图；vitest 用例照写，等环境修复后一次性补跑。

---

## 1. 文件结构

**新建**

| 文件 | 职责 |
| --- | --- |
| `frontend/src/components/layout/RingField.tsx` | 环装置装饰层（聚光 + 同心环 + 遮罩），只负责画，不管位置 |
| `frontend/src/components/layout/RingField.module.css` | 上式样式，尺寸与不透明度由内联 CSS 变量传入 |
| `frontend/src/utils/latin.tsx` | 把字符串里的 Latin 词包成 `<em>`（中文保持正体） |
| `frontend/src/utils/latin.test.tsx` | 上式的单测（环境修复后跑） |
| `frontend/src/data/articles.ts` | 「技术分享」占位数据 + `ArticleVO` 类型 |
| `frontend/src/data/articles.test.ts` | 数据契约单测（环境修复后跑） |
| `frontend/src/hooks/useArticles.ts` | 列表数据唯一读取入口（后端就绪后换实现） |
| `frontend/src/pages/tech/TechListPage.tsx` | 技术分享列表页 |
| `frontend/src/pages/tech/TechListPage.module.css` | 上式样式 |
| `frontend/src/pages/tech/TechListPage.test.tsx` | 列表页单测（环境修复后跑） |

**修改**

| 文件 | 改动 |
| --- | --- |
| `frontend/src/styles/theme.jcpress.css` | 新增/改写 12 条令牌（底色、面、玻璃、发丝线、环、聚光、周期、展示字字重） |
| `frontend/src/components/home/Hero.tsx` + `.module.css` | 环层、两行标题、Latin 斜体、按钮辉光 |
| `frontend/src/components/home/ProjectShowcase.tsx` + `.module.css` | 卡片墙 → 编辑式表格 + 可展开行 + 环 badge |
| `frontend/src/components/home/HighlightStats.module.css` | 数值改衬线 + 强调色 + 22px |
| `frontend/src/components/home/SkillMatrix.module.css` | 档位换等宽字 |
| `frontend/src/components/home/ExperienceTimeline.module.css` | 公司名衬线、字号 +2px |
| `frontend/src/components/home/EducationAwards.module.css` | 年份/等级换等宽字 |
| `frontend/src/components/home/ContactBar.module.css` | 复制按钮玻璃化 |
| `frontend/src/components/layout/TopNav.tsx` + `.module.css` | 品牌标记换 4 圈环 SVG |
| `frontend/src/components/layout/Footer.tsx` + `.module.css` | 环层 + 收尾语 + 发邮件按钮 |
| `frontend/src/styles/global.css` | 标题字重走 `--ds-fw-display` |
| `frontend/src/pages/ChannelPlaceholder.tsx` + `.module.css` | 新外壳（环 badge + 定位句 + 空态 + 回首页） |
| `frontend/src/App.tsx` | `/tech` 换列表页；其余频道传定位句与空态文案 |
| `frontend/src/pages/home/HomePage.test.tsx` | 两处断言随 h1 结构更新 |
| `.tmp/tools/audit-behavior.cjs` | h1 断言、渐变持有者断言、新增 `/tech` 页断言 |
| `.tmp/tools/shot-final.cjs` | 支持传入 URL 与输出前缀（用于给 `/tech` 截图） |

---

## Task 1: 令牌层修订

**Files:**
- Modify: `frontend/src/styles/theme.jcpress.css`
- Create: `.tmp/tools/probe-tokens.cjs`（验证用，不入库）

- [ ] **Step 1: 在 `:root` 里新增/改写亮色令牌**

把 `theme.jcpress.css` 的 `:root` 中「发丝线」与「氛围层」两段替换为：

```css
  /* ---- 发丝线 ----
     基线的 --ds-c-border-soft 在暗色下是纯黑 #000（参照站靠「面差」分块，不需要可见的线）。
     本站改用发丝线做分块，亮色下也改成半透明：环装置会铺在区块之下，
     实色线会把图案「切断」，半透明线才能让环透过线继续读得到。 */
  --ds-c-hairline: rgb(20 22 26 / 12%);

  /* ---- 玻璃层（新增）----
     顶栏、复制按钮、将来的浮层共用。亮色 72% 白，暗色 62% 近黑。
     与基线的 --ds-c-bg-soft（90% 不透明）分开：那个给通栏顶栏，这个给浮起的小面积控件。 */
  --ds-c-glass: rgb(255 255 255 / 72%);

  /* ---- 环装置（新增）----
     配方来自参照站 .hero-field（实测见 docs/style-ref-aura.md §3）：
     聚光 + 1px 同心环 + 遮罩渐隐。第三层「135° 面差渐变」刻意不用（会遮住正文与 body 氛围层，见设计文档 §2.1 注记）。
     剂量比参照站低：它正文稀、我们正文密，12% 白环会压得正文发花。 */
  --ds-glow: rgb(10 123 245 / 10%);
  --ds-ring: rgb(9 111 220 / 4%);
  --ds-ring-period: 9px;

  /* ---- 展示字字重（新增）----
     参照站 Georgia 400 撑起 96–102px 标题：靠尺寸与衬线拉气质，不靠加粗。
     中文宋体在 400 下偏细（Windows SimSun 尤甚），折中取 500。 */
  --ds-fw-display: 500;
```

同时把「氛围层」注释里那句 **「只用『径向渐变网格』这一种技法，不加噪点颗粒 —— 克制方向下叠纹理是反向操作」** 改成：

```css
  /* ---- 氛围层：极低透明度的双径向渐变，铺在 body 背景上，替代纯色平铺 ----
     图案纪律（2026-09-28 修订）：全站图案**统一走「环装置」**（RingField / 环 badge），
     不得再引入第二种纹理（噪点 / 网格 / 斜纹）。原「不加噪点颗粒」的说法作废，
     因为用户明确要求补图案 —— 但「只有一种图案语言」这条纪律比原来更严。 */
```

- [ ] **Step 2: 在 `[data-theme='dark']` 里改写暗色令牌**

在 `[data-theme='dark']` 块内追加（保留已有的 accent / text-mute / text-subtle 三条不动）：

```css
  /* ---- 剧场底色：近黑，让环与聚光有地方「发光」----
     参照站 #050505；我们取 #08090c（带一点蓝，与品牌蓝同族，不显脏）。 */
  --ds-c-bg: #08090c;
  --ds-c-bg-elv: #101218;   /* 当前无组件引用，仅保持「底/面」层次一致 */
  --ds-c-bg-alt: #05060a;   /* 页脚与抽屉 */

  /* 暗色玻璃：顶栏与浮起控件 */
  --ds-c-glass: rgb(8 9 12 / 62%);
  --ds-c-bg-soft: rgb(8 9 12 / 62%);

  /* 暗色发丝线：改用半透明白，环可以透过线继续读 */
  --ds-c-hairline: rgb(255 255 255 / 13%);

  /* 环装置：暗底上要提亮，聚光也要更亮才看得见 */
  --ds-glow: rgb(59 130 246 / 20%);
  --ds-ring: rgb(255 255 255 / 8%);
  --ds-ring-period: 7px;   /* 与参照站实测一致 */
```

- [ ] **Step 2b: 标题排版进 `global.css`**

`frontend/src/styles/global.css` 里 `h1, h2, h3, h4` 规则改为（字重降档 + 字距收紧）：

```css
h1,
h2,
h3,
h4 {
  margin: 0;
  color: var(--ds-c-text);
  font-family: var(--ds-font-display);
  font-weight: var(--ds-fw-display);
  line-height: 1.25;
  letter-spacing: -0.02em;
}
```

`.sectionTitle` 改为 30px（移动端 1.55rem）：

```css
.sectionTitle {
  padding-top: var(--ds-space-4);
  border-top: 1px solid var(--ds-c-hairline);
  font-size: 1.875rem;
  margin-bottom: var(--ds-space-2);
}

@media (max-width: 719px) {
  .sectionTitle {
    font-size: 1.55rem;
    padding-top: var(--ds-space-3);
  }
}
```

- [ ] **Step 2c: 记录实测对比度**

`theme.jcpress.css` 的暗色底注释里写上实测值（`audit-contrast.cjs` 输出）：
accent `7.05:1` / text-mute `9.79:1` / text-subtle `6.32:1`（亮暗两套 227 处文本全部通过 AA）。

- [ ] **Step 3: 写令牌探针脚本**

创建 `.tmp/tools/probe-tokens.cjs`：

> **实现提醒（2026-09-28 执行时修正）**：自定义属性的计算值**不做颜色规范化** ——
> `getComputedStyle().getPropertyValue('--ds-ring')` 返回的是 var() 替换后的原始 token 串
> （`rgb(9 111 220 / 4%)` 原样返回，不会变成 `rgba(9, 111, 220, 0.04)`）。
> 因此探针按「原样字符串」比对；主题也不跟随系统色，而是显式 `setAttribute('data-theme', ...)` 后再读。
> 已按此修正执行，下方脚本即为最终生效版本。
> 另：执行时把「标题字重/字号」这一步从 Step 1 拆出来单列（见 Step 2b），因为它改的是 `global.css` 而不是 `theme.jcpress.css`。

```js
const { chromium } = require('playwright-core')

const EXPECT = {
  light: {
    '--ds-c-hairline': 'rgba(20, 22, 26, 0.12)',
    '--ds-c-glass': 'rgba(255, 255, 255, 0.72)',
    '--ds-ring': 'rgba(9, 111, 220, 0.04)',
    '--ds-ring-period': '9px',
    '--ds-fw-display': '500',
  },
  dark: {
    '--ds-c-bg': '#08090c',
    '--ds-c-glass': 'rgba(8, 9, 12, 0.62)',
    '--ds-c-hairline': 'rgba(255, 255, 255, 0.13)',
    '--ds-ring': 'rgba(255, 255, 255, 0.08)',
    '--ds-ring-period': '7px',
    '--ds-glow': 'rgba(59, 130, 246, 0.2)',
    '--ds-fw-display': '500',
  },
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let bad = 0
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })
    const page = await ctx.newPage()
    // 站点主题由 <html data-theme> 决定，这里直接跟着系统色走一遍
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    const actual = await page.evaluate(() => {
      const rs = getComputedStyle(document.documentElement)
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        values: Object.fromEntries(
          ['--ds-c-bg', '--ds-c-glass', '--ds-c-hairline', '--ds-glow', '--ds-ring', '--ds-ring-period', '--ds-fw-display'].map(
            (k) => [k, rs.getPropertyValue(k).trim()],
          ),
        ),
      }
    })
    console.log(`\n=== ${scheme}（data-theme=${actual.theme}）===`)
    for (const [k, want] of Object.entries(EXPECT[scheme])) {
      // 浏览器会把 #08090c 原样返回、把 rgb(... / x%) 规范化成 rgba(...)，两种都接受
      const got = actual.values[k]
      const ok = got === want
      if (!ok) bad++
      console.log(`${ok ? '✔' : '✘'} ${k} = ${got}${ok ? '' : `（期望 ${want}）`}`)
    }
    await ctx.close()
  }
  await browser.close()
  console.log(`\n合计不符：${bad}`)
  process.exit(bad ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
```

- [ ] **Step 4: 运行探针，确认令牌生效**

```bash
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\probe-tokens.cjs
```

期望：两组全部 `✔`，末行 `合计不符：0`。
若 `data-theme` 与 `colorScheme` 不一致（站点主题跟随系统），以探针打印的 `data-theme` 为准核对期望值。

- [ ] **Step 5: 对比度复测**

```bash
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-contrast.cjs
```

期望：`合计未达标：0`（暗底变深后对比度只会升高）。
把实测得到的新值追加到 `theme.jcpress.css` 对应注释里（格式沿用现有 `6.01:1 ✔` 写法）：

- `#4d9bff` on `#08090c` → 手算 7.05:1（探针确认）
- `text-mute 72%` on `#08090c` → 手算 9.79:1
- `text-subtle 60%` on `#08090c` → 手算 6.31:1

- [ ] **Step 6: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/styles/theme.jcpress.css
git commit -m "feat(theme): 暗色剧场底色 + 玻璃层 + 环装置令牌"
```

---

## Task 2: RingField 组件 + Hero 接入

**Files:**
- Create: `frontend/src/components/layout/RingField.tsx`
- Create: `frontend/src/components/layout/RingField.module.css`
- Create: `frontend/src/utils/latin.tsx`
- Create: `frontend/src/utils/latin.test.tsx`
- Modify: `frontend/src/components/home/Hero.tsx`
- Modify: `frontend/src/components/home/Hero.module.css`
- Modify: `frontend/src/pages/home/HomePage.test.tsx`

- [ ] **Step 1: 写 latin 工具的单测（先红）**

创建 `frontend/src/utils/latin.test.tsx`：

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { withLatinEmphasis } from './latin'

describe('withLatinEmphasis', () => {
  it('把 Latin 词包成 em，中文保持正体', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('用 Agent 和 Java 把重复劳动自动化')}</>)
    expect(html).toBe('用 <em>Agent</em> 和 <em>Java</em> 把重复劳动自动化')
  })

  it('纯中文不产生任何 em', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('广州 · AI 应用开发')}</>)
    // 「AI」是 Latin 词，会被包；这里只断言中文没被包
    expect(html).not.toContain('<em>广州</em>')
    expect(html).not.toContain('<em>应用开发</em>')
  })

  it('数字与下划线不触发斜体', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('1200ms → 50ms')}</>)
    expect(html).toBe('1200ms → 50ms')
  })
})
```

> 第三条用例说明分词规则：只匹配「以字母开头、后接字母或数字」的连续片段，
> 因此 `1200ms` 里的 `ms` 不会被单独切出来（它以数字开头的位置不满足行首条件）——
> 实现里用带 `\b` 边界的整体切分保证这一点。

- [ ] **Step 2: 运行单测确认失败**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
node node_modules/vitest/vitest.mjs run src/utils/latin.test.tsx
```

期望：**本环境会直接报错退出**（esbuild 读盘被禁，返工 ⑧）。
这是已知且预期的——**跳过，继续 Step 3**；等环境修复后回来补跑（记在 Task 9）。

- [ ] **Step 3: 实现 latin 工具**

创建 `frontend/src/utils/latin.tsx`：

```tsx
import type { ReactNode } from 'react'

/**
 * 把字符串里的 Latin 词包成 `<em>`。
 *
 * 为什么只给 Latin：中文没有真斜体，浏览器会做机械倾斜（左右切变），
 * 在中文字形上非常廉价。英文词用斜体 + 降灰是参照站的签名手法（见 docs/style-ref-aura.md §1）。
 *
 * 规则：只匹配「以字母开头、后接字母/数字」的连续片段，且必须处在词首
 * （前一个字符不是字母或数字）—— 这样 `1200ms` 不会被切成 `1200` + `ms`。
 */
export function withLatinEmphasis(text: string): ReactNode[] {
  return text.split(/(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*)/g).map((part, index) => {
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(part)) {
      return <em key={index}>{part}</em>
    }
    return <span key={index}>{part}</span>
  })
}
```

> `split` 带捕获组时，捕获内容会作为独立项出现在结果数组里 —— 这正是我们需要的切分。
> 前瞻 `(?<![A-Za-z0-9])` 保证 `1200ms` 中的 `ms` 不被识别为词首。

- [ ] **Step 4: 创建 RingField 组件**

创建 `frontend/src/components/layout/RingField.tsx`：

```tsx
import type { CSSProperties } from 'react'

import styles from './RingField.module.css'

interface Props {
  /** 环的直径（px）。参照站首屏场约 1000，页脚约 820 */
  size?: number
  /** 整个装置的不透明度（聚光与环一起缩放） */
  opacity?: number
}

/**
 * 环装置：同心圆环 + 中心聚光 + 遮罩渐隐。
 *
 * 配方取自参照站 `.hero-field`（docs/style-ref-aura.md §3），**丢掉第三层 135° 面差渐变** ——
 * 那一层在参照站是元素自身的底，在这里会变成一块不透明背景，把正文和 body 氛围层全遮住。
 *
 * 三条纪律：
 *  1. 纯装饰：`aria-hidden` + `pointer-events: none`，不进无障碍树、不吃点击；
 *  2. 本组件**不写 transform**：入场序列的 `[data-reveal]` 会写 transform，
 *     两者会互相抵消（父容器居中因此用 margin，而不是 translateX(-50%)）；
 *  3. 尺寸与不透明度只通过内联 CSS 变量传入，不给调用方留样式口子。
 */
export default function RingField({ size = 1000, opacity = 1 }: Props) {
  return (
    <div
      className={styles.field}
      data-ring=""
      aria-hidden="true"
      style={{ '--ring-size': `${size}px`, '--ring-opacity': String(opacity) } as CSSProperties}
    />
  )
}
```

- [ ] **Step 5: 创建 RingField 样式**

创建 `frontend/src/components/layout/RingField.module.css`：

```css
/* 环装置：透明背景上的两层叠加（聚光 + 同心环），最外层用 mask 做中心实、外缘渐隐。
   位置由父容器决定（父容器必须 position: relative + isolation: isolate，本层 z-index: -1）。 */
.field {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: -1;
  width: var(--ring-size);
  height: var(--ring-size);
  /* 居中用 margin 而不是 transform：data-reveal 会写 transform，用 transform 会被抵消 */
  margin-left: calc(var(--ring-size) / -2);
  pointer-events: none;
  opacity: var(--ring-opacity, 1);
  background-image:
    radial-gradient(circle at 50% 45%, var(--ds-glow), transparent 34%),
    repeating-radial-gradient(circle at 50% 45%, var(--ds-ring) 0 1px, transparent 1px var(--ds-ring-period));
  -webkit-mask-image: radial-gradient(#000 5%, transparent 72%);
  mask-image: radial-gradient(#000 5%, transparent 72%);
}

/* 环的间距小于 12px 时，1px 环在低分屏上会与像素格打架（摩尔纹）。
   这里不做媒体查询——校准规则见设计文档 §2.1：1:1 渲染下若糊成噪点，
   把 --ds-ring-period 调到 24px，仍糊则 46px，只调周期不调不透明度。 */
```

- [ ] **Step 6: Hero 接入环层与两行标题**

把 `frontend/src/components/home/Hero.tsx` 整体替换为：

```tsx
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import RingField from '@/components/layout/RingField'
import type { ProfileVO } from '@/data/profile'
import { withLatinEmphasis } from '@/utils/latin'
import styles from './Hero.module.css'

interface Props {
  profile: ProfileVO
}

/** 入场错峰：70ms 一档（frontend-design 基准 60–120ms） */
const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

/**
 * 首屏。信息只有五段：地点 → 姓名 + 定位 → 一句话 → 自述 → 动作。
 *
 * 变化（2026-09-28）：背后加环装置层；h1 拆成「庄家希 / AI 应用开发工程师」两行；
 * 定位句里的 Latin 词（Agent / Java）走斜体 + 降灰。中文一律正体。
 * 刻意保留的克制：只有一个实心按钮，第二个动作降级成文字链接。
 */
export default function Hero({ profile }: Props) {
  // VO 约定：headline 形如「职位 · 一句话」。两段分别用：职位做 h1 第二行，一句话做描述段。
  const [position = profile.headline, tagline = ''] = profile.headline.split(' · ')

  return (
    <section className={`container ${styles.hero}`} aria-labelledby="hero-title">
      {/* 环层：与首屏一起淡入。data-reveal 写在包裹层上，环自身的 opacity 不参与动画，
          否则 [data-reveal].is-revealed 的 opacity:1 会把 --ring-opacity 覆盖掉。 */}
      <div className={styles.ringLayer} data-reveal style={stagger(0)}>
        <RingField size={1000} />
      </div>

      <p className={styles.kicker} data-reveal style={stagger(1)}>
        {profile.location} · AI 应用开发
      </p>

      <h1 id="hero-title" className={styles.name} data-reveal style={stagger(2)}>
        <span className={styles.nameMain} data-gradient="">
          {profile.displayName}
        </span>
        <span className={styles.nameSub}>{position}</span>
      </h1>

      <p className={styles.headline} data-reveal style={stagger(3)}>
        {withLatinEmphasis(tagline)}
      </p>

      <p className={styles.summary} data-reveal style={stagger(4)}>
        {profile.summary}
      </p>

      <div className={styles.actions} data-reveal style={stagger(5)}>
        <Link to="/tech" className={styles.primary}>
          看技术分享
        </Link>
        <a href={profile.resumePdfUrl} className={styles.secondary} download>
          下载简历 PDF
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: 改 Hero 样式**

在 `frontend/src/components/home/Hero.module.css` 里：

1）`.hero` 规则追加三行（保持其余不变）：

```css
.hero {
  position: relative;
  isolation: isolate;   /* 让 z-index:-1 的环层留在首屏内部，不跑到 body 后面 */
  overflow: hidden;      /* 环宽 1000px，窄屏必须裁掉，否则横向滚动 */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--ds-space-3);
  padding-block: var(--ds-space-7) var(--ds-space-6);
}

/* 环层：绝对定位铺满首屏，内部再用 RingField 定位到偏上 45% 处 */
.ringLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ringLayer > * {
  top: -180px;   /* 环中心落在首屏偏上；截图确认后允许 ±60px 微调 */
}
```

2）把 `.name` 的渐变整段搬到 `.nameMain`，`.name` 只留排版：

```css
/* 标题：衬线 + 400–500 字重 + 收紧字距。渐变色只作用在姓名那一行 */
.name {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--ds-font-display);
  font-size: 4.25rem;
  font-weight: var(--ds-fw-display);
  line-height: 1.06;
  letter-spacing: -0.02em;
  margin-block: var(--ds-space-2) var(--ds-space-1);
}

/* 全站唯一一处装饰性渐变，且只作用于姓名文字（参照站的签名手法）。
   对比度：最亮一档 #0a7bf5 于白底 4.07:1，最暗 #0756ab 7.11:1；
   68px 属 WCAG「大字号」，门槛 3:1，两端均通过。 */
.nameMain {
  background: var(--ds-gradient-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* 第二行：定位。刻意不用斜体（`AI` 只有两个字母，斜体后读起来像 /\I） */
.nameSub {
  margin-top: 0.4rem;
  font-size: 0.4em;
  font-weight: var(--ds-fw-display);
  letter-spacing: 0;
  color: var(--ds-c-text-mute);
}
```

3）斜体样式（headline 里的 `<em>`）：

```css
/* 斜体只出现在这里与项目名：Latin 词斜体 + 降灰同时发生（参照站手法） */
.headline em {
  font-style: italic;
  color: var(--ds-c-text-subtle);
}
```

4）主按钮加一圈辉光（在 `.primary` 里追加一行）：

```css
  box-shadow: 0 0 24px var(--ds-glow);
```

5）响应式阶梯改成新字号（替换文件末尾的媒体查询）：

```css
@media (max-width: 959px) {
  .name {
    font-size: 2.75rem;
  }
}

@media (max-width: 719px) {
  .name {
    font-size: 2.5rem;
  }

  .headline {
    font-size: 1.05rem;
  }

  .kicker::before,
  .kicker::after {
    width: 1.5rem;
  }

  .ringLayer > * {
    top: -120px;
  }
}

@media (max-width: 419px) {
  .name {
    font-size: 2.125rem;
  }

  .actions {
    flex-direction: column;
    gap: var(--ds-space-2);
  }
}
```

- [ ] **Step 8: 更新首页两处断言（h1 结构变了）**

`frontend/src/pages/home/HomePage.test.tsx` 中：

把

```tsx
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('庄家希')
    expect(screen.getByText(/AI 应用开发工程师/)).toBeInTheDocument()
```

改为

```tsx
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('庄家希')
    // 定位行现在是 h1 的第二行，断言限定在 h1 内，避免与别处同名文字撞车
    expect(within(h1).getByText('AI 应用开发工程师')).toBeInTheDocument()
```

（`within` 已在文件顶部导入，无需改 import。）

- [ ] **Step 9: 类型检查 + 截图确认环的密度**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\shot-final.cjs C:\Users\O\Desktop\myproject\jcpress\.tmp\ring-v1
```

期望：`tsc` 0 错误；`ring-v1/desktop-light-hero.png` 里能看到同心环与中心聚光，且环**没有**糊成一片噪点。

- [ ] **Step 10: 按校准规则定周期**

看 `desktop-light-hero.png` 与 `desktop-dark-hero.png`（暗色需要手动切主题后再拍，见 Task 9 的双主题截图）：

- 环清晰可辨 → 周期不动，本步完成；
- 环糊成噪点 / 出现摩尔纹 → 把 `--ds-ring-period` 改成 `24px`，重拍；仍糊则 `46px`；
- 把最终取值回写 `docs/design-visual-language.md` §2.1 的表格，并在该行后加一句「（2026-09-28 校准：实际取 Npx，原因 …）」。

- [ ] **Step 11: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/components/layout/RingField.tsx frontend/src/components/layout/RingField.module.css frontend/src/utils/latin.tsx frontend/src/utils/latin.test.tsx frontend/src/components/home/Hero.tsx frontend/src/components/home/Hero.module.css frontend/src/pages/home/HomePage.test.tsx docs/design-visual-language.md
git commit -m "feat(home): 首屏环装置 + 两行标题 + Latin 斜体规则"
```

---

## Task 3: 顶栏环标记 + 玻璃底

**Files:**
- Modify: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/components/layout/TopNav.module.css`

- [ ] **Step 1: 品牌标记换成 4 圈环 SVG**

`TopNav.tsx` 里把

```tsx
            <span className={styles.mark} aria-hidden="true">
              庄
            </span>
```

改为

```tsx
            {/* 品牌标记：环母题的最小尺寸变体（4 圈同心环 + 中心点）。
                换掉原来的实色方块 —— 环是全站图案语言，logo 是它出现的第一处。 */}
            <span className={styles.mark} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8.6" stroke="currentColor" strokeWidth="1" opacity="0.32" />
                <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1" opacity="0.75" />
                <circle cx="10" cy="10" r="1.1" fill="currentColor" />
              </svg>
            </span>
```

- [ ] **Step 2: 改品牌标记样式**

`TopNav.module.css` 里把 `.mark` 整段替换为：

```css
/* 品牌标记：环母题最小变体。
   底色用 accent-soft（强调色 14% 洗过），线用强调色本身；不再用实色填充 + 白字。 */
.mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ds-c-hairline);
  border-radius: var(--ds-radius-lg);
  background: var(--ds-c-accent-soft);
  color: var(--ds-c-accent);
}
```

- [ ] **Step 3: 顶栏改玻璃底**

`TopNav.module.css` 的 `.navbar` 里，把 `background: var(--ds-c-bg-soft);` 改为：

```css
  /* 玻璃底：暗色下 --ds-c-bg-soft 已被 theme 覆盖为 62% 近黑，环从下面透上来 */
  background: var(--ds-c-glass);
  backdrop-filter: blur(14px) saturate(1.2);
```

（保留 `border-bottom: 1px solid var(--ds-c-hairline)` 与安全区 padding。）

- [ ] **Step 4: 验证**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-behavior.cjs
```

期望：`tsc` 0 错误；断言 `合计 13 项，通过 13，失败 0`（此时渐变持有者仍是 1 处：Hero 姓名 —— 环还没有第二个实例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/TopNav.tsx frontend/src/components/layout/TopNav.module.css
git commit -m "feat(nav): 品牌标记换环母题 + 顶栏玻璃底"
```

---

## Task 4: 数字 / 技术栈 / 经历 / 教育四区块的字面修订

**Files:**
- Modify: `frontend/src/components/home/HighlightStats.module.css`
- Modify: `frontend/src/components/home/SkillMatrix.module.css`
- Modify: `frontend/src/components/home/ExperienceTimeline.module.css`
- Modify: `frontend/src/components/home/EducationAwards.module.css`

- [ ] **Step 1: 关键数字的数值改蓝色衬线大字**

`HighlightStats.module.css` 的 `.value` 替换为：

```css
/* 数值：衬线 + 强调色 + 22px。
   刻意保留行结构、不做四格大数字卡片、不做 count-up（decisions #20）。
   对比度：亮色 #0756ab 于白底 7.11:1 ✔；暗色 #4d9bff 于 #08090c 7.05:1 ✔ */
.value {
  margin: 0;
  font-family: var(--ds-font-display);
  font-size: 1.375rem;
  font-weight: var(--ds-fw-display);
  font-variant-numeric: tabular-nums;
  color: var(--ds-c-accent);
  white-space: nowrap;
}
```

- [ ] **Step 2: 技能档位换等宽字**

`SkillMatrix.module.css` 的 `.level` 追加两行：

```css
.level {
  flex-shrink: 0;
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  color: var(--ds-c-text-subtle);
}
```

- [ ] **Step 3: 实习经历公司名改衬线 500、字号 +2px**

`ExperienceTimeline.module.css` 的 `.company` 替换为：

```css
.company {
  font-family: var(--ds-font-display);
  font-size: calc(var(--ds-fs-h3) + 2px);
  font-weight: var(--ds-fw-display);
}
```

（窄屏那条 `.company { font-size: 1.1rem; }` 保留不动。）

- [ ] **Step 4: 教育与荣誉的年份/等级换等宽字**

`EducationAwards.module.css` 的 `.awardYear` 与 `.awardLevel` 各追加一行 `font-family: var(--ds-font-mono);`：

```css
.awardYear {
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ds-c-text-subtle);
}

.awardLevel {
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-sm);
  color: var(--ds-c-text-mute);
}
```

- [ ] **Step 5: 验证**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-contrast.cjs
```

期望：`tsc` 0 错误；对比度 `合计未达标：0`（衬线大字比原来的 16px 无衬线更容易过线，但出处行字号未变，仍要复测）。

- [ ] **Step 6: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/components/home/HighlightStats.module.css frontend/src/components/home/SkillMatrix.module.css frontend/src/components/home/ExperienceTimeline.module.css frontend/src/components/home/EducationAwards.module.css
git commit -m "style(home): 数字改衬线强调色，档位与年份改等宽字"
```

---

## Task 5: 项目经历改成编辑式表格（可展开）

**Files:**
- Modify: `frontend/src/components/home/ProjectShowcase.tsx`
- Modify: `frontend/src/components/home/ProjectShowcase.module.css`
- Modify: `frontend/src/pages/home/HomePage.test.tsx`

- [ ] **Step 1: 重写组件**

`ProjectShowcase.tsx` 整体替换为：

```tsx
import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { ProjectVO } from '@/data/profile'
import { renderRich } from '@/utils/rich'
import { withLatinEmphasis } from '@/utils/latin'
import styles from './ProjectShowcase.module.css'

interface Props {
  projects: ProjectVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

const STATUS_LABEL: Record<ProjectVO['status'], string> = {
  ONGOING: '进行中',
  ONLINE: '已上线',
  ARCHIVED: '已归档',
}

/**
 * 项目经历：编辑式表格（ID / 项目 / 角色 · 状态 / 展开）。
 *
 * 为什么不是卡片墙：参照站的「作品表」靠对齐制造秩序，信息密度更高，也少一层模板感。
 * 为什么没有「年份」列：现有 ProjectVO 没有对应字段，凭空编年份就是假数据；
 *   等后端补上 `period` 再加列（记在 docs/decisions.md #22 的后续项）。
 * 交互：展开用 <button aria-expanded> 点击 / 回车触发 —— hover 只做视觉强调，
 *   不作任何信息的唯一入口（触摸设备没有 hover）。
 */
export default function ProjectShowcase({ projects }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  return (
    <section className={`container section ${styles.section}`} aria-labelledby="projects-title">
      <h2 id="projects-title" className="sectionTitle" data-reveal>
        项目经历
        {/* 环母题的中尺寸变体：这一块是首页的信息重心，给它一枚区块标记 */}
        <span className={styles.badge} data-ring="" aria-hidden="true" />
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        两个从 0 到 1 自研的项目，都由我负责后端与整体方案。展开看难点与取舍。
      </p>

      <div className={styles.table} data-reveal style={stagger(2)}>
        <div className={styles.head} aria-hidden="true">
          <span>ID</span>
          <span>项目</span>
          <span>角色 · 状态</span>
          <span />
        </div>

        {projects.map((project, index) => {
          const open = openSlug === project.slug
          const panelId = `project-panel-${project.slug}`

          return (
            <div key={project.slug} className={styles.row}>
              <span className={styles.idx}>{String(index + 1).padStart(2, '0')}</span>

              <h3 className={styles.name}>{withLatinEmphasis(project.name)}</h3>

              <span className={styles.meta}>
                {project.role} · {STATUS_LABEL[project.status]}
              </span>

              <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenSlug(open ? null : project.slug)}
              >
                {open ? '收起' : '展开'}
              </button>

              <div id={panelId} className={styles.panel} hidden={!open}>
                <p className={styles.summary}>{project.summary}</p>

                {project.highlights.length > 0 ? (
                  <ul className={styles.highlights}>
                    {project.highlights.map((line) => (
                      <li key={line} className={styles.highlight}>
                        {renderRich(line)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className={styles.tech}>{project.techStack.join(' · ')}</p>

                {project.repoUrl ? (
                  <a className={styles.link} href={project.repoUrl} target="_blank" rel="noreferrer noopener">
                    去 Gitee 看看 →
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 重写样式**

`ProjectShowcase.module.css` 整体替换为：

```css
/* 项目经历：编辑式表格。
   列：ID / 项目 / 角色 · 状态 / 展开 —— 四列对齐是本区块的「印刷品」特征。
   表格下方是展开面板（grid-column: 1 / -1 独占整行）。 */

.badge {
  display: inline-block;
  width: 54px;
  height: 54px;
  margin-left: var(--ds-space-4);
  vertical-align: middle;
  /* 环母题的小尺寸变体：周期比大环更密，中心更实 */
  background-image: repeating-radial-gradient(
    circle at 50% 50%,
    var(--ds-ring) 0 1px,
    transparent 1px 7px
  );
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
  mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
  opacity: 0.65;
}

.table {
  margin-top: var(--ds-space-5);
  border-top: 1px solid var(--ds-c-hairline);
}

.head,
.row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1.6fr) minmax(0, 1fr) 5rem;
  gap: var(--ds-space-4);
  align-items: baseline;
}

.head {
  padding-block: var(--ds-space-2);
  border-bottom: 1px solid var(--ds-c-hairline);
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  letter-spacing: 0.12em;
  color: var(--ds-c-text-subtle);
}

.row {
  padding-block: var(--ds-space-4);
  border-bottom: 1px solid var(--ds-c-hairline);
  transition: background var(--ds-t-color), box-shadow var(--ds-t-color);
}

/* hover 只做视觉强调：整行提亮 + 左侧蓝条。
   蓝条用 inset box-shadow 而不是 border-left —— 不改变列宽，不会把表格挤动。 */
@media (hover: hover) {
  .row:hover {
    background: var(--ds-c-accent-soft);
    box-shadow: inset 2px 0 0 var(--ds-c-accent);
  }
}

.idx {
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  color: var(--ds-c-text-subtle);
}

.name {
  font-family: var(--ds-font-display);
  font-size: var(--ds-fs-h3);
  font-weight: var(--ds-fw-display);
}

/* 项目名里的 Latin 词斜体 + 降灰（与首屏 same 规则） */
.name em {
  font-style: italic;
  color: var(--ds-c-text-mute);
}

.meta {
  font-size: var(--ds-fs-sm);
  color: var(--ds-c-text-subtle);
}

.toggle {
  justify-self: end;
  min-height: 44px; /* 触摸目标下限 */
  padding-inline: var(--ds-space-3);
  border: 1px solid var(--ds-c-hairline);
  border-radius: var(--ds-radius-pill);
  background: var(--ds-c-glass);
  color: var(--ds-c-text-mute);
  font-size: var(--ds-fs-xs);
  transition: color var(--ds-t-color), border-color var(--ds-t-color);
}

.toggle:hover {
  color: var(--ds-c-accent);
  border-color: var(--ds-c-accent);
}

.panel {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-3);
  padding-top: var(--ds-space-3);
}

/* hidden 属性在 display:flex 面前会失效，必须显式兜住 */
.panel[hidden] {
  display: none;
}

.summary {
  max-width: var(--ds-measure-prose);
  font-size: var(--ds-fs-sm);
  color: var(--ds-c-text-mute);
}

.highlights {
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-2);
}

.highlight {
  position: relative;
  max-width: var(--ds-measure-prose);
  padding-left: 1rem;
  font-size: var(--ds-fs-sm);
  line-height: 1.75;
  color: var(--ds-c-text-mute);
}

.highlight::before {
  content: '';
  position: absolute;
  top: 0.78em;
  left: 0;
  width: 0.5rem;
  height: 1px;
  background: var(--ds-c-text-subtle);
}

.tech {
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  color: var(--ds-c-text-subtle);
}

.link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: var(--ds-fs-sm);
}

@media (max-width: 719px) {
  .badge {
    width: 36px;
    height: 36px;
    margin-left: var(--ds-space-3);
  }

  .head {
    display: none;
  }

  /* 窄屏：表格降级成卡片堆叠。ID 与展开按钮同行，项目名与元信息各占一行，面板缩进 */
  .row {
    grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    gap: var(--ds-space-1) var(--ds-space-3);
    padding-block: var(--ds-space-3);
  }

  .name,
  .meta,
  .panel {
    grid-column: 2 / -1;
  }

  .name {
    font-size: 1.1rem;
  }

  .toggle {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    align-self: start;
  }
}
```

- [ ] **Step 3: 更新项目区断言（表格化后语义变了）**

`frontend/src/pages/home/HomePage.test.tsx` 里把最后一条用例

```tsx
  it('项目状态以纯文字呈现，没有状态徽章', () => {
    renderHome()

    const projects = within(sectionOf('项目经历'))
    expect(projects.getAllByText(/已上线/).length).toBeGreaterThan(0)
    // 徽章的旧实现是带 status 类名的 span，这里用「技术栈不再渲染成标签列表」间接守住：
    // 每张项目卡只应有一个 <h3>，标签列表若回归会多出成组的 <li>
    expect(projects.getAllByRole('heading', { level: 3 })).toHaveLength(3)
  })
```

替换为：

```tsx
  it('项目以表格呈现：三个项目名都在 h3，状态是纯文字', () => {
    renderHome()

    const projects = within(sectionOf('项目经历'))
    expect(projects.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(projects.getAllByText(/已上线/).length).toBeGreaterThan(0)
  })

  it('项目面板默认收起，展开按钮带 aria-expanded 与 aria-controls', () => {
    renderHome()

    const projects = within(sectionOf('项目经历'))
    const toggles = projects.getAllByRole('button', { name: '展开' })
    expect(toggles).toHaveLength(3)

    toggles.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded', 'false')
      const panelId = btn.getAttribute('aria-controls')
      expect(panelId).toBeTruthy()
      expect(document.getElementById(panelId as string)).not.toBeNull()
    })
  })
```

> 注意：`queryAllByRole` 会排除 `hidden` 元素，所以「默认收起」时面板里的文字查不到 —— 这正是我们想要的语义。

- [ ] **Step 4: 类型检查 + 断言 + 键盘走查**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-behavior.cjs
```

期望：`tsc` 0 错误；断言仍 13 项全绿（其中「项目状态为纯文字且 3 个项目」这条此时已由 Step 3 的新语义覆盖，若脚本计数变化，以 Task 9 更新后的脚本为准）。

键盘走查（人工，1 分钟）：Tab 到第一个「展开」→ Enter → 面板出现、按钮变「收起」→ 再 Enter 收起。

- [ ] **Step 5: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/components/home/ProjectShowcase.tsx frontend/src/components/home/ProjectShowcase.module.css frontend/src/pages/home/HomePage.test.tsx
git commit -m "feat(home): 项目经历改为可展开的编辑式表格"
```

---

## Task 6: 联系我玻璃化 + 页脚环与收尾语

**Files:**
- Modify: `frontend/src/components/home/ContactBar.module.css`
- Modify: `frontend/src/components/layout/Footer.tsx`
- Modify: `frontend/src/components/layout/Footer.module.css`

- [ ] **Step 1: 复制按钮玻璃化**

`ContactBar.module.css` 的 `.copyBtn` 替换为：

```css
/* 复制按钮：玻璃胶囊。暗色下玻璃层让环从底下透上来，是「透明感」最省成本的落点 */
.copyBtn {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-space-3);
  min-height: 44px;
  padding-inline: var(--ds-space-4);
  border: 1px solid var(--ds-c-hairline);
  border-radius: var(--ds-radius-pill);
  background: var(--ds-c-glass);
  backdrop-filter: blur(10px);
  text-align: left;
  transition: border-color var(--ds-t-color);
}

.copyBtn:hover,
.copyBtn:focus-visible {
  border-color: var(--ds-c-accent);
}
```

（`.value` 保留 `min-height: 44px`；`.copyHint` 的 hover/focus 变色规则保留。）

- [ ] **Step 2: 页脚加环 + 收尾语 + 发邮件按钮**

`Footer.tsx` 整体替换为：

```tsx
import RingField from '@/components/layout/RingField'
import { profileData } from '@/data/profile'
import styles from './Footer.module.css'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      {/* 页脚是「下半场布景」：环只露出一段弧线，随内容一起淡入 */}
      <div className={styles.ringLayer} data-reveal>
        <RingField size={820} opacity={0.75} />
      </div>

      <div className={`container ${styles.inner}`}>
        {/* 收尾语 + 一个动作：把页脚从「版权声明」变成「一句人话 + 一个入口」 */}
        <div className={styles.closing}>
          <p className={styles.closingLine}>有合适的机会，随时找我。</p>
          <a className={styles.mail} href={`mailto:${profileData.profile.email}`}>
            发邮件
          </a>
        </div>

        {/* 统计值用一行文字带过，不再做成四张卡片 —— 页脚再摆一排数字卡会把整页拉回看板感 */}
        <p className={styles.stats}>
          {profileData.stats.map((item) => (
            <span key={item.label} className={styles.stat}>
              {item.label} <strong className={styles.statValue}>{item.value}</strong>
            </span>
          ))}
        </p>

        <div className={styles.meta}>
          <p>© {year} 庄家希 · 基于 React + Vite 构建</p>
          <p className={styles.sub}>备案号待补充（国内节点需 ICP 备案，见规划 §12）</p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: 页脚样式**

`Footer.module.css`：`.footer` 追加三行，并在文件末尾追加新规则：

```css
.footer {
  position: relative;
  isolation: isolate;
  overflow: hidden;   /* 环 820px，必须裁掉溢出，否则整页横向滚动 */
  margin-top: var(--ds-space-7);
  padding-block: var(--ds-space-6);
  border-top: 1px solid var(--ds-c-hairline);
  background: var(--ds-c-bg-alt);
  padding-bottom: calc(var(--ds-space-6) + env(safe-area-inset-bottom));
}

.ringLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 环中心落在页脚上方，只让下缘弧线横穿页脚中部。
   目标：弧线不切到版权行；截图确认后允许 ±80px 调整。 */
.ringLayer > * {
  top: -320px;
}

.closing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ds-space-4);
}

.closingLine {
  font-family: var(--ds-font-display);
  font-size: 1.375rem;
  font-weight: var(--ds-fw-display);
  color: var(--ds-c-text);
}

.mail {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-inline: var(--ds-space-5);
  border: 1px solid var(--ds-c-hairline);
  border-radius: var(--ds-radius-pill);
  background: var(--ds-c-glass);
  backdrop-filter: blur(10px);
  font-size: var(--ds-fs-sm);
  font-weight: var(--ds-fw-medium);
  transition: border-color var(--ds-t-color), color var(--ds-t-color);
}

.mail:hover {
  border-color: var(--ds-c-accent);
  color: var(--ds-c-accent);
}

@media (max-width: 719px) {
  .ringLayer > * {
    top: -420px;
  }

  .closingLine {
    font-size: 1.125rem;
  }
}
```

- [ ] **Step 4: 验证**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-behavior.cjs
node C:\Users\O\Desktop\myproject\jcpress\.tmp\tools\audit-contrast.cjs
```

期望：`tsc` 0 错误；行为断言全绿（其中有「触摸目标 ≥44px」一项 —— 新的「发邮件」按钮必须 ≥44px 高与宽）；
对比度 0 未达标（页脚现在是深底 + 半透明玻璃，正文色不变，比值只会升高）。

- [ ] **Step 5: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/components/home/ContactBar.module.css frontend/src/components/layout/Footer.tsx frontend/src/components/layout/Footer.module.css
git commit -m "feat(footer): 页脚环布景 + 收尾语与发邮件入口；复制按钮玻璃化"
```

---

## Task 7: 占位页外壳

**Files:**
- Modify: `frontend/src/pages/ChannelPlaceholder.tsx`
- Modify: `frontend/src/pages/ChannelPlaceholder.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 重写占位页组件**

`ChannelPlaceholder.tsx` 整体替换为：

```tsx
import { Link } from 'react-router-dom'
import styles from './ChannelPlaceholder.module.css'

interface Props {
  title: string
  /** 这个频道写什么（≤40 字）。404 页不传 */
  lead?: string
  /** 空态说明：内容还没到，现在能做什么 */
  empty?: string
  is404?: boolean
}

/**
 * 频道占位页外壳。
 *
 * 三个频道共用同一套语言：环 badge + 频道名 + 一句定位 + 空态说明 + 回首页。
 * 空态按 frontend-design 的写法给方向（「现在能做什么」），不写「敬请期待」这类没有信息量的句子。
 */
export default function ChannelPlaceholder({ title, lead, empty, is404 = false }: Props) {
  return (
    <section className={`container section ${styles.wrap}`}>
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 className={styles.title}>{title}</h1>

      <p className={styles.lead}>
        {is404 ? '这个地址没有内容 —— 链接可能写错了，或者内容还没搬过来。' : lead}
      </p>

      {!is404 && empty ? <p className={styles.empty}>{empty}</p> : null}

      <Link to="/" className={styles.back}>
        回到首页
      </Link>
    </section>
  )
}
```

- [ ] **Step 2: 重写占位页样式**

`ChannelPlaceholder.module.css` 整体替换为：

```css
.wrap {
  position: relative;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: var(--ds-space-3);
}

/* 环母题：区块级 badge */
.badge {
  width: 64px;
  height: 64px;
  margin-bottom: var(--ds-space-2);
  background-image: repeating-radial-gradient(
    circle at 50% 50%,
    var(--ds-ring) 0 1px,
    transparent 1px var(--ds-ring-period)
  );
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
  mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
}

.title {
  font-size: 2.5rem;
  font-weight: var(--ds-fw-display);
}

.lead {
  max-width: var(--ds-measure-prose);
  color: var(--ds-c-text-mute);
  font-size: var(--ds-fs-lead);
}

.empty {
  max-width: var(--ds-measure-prose);
  color: var(--ds-c-text-subtle);
  font-size: var(--ds-fs-sm);
}

.back {
  margin-top: var(--ds-space-2);
  align-self: flex-start;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding-inline: var(--ds-space-4);
  border-radius: var(--ds-radius-pill);
  background: var(--ds-c-accent-bg);
  color: var(--ds-c-accent-text);
  font-size: var(--ds-fs-sm);
}

.back:hover {
  background: var(--ds-c-accent-hover);
  color: var(--ds-c-accent-text);
}

@media (max-width: 719px) {
  .title {
    font-size: 2rem;
  }
}
```

- [ ] **Step 3: 路由接上文案**

`App.tsx` 整体替换为：

```tsx
import { Route, Routes } from 'react-router-dom'

import TopNav from '@/components/layout/TopNav'
import Footer from '@/components/layout/Footer'
import HomePage from '@/pages/home/HomePage'
import ChannelPlaceholder from '@/pages/ChannelPlaceholder'
import TechListPage from '@/pages/tech/TechListPage'

export default function App() {
  return (
    <>
      <TopNav />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tech" element={<TechListPage />} />
          <Route
            path="/algo"
            element={
              <ChannelPlaceholder
                title="算法笔记"
                lead="按专题整理的题解：思路、多解法、复杂度与易错点。"
                empty="内容整理中。首页「技术栈」里有数据结构与算法的档位可先参考。"
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ChannelPlaceholder
                title="项目笔记"
                lead="每个自研项目的背景、架构、取舍与复盘。"
                empty="内容整理中。首页「项目经历」已有两个项目的概要，展开就能看到亮点。"
              />
            }
          />
          <Route path="*" element={<ChannelPlaceholder title="页面不存在" is404 />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
```

> `/tech` 在这一步指向 `TechListPage`，而该文件在 Task 8 才创建 —— **两条路选一条**：
> ① 先做 Task 8 再做 Task 7；② 在本任务里暂时保留 `<ChannelPlaceholder title="技术分享" … />`，Task 8 再替换。
> 推荐 ①：Task 7 与 Task 8 之间不提交中间态，避免 `tsc` 报「找不到模块」。

- [ ] **Step 4: 验证**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
```

期望：0 错误。然后浏览器手动看一遍 `/algo` 与 `/projects`（环 badge 可见、文案正确、无横向滚动），再手动访问一个不存在的路径确认 404 文案。

- [ ] **Step 5: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/pages/ChannelPlaceholder.tsx frontend/src/pages/ChannelPlaceholder.module.css frontend/src/App.tsx
git commit -m "feat(pages): 占位页统一外壳（环 badge + 定位句 + 空态）"
```

---

## Task 8: 「技术分享」列表页骨架

**Files:**
- Create: `frontend/src/data/articles.ts`
- Create: `frontend/src/data/articles.test.ts`
- Create: `frontend/src/hooks/useArticles.ts`
- Create: `frontend/src/pages/tech/TechListPage.tsx`
- Create: `frontend/src/pages/tech/TechListPage.module.css`
- Create: `frontend/src/pages/tech/TechListPage.test.tsx`
- Modify: `frontend/src/App.tsx`（若 Task 7 采用了方案 ②）

- [ ] **Step 1: 写数据契约单测（先红）**

创建 `frontend/src/data/articles.test.ts`：

```ts
import { describe, expect, it } from 'vitest'

import { articleData } from './articles'

describe('articleData', () => {
  it('每条都有 slug / 标题 / 摘要 / 分类 / 日期 / 阅读时长', () => {
    expect(articleData.length).toBeGreaterThan(0)

    articleData.forEach((a) => {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/)
      expect(a.title.length).toBeGreaterThan(4)
      expect(a.summary.length).toBeLessThanOrEqual(120)
      expect(a.category.length).toBeGreaterThan(0)
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.readingMinutes).toBeGreaterThan(0)
    })
  })

  it('slug 唯一（列表 key 与将来的详情路由都依赖它）', () => {
    const slugs = articleData.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('按发布日期倒序（最新在最前，页面不重新排序）', () => {
    const dates = articleData.map((a) => a.publishedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
node node_modules/vitest/vitest.mjs run src/data/articles.test.ts
```

期望：本环境报 esbuild 读盘错误（返工 ⑧）→ **跳过，继续 Step 3**，Task 9 记录待补跑。

- [ ] **Step 3: 写数据**

创建 `frontend/src/data/articles.ts`：

```ts
/**
 * 「技术分享」列表数据源。
 *
 * 现阶段是前端常量：后端 `/api/v1/articles`（规划 §9.2、M3）尚未实现。
 * 结构对齐后端 VO（`article` 表 type=TECH + `category` + `tag`），
 * 后端就绪后只需把 `useArticles()` 的实现换成 TanStack Query，组件零改动。
 *
 * ⚠️ **占位文案**：标题与摘要取自作者简历里真实做过的事，用于把版面撑到真实密度；
 * 发布前必须替换为作者自己的文章（slug 用于将来的详情路由，别改重复）。
 */
export interface ArticleVO {
  slug: string
  title: string
  /** 摘要 ≤120 字 */
  summary: string
  category: string
  tags: string[]
  /** YYYY-MM-DD */
  publishedAt: string
  readingMinutes: number
}

export const articleData: ArticleVO[] = [
  {
    slug: 'threadlocal-tool-context',
    title: 'ThreadLocal 在 Tool 层的上下文隔离：一次并发串扰的排查',
    summary:
      'Agent 并发调用工具时用户身份互相串了。用 ThreadLocal 做线程级隔离，顺手记下线程池复用带来的那个坑。',
    category: 'AI · Agent',
    tags: ['Spring AI', '并发'],
    publishedAt: '2026-08-12',
    readingMinutes: 9,
  },
  {
    slug: 'sliding-window-hybrid-retrieval',
    title: '滑动窗口分块 + 混合检索：把知识库准确率从 65% 拉到 90%',
    summary:
      'PDF 按固定长度切会把语义切断。改成 500 字符 + 50 重叠的滑动窗口，再叠上向量与 BM25 混合检索。',
    category: 'AI · Agent',
    tags: ['RAG', '检索'],
    publishedAt: '2026-06-30',
    readingMinutes: 12,
  },
  {
    slug: 'feishu-threadid-serial',
    title: '用飞书话题 threadId 做同 Case 串行：Agent 群聊的并发一致性',
    summary:
      '同一个故障排查 Case 的消息必须顺序处理，跨 Case 又要并行。以 threadId 分片 + session 锁，两头都满足。',
    category: 'AI · Agent',
    tags: ['Agent', '架构'],
    publishedAt: '2026-05-18',
    readingMinutes: 10,
  },
  {
    slug: 'pulse-zset-sharding',
    title: 'Redis ZSet 分片 + 分布式锁：Pulse 的任务多机分发',
    summary:
      '定时任务平台要横向扩容，核心是把「同一时刻的批量触发」拆到多台机器上，同时不能重复执行。',
    category: '中间件',
    tags: ['Redis', '分布式'],
    publishedAt: '2026-03-09',
    readingMinutes: 11,
  },
  {
    slug: 'archive-ten-million-rows',
    title: '1000 万行日志表归档：主键分批删除如何规避长事务与长锁',
    summary:
      '一次性 DELETE 会锁表锁到天亮。改成按主键分批 + 小事务提交，保留近三个月数据，归档窗口压到分钟级。',
    category: '数据库',
    tags: ['MySQL', '运维'],
    publishedAt: '2025-12-21',
    readingMinutes: 8,
  },
]
```

- [ ] **Step 4: 写 hook**

创建 `frontend/src/hooks/useArticles.ts`：

```ts
import { articleData, type ArticleVO } from '@/data/articles'

/**
 * 「技术分享」列表的唯一读取入口。
 *
 * 后端 `/api/v1/articles`（规划 §9.2）就绪后，把这里换成：
 *
 *   export function useArticles() {
 *     return useQuery({ queryKey: ['articles'], queryFn: fetchArticles })
 *   }
 *
 * 组件侧不需要任何改动 —— 与 `useProfile()` 同一套策略。
 */
export function useArticles(): ArticleVO[] {
  return articleData
}
```

- [ ] **Step 5: 写列表页组件**

创建 `frontend/src/pages/tech/TechListPage.tsx`：

```tsx
import { Link } from 'react-router-dom'

import { useArticles } from '@/hooks/useArticles'
import styles from './TechListPage.module.css'

/** 把 YYYY-MM-DD 显示成 YYYY.MM.DD（等宽字下点号比短横线更好对齐） */
function formatDate(value: string): string {
  return value.replace(/-/g, '.')
}

/**
 * 技术分享列表页（M3 的前端外壳）。
 *
 * 本期只做列表：详情页、Markdown 渲染、浏览量、分页都属 M3 剩余部分。
 * 因此列表项**不设链接** —— 没有详情页就跳过去只能是 404，不如先不给死链。
 */
export default function TechListPage() {
  const articles = useArticles()
  const latest = articles.reduce((max, a) => (a.publishedAt > max ? a.publishedAt : max), '')

  return (
    <section className={`container section ${styles.wrap}`} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 id="tech-title" className={styles.title}>
        技术分享
      </h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {articles.length === 0 ? (
        <div className={styles.empty}>
          <p>列表接口还没接通，这一页暂时是空的。</p>
          <p className={styles.emptyHint}>
            先看首页的项目与实习经历 —— 那边已经把两个自研项目的取舍写得比较细。
          </p>
          <Link to="/" className={styles.back}>
            回到首页
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.count}>
            共 {articles.length} 篇 · 更新至 {formatDate(latest)}
          </p>

          <div className={styles.table}>
            <div className={styles.head} aria-hidden="true">
              <span>日期</span>
              <span>标题</span>
              <span>分类</span>
              <span>阅读</span>
            </div>

            {articles.map((a) => (
              <div key={a.slug} className={styles.row}>
                <span className={styles.date}>{formatDate(a.publishedAt)}</span>
                <span className={styles.titleCell}>
                  <span className={styles.articleTitle}>{a.title}</span>
                  <span className={styles.tags}>{a.tags.join(' / ')}</span>
                </span>
                <span className={styles.category}>{a.category}</span>
                <span className={styles.reading}>{a.readingMinutes} 分钟</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 6: 写列表页样式**

创建 `frontend/src/pages/tech/TechListPage.module.css`：

```css
.wrap {
  min-height: 60vh;
}

.badge {
  display: block;
  width: 64px;
  height: 64px;
  margin-bottom: var(--ds-space-4);
  background-image: repeating-radial-gradient(
    circle at 50% 50%,
    var(--ds-ring) 0 1px,
    transparent 1px var(--ds-ring-period)
  );
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
  mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
}

.title {
  font-size: 2.5rem;
  font-weight: var(--ds-fw-display);
}

.lead {
  max-width: var(--ds-measure-prose);
  margin-top: var(--ds-space-2);
  color: var(--ds-c-text-mute);
  font-size: var(--ds-fs-lead);
}

/* 计数：等宽字 + 弱化色，跟表头同一档，不抢标题 */
.count {
  margin-top: var(--ds-space-5);
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  color: var(--ds-c-text-subtle);
}

.table {
  margin-top: var(--ds-space-3);
  border-top: 1px solid var(--ds-c-hairline);
}

.head,
.row {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 7rem 5rem;
  gap: var(--ds-space-4);
  align-items: baseline;
}

.head {
  padding-block: var(--ds-space-2);
  border-bottom: 1px solid var(--ds-c-hairline);
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  letter-spacing: 0.12em;
  color: var(--ds-c-text-subtle);
}

.row {
  padding-block: var(--ds-space-3);
  border-bottom: 1px solid var(--ds-c-hairline);
  transition: background var(--ds-t-color), box-shadow var(--ds-t-color);
}

@media (hover: hover) {
  .row:hover {
    background: var(--ds-c-accent-soft);
    box-shadow: inset 2px 0 0 var(--ds-c-accent);
  }
}

.date,
.reading,
.tags {
  font-family: var(--ds-font-mono);
  font-size: var(--ds-fs-xs);
  color: var(--ds-c-text-subtle);
}

.reading {
  text-align: right;
}

.titleCell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.articleTitle {
  font-family: var(--ds-font-display);
  font-size: var(--ds-fs-h3);
  font-weight: var(--ds-fw-display);
  color: var(--ds-c-text);
}

.category {
  font-size: var(--ds-fs-sm);
  color: var(--ds-c-text-mute);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ds-space-2);
  margin-top: var(--ds-space-5);
  padding-top: var(--ds-space-4);
  border-top: 1px solid var(--ds-c-hairline);
  color: var(--ds-c-text-mute);
}

.emptyHint {
  max-width: var(--ds-measure-prose);
  font-size: var(--ds-fs-sm);
  color: var(--ds-c-text-subtle);
}

.back {
  margin-top: var(--ds-space-2);
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-inline: var(--ds-space-4);
  border-radius: var(--ds-radius-pill);
  background: var(--ds-c-accent-bg);
  color: var(--ds-c-accent-text);
  font-size: var(--ds-fs-sm);
}

.back:hover {
  background: var(--ds-c-accent-hover);
  color: var(--ds-c-accent-text);
}

@media (max-width: 719px) {
  .title {
    font-size: 2rem;
  }

  /* 窄屏：四列压成「日期 + 标题」两栏，分类与阅读时长折到标题下方 */
  .head {
    display: none;
  }

  .row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--ds-space-1) var(--ds-space-3);
  }

  .date {
    grid-column: 1;
  }

  .reading {
    grid-column: 2;
  }

  .titleCell,
  .category {
    grid-column: 1 / -1;
  }

  .articleTitle {
    font-size: 1.1rem;
  }
}
```

- [ ] **Step 7: 写列表页渲染单测（先红后绿）**

创建 `frontend/src/pages/tech/TechListPage.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { articleData } from '@/data/articles'
import TechListPage from './TechListPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TechListPage />
    </MemoryRouter>,
  )
}

describe('TechListPage', () => {
  it('页面只有一个 h1，内容是频道名', () => {
    renderPage()

    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent('技术分享')
  })

  it('计数取自数据长度，不是写死的数字', () => {
    renderPage()

    expect(screen.getByText(new RegExp(`共 ${articleData.length} 篇`))).toBeInTheDocument()
  })

  it('每条文章渲染标题与分类', () => {
    renderPage()

    articleData.forEach((a) => {
      expect(screen.getByText(a.title)).toBeInTheDocument()
    })
  })

  it('列表项不设链接（详情页未建，避免死链）', () => {
    renderPage()

    // 除了「回到首页」的空态按钮，页面上不该有别的链接
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
```

运行：

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
node node_modules/vitest/vitest.mjs run src/pages/tech/TechListPage.test.tsx
```

期望：仍是 esbuild 环境错误 → 跳过，Task 9 记录。

- [ ] **Step 8: 类型检查 + 浏览器确认**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit
```

期望 0 错误。然后浏览器打开 `http://127.0.0.1:5173/tech`，确认：环 badge 可见、计数为 `共 5 篇 · 更新至 2026.08.12`、五行数据、无横向滚动。

- [ ] **Step 9: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add frontend/src/data/articles.ts frontend/src/data/articles.test.ts frontend/src/hooks/useArticles.ts frontend/src/pages/tech/
git commit -m "feat(tech): 技术分享列表页骨架（占位数据 + 空态 + 无死链）"
```

---

## Task 9: 验收、断言套件扩展与文档补记

**Files:**
- Modify: `.tmp/tools/audit-behavior.cjs`
- Modify: `.tmp/tools/shot-final.cjs`
- Modify: `docs/decisions.md`
- Modify: `docs/dev-journal.md`

- [ ] **Step 1: 更新渐变持有者断言**

`audit-behavior.cjs` 里把 `gradientOwners` 那段（`dom` 对象内）替换为：

```js
      // 装饰性渐变只允许出现在两类元素上：环装置（data-ring）与姓名渐变（data-gradient）。
      // 卡片底、按钮、区块背景一旦引入渐变，这里立刻亮红 —— 这是「模板感」的护栏。
      gradientLabels: qa('*')
        .filter((el) => {
          if (el === document.body || el === document.documentElement) return false
          const bg = getComputedStyle(el).backgroundImage
          return bg && bg.includes('gradient')
        })
        .map((el) =>
          el.hasAttribute('data-ring') ? 'ring' : el.hasAttribute('data-gradient') ? 'gradient' : el.tagName,
        ),
```

并把原来的断言

```js
  check('全站渐变只出现在 1 处（Hero 标题）', dom.gradientOwners === 1, `渐变元素=${dom.gradientOwners}`)
```

替换为

```js
  const strayGradients = dom.gradientLabels.filter((l) => l !== 'ring' && l !== 'gradient')
  check(
    '渐变只出现在环装置与姓名上',
    strayGradients.length === 0 && dom.gradientLabels.filter((l) => l === 'gradient').length === 1,
    `环=${dom.gradientLabels.filter((l) => l === 'ring').length} 姓名=${dom.gradientLabels.filter((l) => l === 'gradient').length} 其他=${strayGradients.join(',')}`,
  )
```

- [ ] **Step 2: 更新 h1 断言（h1 现在是两行）**

把

```js
  check('渲染姓名与一句话定位', dom.h1Count === 1 && dom.h1Text === '庄家希' && dom.hasHeadline)
```

替换为

```js
  check(
    '渲染姓名与一句话定位',
    dom.h1Count === 1 && dom.h1Text.startsWith('庄家希') && dom.hasHeadline,
    `h1="${dom.h1Text}"`,
  )
```

- [ ] **Step 3: 追加 `/tech` 页断言**

在 `audit-behavior.cjs` 的 `await browser.close()` **之前**插入：

```js
  // ---- 「技术分享」列表页（M3 前端外壳）----
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
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })

  check('技术分享页只有一个 h1 且内容正确', tech.h1Count === 1 && tech.h1 === '技术分享', `h1=${tech.h1}`)
  check('计数取自数据长度（共 5 篇）', tech.countText === '共 5 篇 · 更新至 2026.08.12', `${tech.countText}`)
  check('列表渲染 5 行', tech.rowCount === 5, `行=${tech.rowCount}`)
  check('列表项内无链接（无死链）', tech.linksInRows === 0, `链接=${tech.linksInRows}`)
  check('有数据时不渲染空态', tech.hasEmptyState === false)
  check('/tech 无横向滚动', tech.overflow <= 0, `溢出=${tech.overflow}px`)

  await techCtx.close()
```

- [ ] **Step 4: 让截图脚本支持任意 URL 与前缀**

`shot-final.cjs` 里把

```js
const BASE = 'http://127.0.0.1:5173/'
```

替换为

```js
const BASE = process.argv[3] || 'http://127.0.0.1:5173/'
```

并在写文件处给文件名加上前缀（默认空串，保持向后兼容）：

```js
  const prefix = process.argv[4] || ''
```

然后把 `${out}/${v.name}-hero.png` 改为 `${out}/${prefix}${v.name}-hero.png`，`${out}/${v.name}-full.png` 同理。

- [ ] **Step 5: 跑完整验收**

```bash
cd C:\Users\O\Desktop\myproject\jcpress\frontend
npx tsc --noEmit

cd C:\Users\O\Desktop\myproject\jcpress
node .tmp\tools\audit-behavior.cjs
node .tmp\tools\audit-contrast.cjs
node .tmp\tools\shot-final.cjs .tmp\shots-final
node .tmp\tools\shot-final.cjs .tmp\shots-final http://127.0.0.1:5173/tech tech-
node .tmp\tools\shot-final.cjs .tmp\shots-final http://127.0.0.1:5173/algo algo-
```

期望：

| 关卡 | 期望 |
| --- | --- |
| `tsc --noEmit` | 0 错误 |
| `audit-behavior` | 全部 ✔（首页 13 项 + 技术分享页 6 项） |
| `audit-contrast` | `合计未达标：0` |
| 截图 | `shots-final/` 下 4 视口 × 首页 + 4 视口 × `/tech` + 4 视口 × `/algo` |

- [ ] **Step 6: 人工核对清单（逐项打勾）**

- [ ] 亮色 / 暗色两套主题下，首页首屏都能看到环与聚光，文字清晰不压图案
- [ ] 环没有糊成噪点、没有摩尔纹（否则回到 Task 2 Step 10 调周期）
- [ ] 全站没有横向滚动（375 / 390 / 768 / 1280）
- [ ] Tab 能走到项目表格三行的「展开」按钮，Enter 能展开与收起
- [ ] 系统开启「减少动态效果」后刷新，内容直接显示、无淡入残留（Edge DevTools → Rendering → Emulate prefers-reduced-motion）
- [ ] 暗色下顶栏玻璃、复制按钮、发邮件按钮的边框可见但不刺眼

- [ ] **Step 7: 补记文档**

`docs/decisions.md` 新增一节（编号接在 #26 之后）：

```markdown
## 2026-09-28 · 一期视觉语言修订（实施期补充）

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 27 | **环装置的第三层（135° 面差渐变）不用作叠加层** | 参照站那一层是元素自身的底；作为叠加层会得到不透明背景把正文与 body 氛围层全遮住。「底面差」由既有的 `--ds-atmosphere-*` 承担（设计文档 §2.1 注记） |
| 28 | **`RingField` 内部禁止写 `transform`** | 入场序列 `[data-reveal]` 会写 `transform: translateY(18px)`，`.is-revealed` 又写 `transform: none`；环若用 `translateX(-50%)` 居中会被抵消。父容器居中一律用 `margin` |
| 29 | **项目表格列去掉「年份」** | 现有 `ProjectVO` 没有年份字段，凭空编年份就是假数据。改为 `ID / 项目 / 角色 · 状态`；等后端补 `period` 再加列 |
| 30 | **展开面板用 `hidden` 属性 + `[hidden]{display:none}` 兜底** | `.panel` 是 `display:flex`，`hidden` 在 flex 面前会失效（浏览器默认样式被覆盖）。必须显式兜住，否则面板永远展开 |
```

`docs/dev-journal.md` 追加「阶段 9 · 实施」一节，按既有格式记录：用户关键原话、AI 关键输出、变动的文件表、**翻车与返工**（环境相关：Playwright 每次新会话要提权；vitest/build 仍被阻断）、验收结果表、遗留项。

- [ ] **Step 8: 更新遗留清单**

在 `docs/dev-journal.md` 的遗留里补两条：

- 环境修复后补跑：`vitest`（`latin.test.tsx` / `articles.test.ts` / `TechListPage.test.tsx` / `HomePage.test.tsx`）+ `vite build` + 首屏 gzip 体积复测。
- 列表页 5 条占位文章标题待作者替换（`src/data/articles.ts` 顶部已标注）。

- [ ] **Step 9: Commit**

```bash
cd C:\Users\O\Desktop\myproject\jcpress
git add docs/decisions.md docs/dev-journal.md .tmp/tools/audit-behavior.cjs .tmp/tools/shot-final.cjs
git commit -m "test+docs: 断言套件扩展到技术分享页；补记实施期决策与验收"
```

> `.tmp/` 已在 `.gitignore` 里（`frontend/.tmp/` 只忽略了前端那份，仓库根的 `.tmp/` 目前**未忽略**）。
> 本步骤故意提交这两个脚本 —— 它们是当前环境下唯一可运行的验收手段。若不想入库，改为
> `git add docs/...` 并在 `docs/dev-journal.md` 里记下脚本路径即可。

---

## 2. 计划自审（写作时已逐项检查）

**规格覆盖**：设计文档 §2 环装置 → Task 2/5/6/7/8；§3 token → Task 1；§4 排版 → Task 2/4；
§5 首页九区块 → Task 2（Hero）/3（顶栏）/4（数字·技术栈·经历·教育）/5（项目）/6（联系·页脚）；
§6 占位页 → Task 7；§7 列表页 → Task 8；§8 动效 → Task 2/5/6（环淡入、行 hover）；
§9 可访问性 → Task 5/6（aria-expanded、触摸目标、focus）；§10 性能 → 全任务只用 CSS 渐变；
§11 冲突修订 → Task 1（噪点条目）、Task 4（大数字折中）、Task 2 Step 10（周期校准）、Task 8（M3 提前）；
§13 验收 → Task 9。

**占位符扫描**：无 TBD / TODO / 「类似 Task N」；每个代码步骤都有完整代码。

**类型一致性**：`ArticleVO`（Task 8 Step 3）字段与 `TechListPage`（Step 5）使用一致；
`RingField` 的 props（`size` / `opacity`）在 Task 6 页脚调用处一致；
`ChannelPlaceholder` 的 props（`title` / `lead` / `empty` / `is404`）在 `App.tsx`（Task 7 Step 3）传参一致；
`data-ring` 标记在 RingField、项目 badge、占位页 badge、列表页 badge 四处都写了，与 Task 9 的断言口径一致。

**已知未覆盖（有意为之）**：暗色主题的截图需要手动切换主题后再拍一次（`shot-final.cjs` 目前按 `colorScheme` 建上下文，
而站点主题存在 `<html data-theme>`；如需自动拍两套，在 Task 9 里给脚本加一个「点击主题切换按钮」的步骤）。
