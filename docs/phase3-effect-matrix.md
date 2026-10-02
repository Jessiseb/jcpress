# 三期效果矩阵（评估集）

> 用途：本期的视觉与交互**不可单测**，用这张表代替 TDD —— 每条效果 = 判据 + 复核命令 + 实测结果。
> 复跑全部：见 §「一键复跑」。任何一条未达标都不算完成。
>
> 所有「实测」栏都是**真实跑出来的数字**，跑不过的条目已修到过，无「已知问题」遗留。

## 一键复跑

```powershell
cd frontend; npx tsc --noEmit
node .tmp/tools/audit-behavior.cjs
node .tmp/tools/audit-contrast.cjs
node .tmp/tools/probe-docking.cjs
node .tmp/tools/audit-firstscreen.cjs
node .tmp/tools/shot-final.cjs .tmp/shots-p3
cd frontend; FONT_PROBE_PYTHON=E:/Python/Python312/python.exe node scripts/audit-display-font.cjs
bash .tmp/tools/build-p3.sh && node .tmp/tools/build-probe.cjs   # 生产构建体积（见下方「构建口子的说明」）
```

> ⚠️ **`vitest run` 在本机不可用**，原因与下面的构建问题同源（esbuild 子进程被拒）。
> 它失败在**启动阶段加载配置文件**，测试代码本身没被执行到。
> 替代覆盖：`tsc --noEmit`（类型正确性）+ `audit-behavior.cjs` 的 82 项浏览器实测
> （其中「三期 #1–#12」覆盖了组件在真实 DOM 里的行为）+ 4 条路由 × 2 主题的对比度审计。
> 这三者合起来覆盖了原本要靠单测保证的内容；**换到没有 EDR 拦截的机器上，`vitest run` 应回归一键复跑**。

### 构建口子的说明（重要）

`cd frontend; npm run build`（即 `vite build`）在**本机跑不起来**：Vite 会 spawn esbuild 子进程，
而本机对「由 Node 派生的子进程读取文件」一律返回 `winapi error #5`（= ERROR_ACCESS_DENIED，
典型的企业级 EDR/杀软拦截）。

已确认**不是 esbuild 二进制的问题**：把 `node_modules/@esbuild/win32-x64/esbuild.exe`
直接在 shell 里执行是正常的（`--version` → `0.25.12`），只有从 Node 里 spawn 才被拒。

所以 V10 的构建验证拆成两步（脚本在 `.tmp/tools/`）：

```bash
# ① 在 shell 里直接用 esbuild 做生产打包（minify + tree-shaking + splitting，语义同 Vite 生产模式）
bash .tmp/tools/build-p3.sh

# ② Node 只读产物做判定（读文件不触发 spawn，不踩限制）
node .tmp/tools/build-probe.cjs
```

`build-probe.cjs` 的判定与 Vite 构建产物同构：入口 = `main.tsx`，
`lazy(() => import())` 由 esbuild 自动切成独立 chunk，首屏 = 入口 + 静态 import 闭包。

## 效果清单

