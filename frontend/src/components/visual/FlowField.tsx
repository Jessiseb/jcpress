import { useEffect, useState, type CSSProperties } from 'react'

import styles from './FlowField.module.css'

/**
 * 流线布景层（二期 phase-2-visual）。
 *
 * 几何照搬参考组件 `background-paths`：`viewBox 696×316`、36 条路径 × 2 组镜像
 * （position = 1 / -1），线宽与透明度随索引递增。
 *
 * 与参考实现的**五处**刻意偏离（都不是审美选择，是为了可验收 / 可上线）：
 *  1. **不用 framer-motion**：SVG 原生 `pathLength="1"` 把每条路径的几何长度归一化，
 *     于是 `stroke-dasharray: .3 .7` 就是「只显示 30%」，关键帧把 `stroke-dashoffset`
 *     从 0 动到 -1 就是「光段沿线前进」，与 `motion.path` 的 `pathLength` / `pathOffset`
 *     观感等价，零依赖。
 *  2. **确定性错峰**：参考用 `Math.random()` 生成长度，会让每次截图与断言的动画相位都不同。
 *     这里用 `20 + (i % 11)` 秒 / `9 + (i % 7)` 秒，两两组合在 36 条内不重复。
 *  3. **透明度与线宽按档位归一化**：参考的 `0.1 + i * 0.03` 在 i > 17 之后会超过任何合理上限
 *     （i=35 时是 1.15），且会让深色线在亮色主题上抢正文。这里改成在档位内把描边浓度的**目标值**
 *     从 0.16 线性升到 0.5，并交给 CSS `min(var(--path-alpha), var(--ds-flow-alpha-max))` 封顶
 *     （令牌因此是可生效的上限，见 theme.jcpress.css）；线宽同理在 0.5 → 1.55px 之间铺满。
 *     注意 `pathLength`、`stroke-dasharray` 与动画都只碰 dash，**不碰 transform**，
 *     因此与入场序列、视差互不干扰。
 *  4. **按视口分档路径数**：72 条 SVG 线每帧重绘 stroke，低端机上会掉帧发热。
 *     桌面 36×2 / 平板 24×2 / 手机 12×2（分档值即断言口径）。
 *  5. **`preserveAspectRatio="none"`（拉伸满幅）**：按比例缩放会在宽屏留上下空带、
 *     在手机竖屏把整族曲线压成中间一条细带；`slice` 会裁掉大半（实测覆盖 16%）。
 *     抽象曲线的形变看不出来，拉伸是唯一能在任何视口铺满的取法。
 *
 * 三条既有纪律（与 RingField 一致）：
 *  · `aria-hidden` + `pointer-events: none`：纯装饰，不进无障碍树、不吃点击；
 *  · `z-index: -1`：落在正文之下、body 画布之上；
 *  · **不挂 `data-reveal`**：它是常驻布景，不参与入场编排 ——
 *    一旦参与，`[data-reveal].is-revealed { opacity: 1 }` 会覆盖它自身的透明度
 *    （这是 RingField 踩过的坑，见 docs/decisions.md #28）。
 */

/** 视口分档。顺序即优先级：先匹配到的档生效。
 *
 * 2026-09-30（r2）：路径数整体减半（48/32/16），并给每档一个**线宽**（px）。
 * 用户实测反馈白天形态「眼花」—— 数量与剂量是两个独立旋钮，这一轮两个都收紧。 */
const TIERS = [
  { query: '(min-width: 960px)', count: 24, width: 0.9 },
  { query: '(min-width: 720px)', count: 16, width: 0.85 },
  { query: '(max-width: 719px)', count: 8, width: 0.8 },
] as const

/** 描边浓度的目标上限。必须与 `--ds-flow-alpha-max`（theme.jcpress.css）保持一致；
 *  CSS 侧用 `min()` 真正封顶，所以这个常量只是「目标值」，不是不可绕过的硬编码。 */
const MAX_ALPHA = 0.28

