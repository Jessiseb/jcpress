import styles from './liteSkeleton.module.css'

/**
 * 公开站的骨架（零依赖版本）。
 *
 * 为什么后台用 antd 的 `Skeleton`、前台用这一份：
 * 前台的技术分享列表页**不是懒加载路由**（它在首屏包里），一旦它 import 了 antd，
 * cssinjs + ConfigProvider + locale 就会全量拖进首屏 —— 实测首屏 gzip 从 122KB 涨到
 * **272KB**，直接顶破二期定下的 200KB 预算。而前台需要的只有「一块会扫光的灰条」，
 * 这一份不到 2KB，还能自动跟随 `--ds-c-*` 的明暗。
 *
 * 也就是说：**组件库的收益在后台（表格、表单、分页、弹窗这些真组件），
 * 不在一条灰条上。** 后台的骨架见 `./Skeleton.tsx`（antd 包装）。
 *
 * 两条尺寸纪律与后台一致：高度贴着真实行高；`prefers-reduced-motion` 下降级为静态灰块。
 */

type Size = number | string

export interface LiteSkeletonProps {
  width?: Size
  height?: Size
  radius?: Size
  circle?: boolean
  className?: string
}

const toCss = (value: Size | undefined): string | undefined =>
  typeof value === 'number' ? `${value}px` : value

/** 稳定的标记类：测试与浏览器探针认这个，不认 CSS Modules 生成的哈希类名 */
const MARKER = 'jc-lite-skeleton'

export function LiteSkeleton({ width, height, radius, circle, className }: LiteSkeletonProps) {
  const classes = [styles.skeleton, MARKER, className].filter(Boolean).join(' ')
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

export function LiteSkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 10,
  lastWidth = '62%',
}: {
  lines?: number
  lineHeight?: number
  gap?: number
  lastWidth?: Size
}) {
  return (
    <div className={styles.text} style={{ gap }}>
      {Array.from({ length: lines }, (_, index) => (
        <LiteSkeleton
          key={index}
          height={lineHeight}
          radius={4}
          width={index === lines - 1 ? lastWidth : '100%'}
        />
      ))}
    </div>
  )
}

export function LiteSkeletonRegion({
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
