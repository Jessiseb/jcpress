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

  // 主入口 = 那条**能一键联系**的（`tel:` 直接拨号 / `mailto:` 直接发信），其余降为次级条目。
  // 原来是写死 mailto 的；改成手机号之后写死会让主入口凭空消失，整节退回成一张平铺列表。
  const primary = contacts.find((item) => /^(mailto|tel):/.test(item.href ?? ''))
  const primaryHref = primary?.href ?? undefined
  const rest = contacts.filter((item) => item !== primary)

  return (
    <section
      className="container section"
      aria-labelledby="contact-title"
      data-rhythm="major"
    >
      <h2 id="contact-title" className="sectionTitle" data-reveal>
        联系我
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        欢迎通过下面的方式联系我。
      </p>

      {/* r3：号码占左半边（原本空着的地方），入口在右半边堆成一列。
          两栏之间没有任何线 —— 靠空隙分开。上方的 h2 / 导语仍在左栏，
          这一块照旧落在正文栏（12 栏栅格的第 4 栏起）。 */}
      <div className={styles.split} data-reveal style={stagger(2)}>
        {primary && primaryHref && (
          <a className={styles.primary} href={primaryHref}>
            {primary.value}
          </a>
        )}

        <dl className={styles.list}>
          {rest.map((item) => (
            <div key={item.label} className={styles.line}>
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
                    <span className={styles.copyHint}>
                      {copied === item.label ? '已复制' : '复制'}
                    </span>
                  </button>
                ) : (
                  <span className={styles.value}>{item.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
