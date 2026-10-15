import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { NphiAudiencePage } from '../pages/AudiencePages'

const TITLE = 'CRAFT for National Public Health Institutes | CRAFT — DiBadili Institute'
const DESCRIPTION = 'NPHI development (Africa CDC), WHO JEE and SPAR self-assessment, after-action reviews and corrective actions in one evidence-based workspace.'

export const Route = createFileRoute('/for/public-health-institutes')({
  head: () => ({ meta: [{ title: TITLE }, { name: 'description', content: DESCRIPTION }, { property: 'og:title', content: TITLE }, { property: 'og:description', content: DESCRIPTION }] }),
  component: () => (
    <PublicLayout>
      <NphiAudiencePage />
    </PublicLayout>
  ),
})
