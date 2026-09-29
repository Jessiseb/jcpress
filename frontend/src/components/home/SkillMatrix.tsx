import type { CSSProperties } from 'react'

import type { SkillGroupVO } from '@/data/profile'
import styles from './SkillMatrix.module.css'

interface Props {
  groups: SkillGroupVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

/** 熟练度用纯文字档位表达。点阵 / 百分比进度条是简历类 AI 生成页的标志性元素，这里换掉。 */
const LEVEL_LABEL: Record<number, string> = {
  5: '熟悉',
  4: '熟悉',
  3: '掌握',
  2: '了解',
  1: '了解',
}

export default function SkillMatrix({ groups }: Props) {
  return (
    <section
      className="container section"
      aria-labelledby="skills-title"
      data-rhythm="minor"
    >
      <h2 id="skills-title" className="sectionTitle" data-reveal>
        技术栈
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        按领域分组，档位取自简历原文的三档标注：熟悉 / 掌握 / 了解。
      </p>

      <div className={styles.grid}>
        {groups.map((group, index) => (
          <div key={group.category} className={styles.group} data-reveal style={stagger(index + 2)}>
            {/* data-display：组名是这一条能力带的版式锚点，用展示衬线 700。
                标上它，字符表收集（scripts/collect-display-charset.cjs）才会把组名纳入 700 子集；
                否则这些字会回落到 500 档 —— 同一行混两档字重，正是 audit-display-font.cjs 守的东西。 */}
            <h3 className={styles.groupTitle} data-display="">
              {group.category}
            </h3>
            <ul className={styles.items}>
              {group.items.map((item) => (
                <li key={item.name} className={styles.item}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.level}>{LEVEL_LABEL[item.level] ?? '了解'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
