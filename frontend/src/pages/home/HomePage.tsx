import { useProfile } from '@/hooks/useProfile'
import Hero from '@/components/home/Hero'
import HighlightStats from '@/components/home/HighlightStats'
import SkillMatrix from '@/components/home/SkillMatrix'
import ExperienceTimeline from '@/components/home/ExperienceTimeline'
import ProjectShowcase from '@/components/home/ProjectShowcase'
import EducationAwards from '@/components/home/EducationAwards'
import ContactBar from '@/components/home/ContactBar'

export default function HomePage() {
  const { profile, highlights, skillGroups, experiences, projects, education, awards, contacts } = useProfile()

  return (
    <>
      <Hero profile={profile} />
      <HighlightStats metrics={highlights} />
      <SkillMatrix groups={skillGroups} />
      <ExperienceTimeline experiences={experiences} />
      <ProjectShowcase projects={projects} />
      <EducationAwards education={education} awards={awards} />
      <ContactBar contacts={contacts} />
    </>
  )
}
