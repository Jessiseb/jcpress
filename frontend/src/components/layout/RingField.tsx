import type { CSSProperties } from 'react'

import styles from './RingField.module.css'

interface Props {
  /** 环的直径（px）。参照站首屏光场约 1000，页脚约 820 */
  size?: number
  /** 整个装置的不透明度（聚光与环一起缩放） */
  opacity?: number
}

/**
 * 环装置：同心圆环 + 中心聚光 + 遮罩渐隐。
 *
 * 配方取自参照站 `.hero-field`（实测见 docs/style-ref-aura.md §3），**丢掉第三层 135° 面差渐变** ——
 * 那一层在参照站是元素自身的底，在这里会变成一块不透明背景，把正文与 body 氛围层全遮住。
 *
 * 三条纪律：
 *  1. 纯装饰：`aria-hidden` + `pointer-events: none`，不进无障碍树、不吃点击；
 *  2. 本组件**不写 transform**：入场序列的 `[data-reveal]` 会写 transform，
 *     两者会互相抵消，所以居中用 margin 而不是 translateX(-50%)；
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
