import { Route, Routes } from 'react-router-dom'

import TopNav from '@/components/layout/TopNav'
import Footer from '@/components/layout/Footer'
import HomePage from '@/pages/home/HomePage'
import ChannelPlaceholder from '@/pages/ChannelPlaceholder'

export default function App() {
  return (
    <>
      <TopNav />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tech" element={<ChannelPlaceholder title="技术分享" />} />
          <Route path="/algo" element={<ChannelPlaceholder title="算法笔记" />} />
          <Route path="/projects" element={<ChannelPlaceholder title="项目笔记" />} />
          <Route path="*" element={<ChannelPlaceholder title="页面不存在" is404 />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
