import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { PortfolioAdminPage } from '../pages/PortfolioAdminPage'

export const Route = createFileRoute('/admin_/portfolio')({
  component: () => (
    <AppLayout>
      <PortfolioAdminPage />
    </AppLayout>
  ),
})
