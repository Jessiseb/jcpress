# 风格提取 · golangstar.cn（秀才的进阶之路）

> 用途：作为 jcpress 首页「去 AI 味」的视觉语言基准。
> 方法：直连抓取 HTML + 构建产物 CSS（`assets/style-CMxb-D9U.css`，175 KB），并注入 Playwright 读取关键元素的 `getComputedStyle`，在 1280×900 亮色 / 1280×900 暗色 / 390×844 三个视口各截一次图。
> 抓取时间：2026-09-28。站点技术栈：VuePress 2.0.0-rc.19 + vuepress-theme-hope 2.0.0-rc.66。

---

## 1. 结论先行：它「不 AI」靠的是三件事

1. **一个强调色，用到底，且只用一次**——首页唯一装饰性渐变是 Hero 标题文字；其余全部是中性灰 + 一处浅蓝底。
2. **表面几乎不用阴影，靠 1px 细边 + 极浅底色分块**——卡片无位移、无悬浮放大、无发光。
3. **字号层级是「一超多平」**——Hero 标题 57.6px 独占，其余全部落在 16–20.8px 的窄带里；没有任何中间尺寸的「噱头大字」。

---

## 2. 颜色令牌（实测值，非推测）

### 亮色

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| bg | `#FFFFFF` | 页面底 |
| bg-alt | `#F6F6F7` | 次级面 |
| hero 底色 | `rgba(240,248,255,.85)` | Hero 区平铺浅蓝（`::before` 伪元素，**不是渐变**） |
| 卡片底 | `#F0F7FF` | feature 卡片 |
| 卡片边 | `#E2E8F0` | 1px |
| border | `#C2C2C4` | 分隔线 |
| text | `#3C3C43` | 正文（即 `rgb(60,60,67)`，Apple label 灰） |
| text-mute | `rgba(60,60,67,.78)` | 卡片正文 |
| text-subtle | `rgba(60,60,67,.56)` | 辅助说明 |
| accent | `#0756AB` | **卡片标题、图标**——强调色的深色档 |
| accent-bg | `#096FDC` | 主按钮填充 |
| accent-hover | `#0A7BF5` | 按钮 hover |
| accent-soft | `rgba(20,99,184,.14)` | 浅底强调 |
| control | `rgba(142,150,170,.10)` | 次级按钮 / 搜索框底 |
| control-hover | `rgba(142,150,170,.16)` | 次级按钮 hover |
| 阴影 | `rgba(0,0,0,.05) 0 2px 8px` | 卡片；导航栏用 `rgba(0,0,0,.15) 0 2px 8px` |

### 暗色

| 令牌 | 值 |
| --- | --- |
| bg | `#1B1B1F` |
| bg-alt | `#161618` |
| bg-elv | `#202127` |
| 卡片底 | `rgba(7,86,171,.10)`（半透明蓝，不是灰） |
| border | `#3C3F44` |
| text | `rgba(235,235,245,.86)` |
| text-mute | `rgba(235,235,245,.60)` |
| text-subtle | `rgba(235,235,245,.38)` |
| accent | `#2288F6` |
| accent-hover | `#096FDC` |

### Hero 标题渐变（全站唯一渐变）

```
亮色：linear-gradient(120deg, #0A7BF5, #0756AB 30%, #5C07AB 100%)
暗色：linear-gradient(120deg, #0A7BF5, #0756AB 30%, #9023F6 100%)
```

实现方式：`background-clip: text` + `-webkit-text-fill-color: transparent`。

---

## 3. 字体与字号

字体栈（**无任何 Web Font，纯系统栈**）：

```
正文：-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
      Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
标题：-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
      Arial, "Noto Sans", STHeiti, "Microsoft YaHei", SimSun, sans-serif
等宽：Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace
```

> 关键：标题与正文用的是**同一套系统栈**，标题不加衬线、不加装衬字体。层级靠字号和字重拉，不靠换字体。

| 元素 | 字号 | 字重 | 颜色 |
| --- | --- | --- | --- |
| Hero 标题 | 57.6px (3.6rem) | 700 | 渐变文字 |
| 卡片标题 | 20.8px (1.3rem) | 600 | `#0756AB` |
| 站名 | 20px (1.25rem) | 400 | text |
| 主 CTA | 19.2px (1.2rem) | 500 | `#FFF` |
| 卡片正文 | 16px | 400 | `rgba(60,60,67,.78)` |
| 正文 | 16px | 400 | `#3C3C43` |

