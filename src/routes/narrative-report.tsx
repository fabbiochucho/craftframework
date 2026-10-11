import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { NarrativeReportPage } from '../pages/NarrativeReportPage'

export const Route = createFileRoute('/narrative-report')({
  component: () => (
    <AppLayout>
      <NarrativeReportPage />
    </AppLayout>
  ),
})
