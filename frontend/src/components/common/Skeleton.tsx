import styles from './skeleton.module.css'

/**
 * 骨架屏基础件（第四期优化）。
 *
 * 为什么自己写而不引 `react-loading-skeleton` / `antd Skeleton`：
 * ① 这里只需要「一块跟随主题的灰底 + 扫光」，库的体积与主题系统都是负担；
 * ② 站内有两套主题变量（前台 `--ds-c-*`、后台 `--adm-*`），第三方库默认色是写死的灰，
 *    要接两套变量反而比自己写多一层覆盖。
 * 所以底色统一取 `currentColor`：谁包着它，它就跟谁的文字色走明暗。
 *
 * 用法约定：**骨架的尺寸要贴着真实内容的尺寸**（高度、行数、圆角），
 * 否则数据回来时会「跳一下」，那比纯文字还难看。
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

export function Skeleton({ width, height, radius, circle, className }: SkeletonProps) {
  const classes = className === undefined ? styles.skeleton : `${styles.skeleton} ${className}`
  return (
    <div
      className={classes}
      aria-hidden="true"
      style={{
        width: toCss(width),
        height: toCss(height),
        borderRadius: circle === true ? '50%' : toCss(radius),
      }}
    />
  )
}

export interface SkeletonTextProps {
  /** 行数 */
  lines?: number
  /** 行高（也就是整行占位高度） */
  lineHeight?: number
  /** 行间距 */
  gap?: number
  /** 最后一行的宽度：正文末行通常不满，等宽会显得像表格 */
  lastWidth?: Size
}

export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 10,
  lastWidth = '62%',
}: SkeletonTextProps) {
  return (
    <div className={styles.text} style={{ gap }}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          radius={4}
          width={index === lines - 1 ? lastWidth : '100%'}
        />
      ))}
    </div>
  )
}

/**
 * 给骨架区块套一层「读屏友好」的外壳：视觉上是灰块，屏幕阅读器听到的是
 * 「正在加载」而不是一片空 div。
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