响应式降级阶梯（Hero 标题）：`3.6rem → 2.5rem → 2.25rem → 2rem`。

---

## 4. 布局与尺寸

| 项 | 值 |
| --- | --- |
| 首页内容宽 | **1160px** |
| 文档正文宽 | 780px |
| 导航栏高 | 60px（3.75rem），padding `11.2px 24px` |
| 导航栏底 | `rgba(255,255,255,.9)` + `backdrop-filter: saturate(1.5) blur(12px)` + 底部 1px 边 |
| Hero 区高 | 桌面约 386px（内容撑开，不写死） |
| 卡片 | padding 16px，margin 8px，宽 262px（1280 视口 4 列） |
| 栅格 | `flex` + `flex-basis: calc(33% - 3rem)` → `25%` → `50%` → `100%` |

圆角：卡片 `8px`；胶囊按钮 `32px`（2rem）；代码块 `6px`。
间距：全部落在 8px 的倍数上（`0.25/0.5/1/1.5/2.5rem`）。

---

## 5. 交互与动效

- 全局过渡：`transition: .3s ease`，命名 `--vp-t-color`。
- **hover 只改背景色**（`grey-soft` 或 `accent-hover`）。
- **没有**卡片位移、**没有**阴影加深、**没有**缩放。
- `:active` 统一 `transform: scale(.96)`——把「按下去」的反馈放在 active 而非 hover。
- hover 时在行尾追加 `➜` 字符（纯文本，不用 SVG 图标库）。

---

## 6. 首页信息结构

```
[导航栏]  logo + 站名 │ 6 个导航项（每项一个小图标 + 文字）│ GitHub 图标 │ 搜索框（⌘K）
[Hero]    居中：形象图 → 大标题（渐变）→ 描述段（灰）→ 一个主 CTA
[特性区]  4 张等宽卡片：图标+加粗标题（强调色）/ 两行说明（灰）
[正文]    「推荐阅读」+ 链接列表
[页脚]
```

注意：Hero 只有**一个** CTA，没有次级按钮，没有标签胶囊。

---

## 7. 反模式对照表（这些是「AI 味」的来源）

| 反模式 | golangstar 的做法 |
| --- | --- |
| 大数字 count-up 统计条 | 完全没有数字指标区 |
| 点阵/百分比「熟练度」条 | 完全没有；技能用文字列表表述 |
| 「已上线」「进行中」彩色状态徽章 | 无任何状态徽章 |
| 技术标签胶囊组 | 无 |
| 卡片内再嵌卡片 | 卡片恒为单层 |
| 每段标题都配一句总结副标题 | 只有正文段落，标题下不强制配副标题 |
| 多色图标 / 彩色 emoji 当区块图标 | 单色 FontAwesome 线性图标，跟随文字色 |
| 大圆角（16–24px）+ 重阴影 | 8px 圆角 + `0 2px 8px rgba(0,0,0,.05)` |
| 渐变铺满区块背景 | 渐变只出现在 Hero 标题文字上 |
| 毛玻璃卡片 | 只有导航栏有 backdrop-filter，正文区无 |

---

## 8. 移植到 jcpress 的规则

1. **保留品牌色青碧 Teal**（`design-system/` 已定），但要拆成三档：`accent`（深，用于标题/图标）、`accent-bg`（中，用于按钮填充）、`accent-hover`（亮，用于 hover）。
2. Hero 标题渐变**保留但收紧**：只允许出现在 H1 上，且亮度对比不过分（当前深墨绿渐变显脏，需提亮）。
3. 所有卡片统一：`1px 细边 + 极浅底色 + 8px 圆角 + 0 2px 8px rgba(0,0,0,.05)`；去掉悬浮位移。
4. 删除：数字 count-up 区的超大数字（改成正文列）、技能点阵、状态徽章、标签胶囊组、嵌套卡片。
5. 字号收敛到「一超多平」：H1 独占大字号，其余落在 16–21px。
6. hover 只改背景色，`:active` 用 `scale(.96)`。
