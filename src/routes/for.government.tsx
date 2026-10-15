import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { GovernmentAudiencePage } from '../pages/AudiencePages'

const TITLE = 'CRAFT for Government and Public Bodies | CRAFT — DiBadili Institute'
const DESCRIPTION = 'Assess ministries, agencies and subnational governments against APRM, PEFA, OECD-DAC, performance contracts and SDG/Agenda 2063 alignment.'

export const Route = createFileRoute('/for/government')({
  head: () => ({ meta: [{ title: TITLE }, { name: 'description', content: DESCRIPTION }, { property: 'og:title', content: TITLE }, { property: 'og:description', content: DESCRIPTION }] }),
  component: () => (
    <PublicLayout>
      <GovernmentAudiencePage />
    </PublicLayout>
  ),
})
