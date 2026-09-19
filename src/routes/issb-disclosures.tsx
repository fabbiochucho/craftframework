import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { IssbDisclosuresPage } from '../pages/IssbDisclosuresPage'

export const Route = createFileRoute('/issb-disclosures')({
  component: () => (
    <AppLayout>
      <IssbDisclosuresPage />
    </AppLayout>
  ),
})
