import { Skeleton as AntSkeleton } from 'antd'

import styles from './skeleton.module.css'

/**
 * 加载骨架的**薄适配层**（第四期起改用 Ant Design，不再自己画灰块）。
 *
 * 为什么还要一层包装，而不是各处直接写 `<Skeleton active />`：
 * ① 站内 8 处调用点对「一条指定宽高的占位条」的需求是统一的，直接散写会让
 *    `style={{ width, height, borderRadius }}` 复制 60 遍；
 * ② 尺寸必须跟着真实内容的行高走（见 dev-journal 70.3 的两次返工），
 *    统一入口才好一次性校准；
 * ③ 扫光动画、圆角、暗色渐变都交给 antd 的 token 体系，这里不再维护任何色值。
 */

type Size = number | string

export interface SkeletonProps {
  width?: Size
  height?: Size
  radius?: Size
  /** 圆形（头像位）—— 与 radius 二选一 */
  circle?: boolean
  className?: string
}

const toCss = (value: Size | undefined): string | undefined =>
  typeof value === 'number' ? `${value}px` : value

const toNumber = (value: Size | undefined, fallback: number): number =>
  typeof value === 'number' ? value : fallback

/**
 * 稳定标记类。antd 不转发 `data-*` 到它的骨架元素上（实测 count=0），
 * 而它的内部类名（`ant-skeleton-*`）会随大版本变 —— 所以用我们自己的类名当钩子，
 * 测试与浏览器探针都认这个，不认 antd 的内部实现。
 */
const MARKER = 'jc-skeleton'

const withMarker = (className?: string): string =>
  className === undefined ? MARKER : `${className} ${MARKER}`

export function Skeleton({ width, height, radius, circle, className }: SkeletonProps) {
  if (circle === true) {
    return (
      <AntSkeleton.Avatar
        active
        shape="circle"
        size={toNumber(height ?? width, 40)}
        className={withMarker(className)}
        style={{ flex: 'none' }}
      />
    )
  }

  return (
    <AntSkeleton.Button
      active
      block
      className={withMarker(className)}
      // antd 的 Button 骨架按 size 给高度；这里统一用 px 覆盖，让它跟着真实行高
      style={{
        width: toCss(width) ?? '100%',
        height: toCss(height) ?? '14px',
        minWidth: 0,
        borderRadius: toCss(radius),
        verticalAlign: 'middle',
      }}
    />
  )
}

export interface SkeletonTextProps {
  lines?: number
  /** 兼容旧调用签名：antd 的段落行高由字号推，这里不逐行指定 */
  lineHeight?: number
  gap?: number
  /** 最后一行的宽度 */
  lastWidth?: Size
}

export function SkeletonText({ lines = 3, lastWidth = '62%' }: SkeletonTextProps) {
  // 末行短一截：等宽会显得像表格而不是正文
  const widths: (number | string)[] = Array.from({ length: lines }, (_, index) =>
    index === lines - 1 ? lastWidth : '100%',
  )
  return (
    <AntSkeleton
      active
      title={false}
      paragraph={{ rows: lines, width: widths }}
      style={{ marginBottom: 0 }}
    />
  )
}

/**
 * 给骨架区块套一层「读屏友好」的外壳：视觉上是骨架，屏幕阅读器听到的是
 * 「正在加载」而不是一片空容器。这一层与组件库无关，所以保留在项目里。
 */
export function SkeletonRegion({
  label = '正在加载',
  children,
  className,
}: {
  label?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      {children}
    </div>
  )
}
