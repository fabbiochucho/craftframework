import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { EsgAudiencePage } from '../pages/AudiencePages'

const TITLE = 'CRAFT for ESG Reporting in Africa | CRAFT — DiBadili Institute'
const DESCRIPTION = 'IFRS S1/S2 readiness for all 54 African countries: rule packs, implementation planner and ESG report quality checklist.'

export const Route = createFileRoute('/for/esg-reporting')({
  head: () => ({ meta: [{ title: TITLE }, { name: 'description', content: DESCRIPTION }, { property: 'og:title', content: TITLE }, { property: 'og:description', content: DESCRIPTION }] }),
  component: () => (
    <PublicLayout>
      <EsgAudiencePage />
    </PublicLayout>
  ),
})
