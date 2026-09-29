import { useScrollProgress } from '@/hooks/useScrollProgress'
import styles from './ScrollProgress.module.css'

/**
 * 顶部滚动进度指示（二期 phase-2-visual）。
 *
 * 它同时是**全站唯一调用 `useScrollProgress()` 的地方** —— 滚动监听与 rAF 都在这里，
 * 结果写进 `--scroll-p`，顶栏之外的装饰层（流线布景层的视差）只读这个变量。
 *
 * 三条纪律：
 *  · `aria-hidden` + `pointer-events: none`：它是纯指示物，不进无障碍树、不吃点击；
 *  · 用**实色**而不是渐变：渐变宿主白名单只有 6 类，为一条 2px 的条再开一个宿主不划算
 *    （`.tmp/tools/audit-behavior.cjs` 会把未登记的装饰性渐变亮红）；
 *  · 它不是获得任何信息的唯一途径（页面内容本身完整）。
 */
export default function ScrollProgress() {
  useScrollProgress()

  return (
    <div className={styles.track} data-progress="" aria-hidden="true">
      <div className={styles.bar} />
    </div>
  )
}
