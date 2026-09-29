import { Route, Routes } from 'react-router-dom'

import TopNav from '@/components/layout/TopNav'
import Footer from '@/components/layout/Footer'
import ScrollProgress from '@/components/layout/ScrollProgress'
import FlowField from '@/components/visual/FlowField'
import HomePage from '@/pages/home/HomePage'
import ChannelPlaceholder from '@/pages/ChannelPlaceholder'
import TechListPage from '@/pages/tech/TechListPage'

export default function App() {
  return (
    <>
      {/* 滚动进度指示（二期）：全站唯一的滚动监听在这里（useScrollProgress），
          它写出的 --scroll-p 同时驱动本进度条与流线布景层的视差。 */}
      <ScrollProgress />
      {/* 流线布景层（二期）：全站 fixed，落在正文之下、body 画布之上。
          它不参与路由，因此切页时不会重挂载、动画相位不重置 —— 观感上「背景一直在流动」。
          首屏不再是单独一层：流线在首屏最显眼，向下滚动时作为背景延续。 */}
      <FlowField />
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
