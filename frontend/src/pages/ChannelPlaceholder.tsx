import { Link } from 'react-router-dom'
import styles from './ChannelPlaceholder.module.css'

interface Props {
  title: string
  is404?: boolean
}

/** 其余频道的占位页：首页之外的路由先不白屏，等对应里程碑填充。 */
export default function ChannelPlaceholder({ title, is404 = false }: Props) {
  return (
    <section className={`container section ${styles.wrap}`}>
      <p className={styles.kicker}>{is404 ? '404' : '建设中'}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.desc}>
        {is404 ? '这个地址还没有内容。' : '这个频道正在做，先把「关于我」打磨到位。'}
      </p>
      <Link to="/" className={styles.back}>
        回到关于我
      </Link>
    </section>
  )
}
