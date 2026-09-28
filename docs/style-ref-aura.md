# 风格提取 · AURA（21st.dev 预览模板）

> 用途：作为 jcpress 一期「环装置 + 双主题」视觉语言的参照基准（第二份参照，第一份见 `style-ref-golangstar.md`）。
> 来源：`https://21st-aura-svelte-preview-jdpo1k26v-larsen3.vercel.app/`（Vercel 预览，SvelteKit + Tailwind v4 + GSAP + Lenis）。
> 方法：Playwright(Edge) 抓取三个视口截图 + 注入 `getComputedStyle` 读取关键元素与根变量；
> 另直接拉取构建产物 CSS（`_app/immutable/assets/2.DYfBTyaR.css` 428 B、`0.Bh9wlG9d.css` 45.7 KB）取源值。
> 抓取时间：2026-09-28。**本文件是证据，不是设计；移植决策见 `design-visual-language.md`。**

---

## 1. 结论先行：它「有味道」靠的是四件事

1. **一个图案装置**：同心圆环（1px、7px 周期）+ 中心聚光 + 遮罩渐隐，同一个元素里叠三层背景 —— 图案是「光」，不是「底纹」。
2. **极端的字号跨度**：H1 102.4px / 正文 24px，但**字重只有 400 / 300** —— 靠尺寸与衬线拉气质，不靠加粗。
3. **衬线 + 斜体**：`Georgia` 衬线做全部大标题，斜体只落在**单个 Latin 词**上，且该词同时降为 50% 灰（`digital`、`Works.`、`in mind?`）。
4. **近黑到底 + 极细半透明边**：底 `#050505`、面 `#0a0a0a`、边 `#ffffff1a`（10% 白），全站没有一处灰色实边。

---

## 2. 颜色令牌（实测值）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--color-bg-base` | `#050505` | 页面底 |
| `--color-bg-surface` | `#0a0a0a` | 面 / 卡片 |
| `--color-bg-glass` | `#05050599` | 玻璃（导航、胶囊） |
| `--color-hover-bg` | `#111` | hover 底色 |
| `--color-text-primary` | `#fff` | 主文字 |
| `--color-text-secondary` | `#a3a3a3` | 次级文字 |
| `--color-text-muted` | `#525252` | 弱文字 |
| `--color-border` | `#ffffff1a` | **所有**边框（10% 白） |
| `--color-accent` | `#3b82f6` | 唯一强调色（蓝） |

正文实测色：`p` 24px / 300 / `rgba(255,255,255,.5)` —— 半透明文字而非灰值。

---

## 3. 图案装置（本文件最有价值的一段，源值直取 CSS）

```css
/* .hero-field —— 首屏背后的「光场」 */
background:
  radial-gradient(circle at 50% 45%, #fff3, #0000 34%),                                   /* 20% 白聚光 */
  repeating-radial-gradient(circle at 50% 45%, #ffffff1f 0 1px, #0000 1px 7px),           /* 1px 环 / 7px 周期 / 12% 白 */
  linear-gradient(135deg, #050505 15%, #151515 50%, #050505 85%);                         /* 135° 面差，让底不是纯平 */
mask-image: radial-gradient(#000 5%, #0000 72%);                                          /* 中心实、外缘渐隐 */
```

配套的整页氛围层（同页其它绝对定位 div，实测 `background-image`）：

| 层 | 值 | 作用 |
| --- | --- | --- |
| 晕影 | `radial-gradient(rgba(0,0,0,0) 20%, #050505 90%)` | 内容像从暗处浮出 |
| 左右边缘淡出 | `linear-gradient(to right, #050505, transparent)`，宽 128 / 320px | 跑马灯两侧收边 |
| 上下渐变 | `linear-gradient(to top, #000, rgba(0,0,0,.4) 50%, transparent)` | 区块遮挡 |
| 强调色带 | `linear-gradient(to right, transparent, oklab(0.623 -0.033 -0.185 / .05), transparent)` | 5% 暖色横带，极淡 |

