# design-system — 从 golangstar.cn 提取的设计基线

本目录是 `/extract-design-system https://golangstar.cn/` 的产物，用于 **jcpress 个人网站的前期设计基线**。
只是起点，不是成品设计系统：没有任何组件实现，也没有做逐状态的交互验证。

## 文件说明

| 文件 | 来源 | 可信度 |
| --- | --- | --- |
| `.extract-design-system/raw.json` | dembrandt 单页计算样式提取 | 高（真实渲染值），覆盖颜色/字号/间距/边框/阴影/断点 |
| `.extract-design-system/normalized.json` | 工具归一化结果 | **低** — 只识别出 1 个主色、无圆角/阴影刻度 |
| `tokens.json` / `tokens.css` | 工具生成的起步 token | **低** — 与上面同源，仅供对照 |
| `tokens.curated.css` | 手工解析站点样式表里 **作者声明** 的 CSS 变量层 + raw.json 交叉验证 | 高（含 light/dark 两套完整语义色） |
| `tokens.curated.json` | 上面那份的机器可读版本 | 高 |
| `palette-options.html` | 品牌主色候选预览（6 个候选 × 亮/暗两套 × 语义色撞色判定） | 决策辅助，非产品代码 |

**结论：优先使用 `tokens.curated.*`。** 自动提取对这类"设计变量驱动"的站点效果不好（页面
`--vp-c-accent` 是 `rgb(7.1084070796, 86.0907079646, 171.3915929204)` 这种小数写法，工具把它
算成了单一主色），所以补了一遍对样式表的解析。

## 溯源与许可

目标站点是 VuePress 2 + **VuePress Theme Hope** 构建的文档/博客站，两套依赖均为 **MIT** 许可
（已核对 npm registry：`vuepress@2`、`vuepress-theme-hope@2.0.0-rc.109` 的 `license` 字段均为 MIT）。
色板基本来自主题默认 token 层 + 站点的少量覆盖，因此复用风险低；但**建议不要整站照搬**：

- 主色 `#096fdc` 是主题默认的靛蓝系。个人网站建议换成自己的主色，只保留这套 token **结构**。
- 字体栈里的 `STHeiti / Microsoft YaHei / SimSun` 中文兜底顺序值得保留。
- 其余（间距 4px 基准、8px 卡片圆角、0.3s ease 过渡、780px 正文宽度）是通用且经过验证的选择，可直接沿用。

## 已知缺口（不要当成完整系统）

- 只有首页 + 一篇文章页两个页面的证据，不能代表整个产品。
- 组件只提取到"看到过"的形态：feature 卡片、搜索框、代码块、图标按钮、导航链接。
  按钮的 hover/active/focus 是全站混采的，**未做组件级状态矩阵**。
- 评论组件、DocSearch 弹窗内部、打印样式没有逆向。
- 动效只到 `transition` 层级，没有拆解关键帧编排。
- 阴影刻度是从计算样式去重得到的，不是站点声明的 token。

## 使用方式

拿到设计确认后，在前端入口引入一次：

```ts
// src/main.tsx
import './styles/tokens.curated.css'
```

改品牌色**不只是覆盖 `--ds-c-accent*`**：还有两处硬编码色不会自动跟随 ——
`--ds-shadow-accent`（蓝 `rgb(37 99 235 / 20%)`）与两个主题的 `--ds-gradient-hero`（末端紫 `#5c07ab` / `#9023f6`），
且暗色主题的 accent 需要独立给值（深底上必须提亮）。完整清单与候选色的实测对比度见
`../docs/项目前期规划.md` 附录 D；预览用浏览器打开 `palette-options.html`。

另一个坑：本目录的语义色（blue / green / yellow / red / purple / indigo）几乎占满了色相环，
选品牌色时必须检查与最近语义色的距离 ≥ 25°，否则用户分不清「品牌色」和「状态色」。
