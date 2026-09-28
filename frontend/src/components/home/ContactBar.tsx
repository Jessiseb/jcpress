import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { ContactVO } from '@/data/profile'
import styles from './ContactBar.module.css'

interface Props {
  contacts: ContactVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 60}ms` }) as CSSProperties

export default function ContactBar({ contacts }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = async (item: ContactVO) => {
    try {
      await navigator.clipboard.writeText(item.value)
      setCopied(item.label)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      /* 剪贴板不可用时静默失败：值本身已经明文展示在页面上 */
    }
  }

  return (
    <section className={`container section ${styles.section}`} aria-labelledby="contact-title">
      <h2 id="contact-title" className="sectionTitle" data-reveal>
        联系我
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        简历 PDF 可直接下载；微信号点一下就复制，不用手抄。
      </p>

      <dl className={styles.list}>
        {contacts.map((item, index) => (
          <div key={item.label} className={styles.row} data-reveal style={stagger(index + 2)}>
            <dt className={styles.label}>{item.label}</dt>

            <dd className={styles.valueCell}>
              {item.href ? (
                <a
                  className={styles.value}
                  href={item.href}
                  target={item.href.startsWith('http') ? '_blank' : undefined}
                  rel={item.href.startsWith('http') ? 'noreferrer noopener' : undefined}
                >
                  {item.value}
                </a>
              ) : item.copyable ? (
                <button
                  type="button"
                  className={`btn btnOutline btnSm btnStart ${styles.copyBtn}`}
                  onClick={() => handleCopy(item)}
                  aria-label={`复制${item.label}：${item.value}`}
                >
                  <span className={styles.value}>{item.value}</span>
                  <span className={styles.copyHint}>{copied === item.label ? '已复制' : '复制'}</span>
                </button>
              ) : (
                <span className={styles.value}>{item.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
