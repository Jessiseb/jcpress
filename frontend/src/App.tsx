import { Route, Routes, useLocation } from 'react-router-dom'

import TopNav from '@/components/layout/TopNav'
import Footer from '@/components/layout/Footer'
import ScrollProgress from '@/components/layout/ScrollProgress'
import FlowField from '@/components/visual/FlowField'
import CelestialField from '@/components/visual/CelestialField'
import HomePage from '@/pages/home/HomePage'
import ChannelPlaceholder from '@/pages/ChannelPlaceholder'
import TechListPage from '@/pages/tech/TechListPage'

export default function App() {
  // 天体只在首页挂载：它的「分节停靠」位置是按首页那 7 个区块配的，
  // 挂到 /tech 之类的页面上会变成一颗没有停靠点的球压在列表上。
  const onHome = useLocation().pathname === '/'

  return (
    <>
      {/* 滚动进度指示（二期）：全站唯一的滚动监听在这里（useScrollProgress），
          它写出的 --scroll-p 同时驱动本进度条与流线布景层的视差。 */}
      <ScrollProgress />
      {/* 流线布景层（二期）：全站 fixed，落在正文之下、body 画布之上。
          它不参与路由，因此切页时不会重挂载、动画相位不重置 —— 观感上「背景一直在流动」。
          首屏不再是单独一层：流线在首屏最显眼，向下滚动时作为背景延续。 */}
      <FlowField />
      {/* 首屏天体（二期 r3）：亮色是地球、暗色是月球。
          与流线层同层（全屏固定、z-index:-1），滚动时按当前区块滑到对应位置 ——
          停靠表在 CelestialField.module.css 的 [data-scene] 里。 */}
      {onHome && <CelestialField />}
      <TopNav />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tech" element={<TechListPage />} />
          <Route
            path="/algo"
            element={
              <ChannelPlaceholder
                title="算法笔记"
                lead="按专题整理的题解：思路、多解法、复杂度与易错点。"
                empty="内容整理中。首页「技术栈」里有数据结构与算法的档位可先参考。"
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ChannelPlaceholder
                title="项目笔记"
                lead="每个自研项目的背景、架构、取舍与复盘。"
                empty="内容整理中。首页「项目经历」已有两个项目的概要，展开就能看到亮点。"
              />
            }
          />
          <Route path="*" element={<ChannelPlaceholder title="页面不存在" is404 />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
