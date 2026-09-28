import { Link } from 'react-router-dom'
import styles from './ChannelPlaceholder.module.css'

interface Props {
  title: string
  /** 这个频道写什么（≤40 字）。404 页不传 */
  lead?: string
  /** 空态说明：内容还没到，那现在能做什么 */
  empty?: string
  is404?: boolean
}

/**
 * 频道占位页外壳。
 *
 * 三个频道共用同一套语言：环 badge + 频道名 + 一句定位 + 空态说明 + 回首页。
 * 空态按 frontend-design 的写法给方向（「现在能做什么」），不写「敬请期待」这类没有信息量的句子。
 */
export default function ChannelPlaceholder({ title, lead, empty, is404 = false }: Props) {
  return (
    <section className={`container section ${styles.wrap}`}>
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 className={styles.title}>{title}</h1>

      <p className={styles.lead}>
        {is404 ? '这个地址没有内容 —— 链接可能写错了，或者内容还没搬过来。' : lead}
      </p>

      {!is404 && empty ? <p className={styles.empty}>{empty}</p> : null}

      <Link to="/" className={styles.back}>
        回到首页
      </Link>
    </section>
  )
}
