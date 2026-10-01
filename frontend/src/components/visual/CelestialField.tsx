import { useActiveScene } from '@/hooks/useActiveScene'
import styles from './CelestialField.module.css'

/**
 * 首屏天体（二期 r3）：**亮色是地球，暗色是月球** —— 两颗不同的天体。
 *
 * ## 为什么是贴图球，而不是描边球
 *
 * 第一版我把它做成了「只用描边的抽象球」（经纬网 / 环形山），理由是图案纪律与对比度。
 * 用户看到成品后的反馈是「怎么没有我给你发的地球的那种效果」—— 他要的就是参照组件里
 * 那颗**写实的地球**。于是这一版改用参照组件的原始手法：**一张等距圆柱贴图 + 圆形裁剪窗口
 * + 水平循环平移**（等距圆柱贴图左右边界首尾相接，所以平移看起来就是自转）。
 *
 * 两处与参照组件的**刻意偏离**：
 *  1. **贴图自托管**，不用 `cdn.21st.dev` 的远程地址 —— 远程热点会在离线 / 内网环境下退化成空白，
 *     也会让「哪些资源是自己的一部分」失控。地球贴图是 NASA Blue Marble 的等距圆柱版
 *     （公有领域）：`frontend/public/textures/earth-blue-marble.jpg`；
 *     月球贴图由 `frontend/scripts/gen-moon-texture.cjs` 程序化生成（确定性种子，可复现）。
 *  2. **球体明暗不用参照那串写死的 `box-shadow`**（它的偏移是 150px / 250px 这类只对 250px 球
 *     成立的绝对值），改成随尺寸缩放的径向渐变 —— 球在任何尺寸下都是同一套光。
 *
 * ## 三条既有纪律
 *  · `aria-hidden` + `pointer-events: none`：纯装饰，不进无障碍树、不吃点击；
 *  · `z-index: -1` 且父容器 `isolation: isolate`：落在正文之下、全局流线层之上；
 *  · **每颗球只有一条动画**（`.strip` 上的 `transform: translateX`），这是二期实测出来的硬约束
 *    （每条线两条动画 → 21 FPS / 掉帧 97%，见 docs/decisions.md #51）；
 *    而且这里动 transform 走合成器，比参照组件的 `background-position`（每帧重绘）更省。
 */

interface BodyProps {
  /** 等距圆柱贴图（必须自托管、同源） */
  src: string
}

/**
 * 星点。位置与闪烁时长照搬参照组件，但**位置必须挪**。
 *
 * 参照组件把 7 颗星写在 `overflow: hidden` 的圆里，而它们的坐标是
 * `left: 350px` / `top: 290px` / `left: -40px` 这类**落在 250px 盒子之外**的值 ——
 * 实测（`elementFromPoint` 逐个判定）**0/7 可见**，全是死代码。
 * 所以这里按它的意图把星移到「球体之外、但仍在这个方盒之内」的角落：
 * 圆内切于方盒，四角与边中就是「视觉上在球外、布局上不越界」的地方，也不会把文档撑宽。
 *
 * 时长沿用原版的四档（1.5 / 2 / 3 / 4s）；相位用**确定性负延迟**错开，
 * 避免加载瞬间七颗星同相（这是 FlowField 移植时定下的纪律，见 docs/decisions.md #49）。
 */
const STARS = [
  { x: 4, y: 8, dur: 3 },
  { x: 16, y: 93, dur: 2 },
  { x: 95, y: 14, dur: 4 },
  { x: 87, y: 89, dur: 1.5 },
  { x: 28, y: 3, dur: 3 },
  { x: 3, y: 28, dur: 2 },
  { x: 97, y: 26, dur: 4 },
]

/** 一颗球：圆形裁剪窗口 + 两张首尾相接的贴图 + 球体明暗 */
function Body({ src }: BodyProps) {
  return (
    <>
      <div className={styles.sphere}>
      {/* 两张同样的贴图并排：平移到 -50%（正好一张的宽度）就无缝接回起点 */}
      <div className={styles.strip}>
        <img className={styles.texture} src={src} alt="" decoding="async" />
        <img className={styles.texture} src={src} alt="" aria-hidden="true" decoding="async" />
      </div>
      {/* 球体明暗：照抄参照组件那串 box-shadow（5 条 inset）。
          单独一层是必须的 —— box-shadow 的 inset 部分画在**内容之下**，
          挂在 .sphere 上会被贴图整块盖住（参照组件能用是因为它用的是 background-image）。 */}
      <span className={styles.shade} aria-hidden="true" />
      </div>

      {/* 星点必须是 .sphere 的**兄弟**，不能是子元素 ——
          .sphere 上有 overflow: hidden 的圆形裁剪，星落在内切圆之外的角落，
          放进去就会被 border-radius 裁掉（参照组件正是这么让 7 颗星全部落空的）。
          第一版我把它写在 .sphere 里面，实测 7 颗全部不可见。 */}
      <span className={styles.stars} aria-hidden="true">
        {STARS.map((star, i) => (
          <i
            key={`${star.x}-${star.y}`}
            className={styles.star}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              animationDuration: `${star.dur}s`,
              animationDelay: `${(-star.dur * (i / STARS.length)).toFixed(2)}s`,
            }}
          />
        ))}
      </span>
    </>
  )
}

export default function CelestialField() {
  // 分节停靠：滚动时球滑到当前区块对应的位置与大小（见 hooks/useActiveScene.ts）
  const scene = useActiveScene()

  return (
    <div
      className={styles.field}
      data-celestial=""
      data-parallax=""
      data-scene={scene}
      aria-hidden="true"
    >
      {/* 亮色：地球 */}
      <div className={styles.earth}>
        <Body src="/textures/earth-blue-marble.jpg" />
      </div>
      {/* 暗色：月球 */}
      <div className={styles.moon}>
        <Body src="/textures/moon-surface.jpg" />
      </div>
    </div>
  )
}