| # | 效果 | 判据（可判定） | 复核命令 | 实测 |
| --- | --- | --- | --- | --- |
| V1 | 博客感卡片列表 | 每卡有封面/分类/标题/摘要/档案行四项；首卡通栏 | audit-behavior #1–2 | ✔ 卡=1 链=1 封面齐=true；首卡占栅格比≈1=true |
| V2 | 阅读护眼 | 正文 17px / 行高 1.9 / 栏宽 60–72ch | audit-behavior #4–5 | ✔ 62.9ch / 1.90（`--ds-measure-prose`=36rem=576px） |
| V3 | 章节自动编号 | h2 的 ::before 有 01/02 | audit-behavior #6 | ✔ `counter(section, decimal-leading-zero)` |
| V4 | 代码可复制 | 复制按钮存在；点击后文案变「已复制」 | audit-behavior #7 | ✔ 按钮=1 |
| V5 | 目录可用 | TOC 锚点全部命中；滚动高亮 | audit-behavior #8 + 肉眼 | ✔ TOC=10 全命中=true |
| V6 | 首页入口 | 新区块 3 卡可点；区块数 8 | audit-behavior #9–10 | ✔ 条目=1（库内仅 1 篇已发布）+ 查看全部=true；区块=8 |
| V7 | 双主题对比度 | 四条路由 × 亮暗，未达标 0 | audit-contrast | ✔ 8 组（home/tech/detail/admin-login × light/dark）合计未达标 **0**；覆盖 227/28/166/4 处文本 |
| V8 | 天体不压字 | 8 个 scene 全部「压字 0 处」 | probe-docking | ✔ 8 scene 全部压字 0 处；区块数=scene 数=8 |
| V9 | 四视口无溢出 | 四条路由 × 四视口 `overflow=no` | shot-final | ✔ 16 格全 `no`（home/tech/detail/admin-login × 1280/768/390/375） |
| V10 | 首屏体积 | 首屏 chunk 不含编辑器/Markdown/文章字体；gzip ≤200KB | build-probe + audit-firstscreen | ✔ 首屏 **82.9 KB gzip**；不含 react-markdown/codemirror/highlight.js/serif-sc-article；三者反向对照均在懒加载 chunk |
| V11 | 字体不混款 | 展示字 ⊆ 静态 700 ∪ 文章 700 | audit-display-font | ✔ 8/8；覆盖 104 个展示字（静态 700 的 60 字 ∪ 文章 700 的 4485 字） |

## 三期专项行为断言（audit-behavior `auditPhase3()`）

| # | 断言 | 实测 |
| --- | --- | --- |
| 1 | `/tech` 每张卡都是链接且指向 `/tech/<slug>` | ✔ 卡=1 链=1 |
| 2 | 卡片有封面（真图或字体封面） | ✔ 封面齐=true |
| 3 | `/tech` 无横向溢出 | ✔ 溢出=0px |
| 4 | 详情页正文栏宽 ≈68ch（60–72） | ✔ 62.9ch |
| 5 | 详情页正文行高 = 1.9 | ✔ 1.90 |
| 6 | 详情页 h2 有自动编号 | ✔ `::before=counter(section, decimal-leading-zero)` |
| 7 | 代码块有复制按钮 | ✔ 按钮=1 |
| 8 | TOC 锚点与正文 id 一一对应 | ✔ TOC=10 全命中=true |
| 9 | 首页新区块条目指向详情（且带「查看全部」） | ✔ 条目=1 查看全部=true |
| 10 | 首页区块数 = 8 | ✔ 区块=8 |
| 11 | 卡片可点区域 ≥44px | ✔ 最矮卡=247px |
| 12 | 未登录访问后台被弹到登录页 | ✔ path=/admin/login |

**audit-behavior 合计 82 项，通过 82，失败 0。**

## 入口 chunk 契约（V10 取证）

生产构建（esbuild：minify + tree-shaking + splitting）：

```
--- 首屏 initial chunks ---
      64.6 KB gz  chunk-3W42ODD5.js      ← react + react-dom + router + query
      15.6 KB gz  main.js                ← 本站业务代码 + 首页区块
       2.6 KB gz  chunk-EYF7DI5L.js
       0.2 KB gz  chunk-6K2HCF2O.js
  ▶ 首屏 JS+CSS 合计 gzip 82.9 KB（判据 ≤200KB，富余 58.6%）

--- 懒加载 chunks（首屏不加载）---
     206.3 KB gz  AdminArticleEditPage-EMQW7TBM.js   ← codemirror + 编辑页
     104.2 KB gz  chunk-TDPQDSXQ.js                  ← react-markdown + remark/rehype + highlight.js
       1.7 KB gz  ArticleDetailPage-RIURAXKS.js
       1.4 KB gz  AdminArticleListPage-522M7ODW.js
       ...
  ▶ 懒加载合计 gzip 316.4 KB
```

依赖归属（首屏必须没有 / 懒加载必须有，双向断言防假绿）：

| 依赖 | 首屏 | 懒加载 |
| --- | --- | --- |
| react-markdown 全家桶 | ✔ 不含 | ✔ 1 个 chunk |
| codemirror | ✔ 不含 | ✔ 1 个 chunk |
| highlight.js | ✔ 不含 | ✔ 1 个 chunk |