/**
 * 参考组件的三次贝塞尔路径，逐项照搬它的符号（**前两个 x 带前导负号，第三个 x 没有**）。
 *
 * 2026-09-29 修正记录：第一版我把第三个 x 也写成了负数（`-(152 - i*5*position)`），
 * 后果有两个 —— ① 高索引时拼出 `--3` 这种非法数字，浏览器报
 * `<path> attribute d: Expected number` 并丢掉那条路径；② 整族曲线的落点偏到视口左下角，
 * 72 条里只有约 7% 的采样点落在视口内，背景看上去几乎空的。
 * **错误在移植，不在参考**（参考的模板在 i ≤ 35 时完全合法）——
 * 这一条已记入 docs/dev-journal.md 阶段 20 的返工事件。
 *
 * 写法上仍然「先算数、再拼串」：这样即使某个常量变号也不会拼出 `--`。
 */
function buildPath(i: number, position: number): string {
  const nx = (step: number) => -(step - i * 5 * position) // 前两个 x：带前导负号
  const px = (step: number) => step - i * 5 * position // 第三个 x 与右侧两个 x：正号
  const ny = -(189 + i * 6) // 前两个 y：带前导负号
  const py = (step: number) => step - i * 6 // 其余 y：正号
  return (
    `M${nx(380)} ${ny}` +
    `C${nx(380)} ${ny} ${nx(312)} ${py(216)} ${px(152)} ${py(343)}` +
    `C${px(616)} ${py(470)} ${px(684)} ${py(875)} ${px(684)} ${py(875)}`
  )
}

function pickTier() {
  if (typeof window === 'undefined' || !window.matchMedia) return TIERS[0]
  return TIERS.find((tier) => window.matchMedia(tier.query).matches) ?? TIERS[TIERS.length - 1]
}

export default function FlowField() {
  const [tier, setTier] = useState(pickTier)

  useEffect(() => {
    const lists = TIERS.map((t) => window.matchMedia(t.query))
    const sync = () => setTier(pickTier())
    lists.forEach((list) => list.addEventListener('change', sync))
    sync()
    return () => lists.forEach((list) => list.removeEventListener('change', sync))
  }, [])

  const count = tier.count

  return (
    <div className={styles.field} data-flow="" data-parallax="" aria-hidden="true">
      {/* preserveAspectRatio="none"：这是**布景**，不是一张要保真的图 ——
          按比例缩放（meet）会在宽屏留下上下空带、在高窄屏（手机竖屏）把整族曲线压成中间一条细带；
          `slice` 则会把曲线裁掉一大半。拉伸让图案在**任何**视口都满幅铺开，
          对抽象曲线来说这点形变看不出来。实测覆盖：meet 26% / slice 16% / 拉伸后满幅。 */}
      <svg className={styles.svg} viewBox="0 0 696 316" fill="none" preserveAspectRatio="none">
        {[1, -1].map((position) =>
          Array.from({ length: count }, (_, i) => {
            const t = count > 1 ? i / (count - 1) : 0
            return (
              <path
                key={`${position}-${i}`}
                className={styles.path}
                d={buildPath(i, position)}
                pathLength={1}
                stroke="currentColor"
                /* non-scaling-stroke：线宽以**设备像素**为单位，不受 preserveAspectRatio="none"
                   的拉伸影响。r2 之前线宽是 viewBox 单位，被 x1.84 / y2.02 的拉伸放大到 ≈2.9px，
                   白天看着像满屏灰带 —— 用户实测反馈的「眼花」一半来自这里。 */
                vectorEffect="non-scaling-stroke"
                strokeWidth={(tier.width + t * 0.4).toFixed(2)}
                style={
                  {
                    // 描边浓度的「目标值」按索引递增；**真正的上限由 CSS 的
                    // `stroke-opacity: min(var(--path-alpha), var(--ds-flow-alpha-max))` 封顶**，
                    // 所以改令牌是有效的（第一版把上限硬编码在 JS 里，令牌成了死令牌）。
                    '--path-alpha': (0.06 + t * (MAX_ALPHA - 0.06)).toFixed(3),
                    // 确定性的时长与**负延迟**：负延迟让每条线一开始就处在自己周期的中段，
                    // 避免加载瞬间全族同相（前几秒看起来是空的）。
                    // 只注入一条动画的时长/延迟 —— 每条路径**只有一条动画**（移动端实测的硬约束）。
                    animationDuration: `${20 + (i % 11)}s`,
                    animationDelay: `${(-1.7 * i).toFixed(1)}s`,
                  } as CSSProperties
                }
              />
            )
          }),
        )}
      </svg>
    </div>
  )
}
