import { useProfile } from '@/hooks/useProfile'
import { useReveal } from '@/hooks/useReveal'
import Hero from '@/components/home/Hero'
import HighlightStats from '@/components/home/HighlightStats'
import SkillMatrix from '@/components/home/SkillMatrix'
import ExperienceTimeline from '@/components/home/ExperienceTimeline'
import ProjectShowcase from '@/components/home/ProjectShowcase'
import EducationAwards from '@/components/home/EducationAwards'
import ContactBar from '@/components/home/ContactBar'

export default function HomePage() {
  const { profile, highlights, skillGroups, experiences, projects, education, awards, contacts } = useProfile()

  // 入场序列的根节点：区块内所有带 data-reveal 的元素由它统一编排错峰浮现
  const revealRef = useReveal<HTMLDivElement>()

  return (
    <div ref={revealRef}>
      <Hero profile={profile} />
      {/* r2：顺序改为「经历优先」—— 访客 30 秒内要先看到「做过什么」，
          能力清单（技术栈）是佐证、不是开场。六个区块的 data-rhythm 随之重排，
          仍是 M/m 交替（大节 96 / 小节 48），面板仍只在「关键数字」与「项目经历」。 */}
      <HighlightStats metrics={highlights} />
      <ExperienceTimeline experiences={experiences} />
      <ProjectShowcase projects={projects} />
      <SkillMatrix groups={skillGroups} />
      <EducationAwards education={education} awards={awards} />
      <ContactBar contacts={contacts} />
    </div>
  )
}
