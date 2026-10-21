import { useState } from 'react'

import type { AiFormatVO } from '@/api/types'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import { findExpansion, findRegressions, markdownStats, STAT_ITEMS } from '@/utils/markdownStats'
import styles from './AiFormatPanel.module.css'

/** 应用时回给编辑页的东西：正文必有，元信息按勾选带 */
export interface AiApplyPayload {
  contentMd: string
  summary?: string
  tags?: string[]
  slug?: string
}

interface Props {
  /** 编辑器里当前的正文（对比的左栏） */
  original: string
  result: AiFormatVO
  /** 表单里当前已填的元信息，用来决定默认勾选与"会不会覆盖"的提示 */
  current: { summary: string; tags: string; slug: string }
  onApply: (payload: AiApplyPayload) => void
  onDiscard: () => void
}

/**
 * AI 排版的**对比面板**：左右渲染预览 + 结构计数 + 元信息勾选。
 *
 * 两条刻意的设计：
 * 1. **不逐行 diff**。排版任务会改动绝大多数行（空格、编号、空行），红绿 diff 只会
 *    满屏变色，看不出真正的问题。这里改成数"结构件"，掉了哪个才标红 —— 见 markdownStats。
 * 2. **元信息默认不覆盖**。摘要/标签/slug 只在表单里为空时才默认勾选；已有内容还勾上
 *    会显式提示"将覆盖"，避免一次误点把人工写的摘要冲掉。
 */
export default function AiFormatPanel({ original, result, current, onApply, onDiscard }: Props) {
  const [useSummary, setUseSummary] = useState(
    current.summary.trim() === '' && !!result.summary?.trim(),
  )
  const [useTags, setUseTags] = useState(current.tags.trim() === '' && result.tags.length > 0)
  const [useSlug, setUseSlug] = useState(current.slug.trim() === '' && !!result.slug)

  const before = markdownStats(original)
  const after = markdownStats(result.contentMd)
  const regressions = findRegressions(before, after)
  const expansion = findExpansion(before, after)
  const lostLabels = new Set(regressions.map((item) => item.label))

  const apply = () => {
    const payload: AiApplyPayload = { contentMd: result.contentMd }
    if (useSummary && result.summary) payload.summary = result.summary
    if (useTags && result.tags.length > 0) payload.tags = result.tags
    if (useSlug && result.slug) payload.slug = result.slug
    onApply(payload)
  }

  return (
    <section className={styles.panel} aria-label="AI 排版对比">
      <div className={styles.head}>
        <span className={styles.badge}>AI 排版结果</span>
        <span className={styles.headHint}>确认后才会写回编辑器，现在什么都没改</span>
        <button className={styles.close} type="button" onClick={onDiscard} aria-label="关闭对比">
          ×
        </button>
      </div>

      <div className={styles.stats}>
        {STAT_ITEMS.map((item) => {
          const from = before[item.key]
          const to = after[item.key]
          const lost = lostLabels.has(item.label)
          const changed = from !== to
          return (
            <div className={styles.statCell} key={item.key}>
              <div className={styles.statLabel}>
                {item.label}
                {lost && <span className={styles.statWarn}>减少</span>}
              </div>
              <div className={`${styles.statValue} ${changed ? styles.statChanged : ''}`}>
                <span className={styles.statFrom}>{from}</span>
                <span className={styles.statArrow}>→</span>
                <span className={lost ? styles.statLost : styles.statTo}>{to}</span>
              </div>
            </div>
          )
        })}
      </div>

      {regressions.length > 0 && (
        <p className={styles.regression}>
          注意：{regressions.map((item) => item.label).join('、')}的数量比原文少 ——
          排版不该改动这些，请仔细核对右栏再决定是否应用。
        </p>
      )}

      {expansion !== null && (
        <p className={styles.regression}>
          注意：AI 输出比原文长了 {expansion}% —— 排版只会补空格、补表格分隔行，正常增幅在 10%
          以内。请核对右栏是不是被加上了原文没有的内容，再决定是否应用。
        </p>
      )}

      <div className={styles.compare}>
        <div className={styles.col}>
          <div className={styles.colHead}>当前正文</div>
          <div className={styles.colBody}>
            <MarkdownBody markdown={original} />
          </div>
        </div>
        <div className={styles.col}>
          <div className={styles.colHead}>AI 整理后</div>
          <div className={styles.colBody}>
            <MarkdownBody markdown={result.contentMd} />
          </div>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <label className={styles.metaCheck}>
            <input
              type="checkbox"
              checked={useSummary}
              disabled={!result.summary?.trim()}
              onChange={(event) => setUseSummary(event.target.checked)}
            />
            <span className={styles.metaLabel}>摘要</span>
          </label>
          <div className={styles.metaValue}>
            {result.summary?.trim() ? (
              <>
                {result.summary}
                {useSummary && current.summary.trim() !== '' && (
                  <span className={styles.overwrite}>将覆盖已填内容</span>
                )}
              </>
            ) : (
              <span className={styles.metaEmpty}>AI 未给出</span>
            )}
          </div>
        </div>

        <div className={styles.metaRow}>
          <label className={styles.metaCheck}>
            <input
              type="checkbox"
              checked={useTags}
              disabled={result.tags.length === 0}
              onChange={(event) => setUseTags(event.target.checked)}
            />
            <span className={styles.metaLabel}>标签</span>
          </label>
          <div className={styles.metaValue}>
            {result.tags.length > 0 ? (
              <>
                {result.tags.join('、')}
                {useTags && current.tags.trim() !== '' && (
                  <span className={styles.overwrite}>将覆盖已填内容</span>
                )}
              </>
            ) : (
              <span className={styles.metaEmpty}>AI 未给出</span>
            )}
          </div>
        </div>

        <div className={styles.metaRow}>
          <label className={styles.metaCheck}>
            <input
              type="checkbox"
              checked={useSlug}
              disabled={!result.slug}
              onChange={(event) => setUseSlug(event.target.checked)}
            />
            <span className={styles.metaLabel}>slug</span>
          </label>
          <div className={styles.metaValue}>
            {result.slug ? (
              <>
                {result.slug}
                {useSlug && current.slug.trim() !== '' && (
                  <span className={styles.overwrite}>将覆盖已填内容</span>
                )}
              </>
            ) : (
              <span className={styles.metaEmpty}>AI 未能给出合规短名，请手填</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.apply} type="button" onClick={apply}>
          应用到编辑器
        </button>
        <button className={styles.discard} type="button" onClick={onDiscard}>
          放弃
        </button>
        <span className={styles.footerHint}>应用后仍可继续手改，或撤销重来</span>
      </div>
    </section>
  )
}
