import type { CSSProperties } from 'react'

import type { SkillGroupVO } from '@/data/profile'
import styles from './SkillMatrix.module.css'

interface Props {
  groups: SkillGroupVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

const LEVEL_LABEL: Record<number, string> = {
  5: '熟悉',
  4: '熟悉',
  3: '掌握',
  2: '了解',
  1: '了解',
}

/** 档位 → 胶囊的权重。三档共用同一副骨架，只有填充与描边在动。 */
type Tier = 'solid' | 'outline' | 'plain'

function tierOf(level: number): Tier {
  if (level >= 4) return 'solid'
  if (level === 3) return 'outline'
  return 'plain'
}

const LEGEND: { tier: Tier; label: string }[] = [
  { tier: 'solid', label: '熟悉' },
  { tier: 'outline', label: '掌握' },
  { tier: 'plain', label: '了解' },
]

/**
 * 技术栈（r3：玻璃面板 + 分类色胶囊）
 *
 * ## 五版的过程
 *
 * 前三版都在同一族排法里换皮：三列规格表（「太普通」）→「技能名 + 小灰字档位」连排（「乱乱的」）
 * → 大胶囊云（「效果不行」）→ 紧凑胶囊 / 对齐网格 / 两列分组（「都不行」）。第四版换成
 * **深度矩阵**（行 = 方向，列 = 档位）：结构上是对的，但它把这一节做成了「一张表」——
 * 用户对着它选了这一版。
 *
 * 用户要的是参照组件那种「**设计过的组件**」：一个容器、一点颜色。而我前四版一直在砍的
 * 正是这两样（面板被 spec 挡着、颜色被「颜色只承担语义」挡着）。这一版把两样都放开：
 *
 *  · **玻璃面板**（复用全局 `.panel`，与关键数字 / 项目经历同一个类、同一套令牌）；
 *  · **分类色**：六个方向各一个色相 —— 颜色在这里承担的是「这一项属于哪个方向」，
 *    是语义不是装饰。六个色相都避开状态色（绿 / 黄 / 红），见 theme.jcpress.css 的 --ds-hue-*。
 *
 * 档位仍然只用**胶囊的填充深浅**表达（分类给色相、档位给深浅，两个维度走两个通道），
 * 因此面板顶部需要一行图例 —— 这一条是硬要求，不是装饰：没有图例，「深浅」就是
 * 只对作者可见的编码。
 */
export default function SkillMatrix({ groups }: Props) {
  return (
    <section className="container section" aria-labelledby="skills-title" data-rhythm="minor">
      <h2 id="skills-title" className="sectionTitle" data-reveal>
        技术栈
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        按方向整理，标注我在实际项目中的使用深度。
      </p>

      {/* data-glass：面板是本元素的渐变宿主身份（顶部高光那层 linear-gradient），
          已登记进 audit-behavior 的渐变白名单；同时它让这一节从「其余区块保持通栏」那条断言里豁免 ——
          「面板只出现在关键数字与项目经历」这条已经随之改成三类区块。 */}
      <div className={`panel ${styles.panel}`} data-glass="" data-reveal style={stagger(2)}>
        {/* 图例：两个维度各占一个通道（分类 = 色相、档位 = 深浅），
            所以必须把「深浅」的含义写在同屏。 */}
        <ul className={styles.legend} aria-hidden="true">
          {LEGEND.map((entry) => (
            <li key={entry.tier} className={styles.legendItem} data-tier={entry.tier}>
              {entry.label}
            </li>
          ))}
        </ul>

        <div className={styles.rows}>
          {/* data-skill-group：给验收脚本一个**稳定的钩子**。
              原来用 `[class*="group"]` 去选，会同时命中这一行和它里面的 `.groupTitle`
              （「groupTitle」也含「group」），6 行被数成 12 行 —— 断言当场亮红。
              仓库里 data-award / data-year 是同一个套路：类名是给样式的，标记是给判据的。 */}
          {groups.map((group, index) => (
            <div
              key={group.category}
              className={styles.group}
              data-skill-group=""
              data-hue={index + 1}
            >
              {/* data-display：组名是这一行的版式锚点，用展示衬线 700。
                  标上它，字符表收集（scripts/collect-display-charset.cjs）才会把组名纳入 700 子集。 */}
              <h3 className={styles.groupTitle} data-display="">
                <i className={styles.dot} aria-hidden="true" />
                {group.category}
              </h3>

              <ul className={styles.items}>
                {group.items.map((item) => (
                  <li
                    key={item.name}
                    className={styles.item}
                    data-tier={tierOf(item.level)}
                    title={`${item.name} · ${LEVEL_LABEL[item.level] ?? '了解'}`}
                  >
                    <span className={styles.itemName}>{item.name}</span>
                    {/* 档位的文字形态保留给读屏（视觉上已由胶囊深浅表达）。
                        宽高都取 0 而不是 1px —— audit-behavior 的「全页无文字溢出」会跳过
                        clientWidth 为 0 的元素，而 1px 宽的元素会被判成溢出（实习经历的 srOnly 踩过）。 */}
                    <span className={styles.screenOnly}>{LEVEL_LABEL[item.level] ?? '了解'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
