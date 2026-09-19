import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { InformalEconomyPage } from '../pages/InformalEconomyPage'

export const Route = createFileRoute('/informal-economy')({
  component: () => (
    <AppLayout>
      <InformalEconomyPage />
    </AppLayout>
  ),
})