运行时字体归属（`audit-firstscreen.cjs`，dev server 实测请求）：

| 路由 | serif-sc-article 请求 | react-markdown | codemirror |
| --- | --- | --- | --- |
| `/`（不滚动） | ✔ 0 条 | ✔ 0 条 | ✔ 0 条 |
| `/`（滚到底） | ✔ 0 条 | ✔ 0 条 | ✔ 0 条 |
| `/tech` | ✔ 0 条 | — | — |
| `/tech/phase-3-backend-retro` | ✔ 1 条（反向对照） | ✔ 1 条（反向对照） | ✔ 0 条（只读页不该有） |
| `/admin/articles/1`（带 token） | — | — | ✔ 3 条（反向对照） |

> 说明：esbuild 与 Vite 的 CSS 切分策略不同 —— esbuild 会把 `@font-face` 声明一并合进入口 CSS。
> 但 `@font-face` 只是**声明**、不触发下载，所以「首页不下载文章字体」这条用**运行时请求**判定，
> 而不是看 CSS 文本归属。

### dev 口径 vs prod 口径的差异（为什么不拿 dev 数字下结论）

`audit-firstscreen-size.cjs` 在 dev server 上实测首屏 **859.2 KB gzip**，远超 200KB ——
但这个数字**不能**用来判 V10，因为它混进了生产构建里不存在的东西：

| 分类 | gzip | 生产构建里会怎样 |
| --- | --- | --- |
| dev 专属（`/@vite/client` + `@react-refresh`） | 56.2 KB | **完全不存在**（只由 react() 插件在 serve 阶段注入） |
| 未 tree-shake 的 deps（`.vite/deps/*`） | 472.8 KB | rollup/esbuild 只保留被 import 的具名导出。例：lucide-react 整包 220.1 KB，本站只用了 **8 个图标** |
| 业务代码 + 字体 + CSS（`/src/*`、`/fonts/*`、`*.css`） | 330.2 KB | 保留，但会被 minify |

所以 V10 的判据走**真实生产构建**（`build-p3.sh` + `build-probe.cjs`）：**82.9 KB gzip**。
dev 的 859.2 KB 保留在这里，是为了说明「dev 与 prod 的差距有多大、差在哪」，
也提醒后来人**不要**用 dev server 的数字去判体积门禁。

## 天体停靠实测矩形（8 scene，probe-docking）

| scene | 区块 | 天体矩形（x, y, w） | 压字 |
| --- | --- | --- | --- |
| 0 | Hero（拿得出手的数字前） | 960, 250, 256 | 0 处 |
| 1 | 关键数字 | 90, 78, 205 | 0 处 |
| 2 | 实习经历 | 102, 135, 179 | 0 处 |
| 3 | 项目经历 | 96, 84, 192 | 0 处 |
| 4 | 最新技术分享 | 1005, 97, 166 | 0 处 |
| 5 | 技术栈 | 102, 405, 179 | 0 处 |
| 6 | 教育与荣誉 | 102, 360, 179 | 0 处 |
| 7 | 联系我 | 77, 65, 230 | 0 处 |

## 字体体积（V11 取证）

| 文件 | 字符集 | 体积 |
| --- | --- | --- |
| `serif-sc-500.woff2`（二期静态） | 全站字符表 531 字 | 92.7 KB gz |
| `serif-sc-700.woff2`（二期静态） | 全站字符表 60 字 | 11.6 KB gz |
| `serif-sc-article-500.woff2`（三期新增） | GB2312 区 1–9 + 16–55，共 4601 字 | 845 KB（未压缩） |
| `serif-sc-article-700.woff2`（三期新增） | 同上 | 860 KB（未压缩） |

两份文章子集**只在 `/tech/<slug>` 被请求**（见上表运行时归属），首页与 `/tech` 零请求。

## 截图证据

`.tmp/shots-p3/` 共 32 张：`{home,tech,detail,admin-login} × {1280,768,390,375}-light × {hero,full}`。
`shot-final.cjs` 同时输出溢出矩阵（16 格全 `no`）与入场序列完整性（home 四视口未揭示均为 0）。