> **实现提醒**：7px 周期在 1280 宽下非常密。截图缩放后（1280→843）会因采样产生摩尔纹，肉眼看成「十几圈大环」——
> 直接照抄 7px 与照抄截图观感会得到完全不同的东西。jcpress 取哪个周期见 `design-visual-language.md` §2（含校准规则）。

---

## 4. 排版（实测）

| 元素 | 字号 | 字重 | 字体 | 字距 |
| --- | --- | --- | --- | --- |
| H1「We craft digital experiences.」 | 102.4px | 400 | `Georgia, "Times New Roman", serif` | -2.048px |
| H2「Selected Works.」 | 96px | 400 | 同上 | -1.92px |
| H3 项目名 / 服务名 | 60px / 48px | 400 | 同上 | — |
| H2 页脚「Have a project in mind?」 | 89.6px | 400 | 同上 | — |
| 正文 | 24px | 300 | `Inter, ui-sans-serif, …` | normal |
| 微标签（`MISSION` / `FAQ` / 表头） | 10–12px | 500 | `ui-monospace, SFMono-Regular, Menlo…` | 0.16–0.22em，全大写 |

移动端 Hero 第二行的响应式手法值得记一笔：`white-space: nowrap; font-size: min(9.2vw, 2.6rem)`。

字体令牌：`--font-serif: Georgia, "Times New Roman", serif`、`--font-sans: Inter, …`、`--font-mono: ui-monospace, …`。
**无 Web Font 下载**（Inter 走系统回退），与我们「零字体下载」的预算约束一致。

---

## 5. 组件与版式

| 组件 | 做法 |
| --- | --- |
| 顶栏 | **悬浮胶囊**：`max-width ~890px` 居中、`border-radius: 999px`、1px `#ffffff1a` 边、玻璃底 + `backdrop-filter`；实心白胶囊 CTA |
| 主按钮 | 白底黑字胶囊 `radius: 3.35e7px`（`9999px`），自带一圈外发光 |
| 次按钮 | 透明底 + 1px `rgba(255,255,255,.2)` 边胶囊 |
| 服务区 | `01 / 02 / 03` 编号 + 48px 衬线标题 —— 编号用在**真是序列**的地方 |
| 作品区 | 编辑式表格：`ID / PROJECT / ROLE / YEAR` 表头（等宽大写），行高 ~96px，60px 衬线项目名，hover 揭示 |
| 引言区 | 大号衬线引言 + 背后圆环 + 轮播圆点 |
| 数据区 | 蓝色（`#3b82f6`）数字 + 等宽灰标签（模板里是 `0+` 占位） |
| FAQ | 两栏：左标题 + 右 `+` 手风琴 |
| 页脚 | 89.6px 衬线斜体 + 四栏链接 |

结构统计：8 个 `<section>`、10 个内联 `<svg>`、**0 个 canvas / 0 张位图 / 0 个视频** —— 视觉全部由 CSS 与 SVG 承担。
`<html class="lenis">` 说明用了 Lenis 平滑滚动，动效靠 GSAP。

---

## 6. 移植到 jcpress 的取舍

**照搬**
1. 环 + 聚光 + 遮罩渐隐这套「光场」配方（数值按我们的正文密度下调，见设计文档 §2）。
2. 近黑底 + `#ffffff1a` 级别的半透明细边替代灰色实线。
3. 衬线大标题 + **斜体只给 Latin 词**；字重压到 400–500。
4. 玻璃胶囊（按钮、导航底、复制按钮）。
5. 编辑式表格承载「项目经历」；等宽字只给表头 / 年份 / 单位。
6. 蓝色强调数字。

**不照搬（并说明理由）**
1. 102.4px 标题与 24px/300 的 50% 灰正文 —— 这是视觉站的取舍；本站是简历站，HR 要读内容，正文对比度与字号另有硬约束。
2. 满页等宽全大写 eyebrow 标签 —— frontend-design 明列的「生成感」信号，只在真有信息处使用。
3. GSAP + Lenis —— 技术选型已定死（React + CSS + IntersectionObserver），且预算里没有动效库。
4. 纯暗色单主题 —— 本站保留明暗双主题，两套都要成立。
5. `01/02/03` 编号 —— 只有当内容真是序列时才用。
