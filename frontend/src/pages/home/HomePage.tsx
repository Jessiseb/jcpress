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
      <HighlightStats metrics={highlights} />
      <SkillMatrix groups={skillGroups} />
      <ExperienceTimeline experiences={experiences} />
      <ProjectShowcase projects={projects} />
      <EducationAwards education={education} awards={awards} />
      <ContactBar contacts={contacts} />
    </div>
  )
}
