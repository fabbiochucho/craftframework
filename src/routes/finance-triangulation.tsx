import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { FinanceTriangulationPage } from '../pages/FinanceTriangulationPage'

export const Route = createFileRoute('/finance-triangulation')({
  component: FinanceTriangulationRoute,
})

function FinanceTriangulationRoute() {
  return (
    <AppLayout>
      <FinanceTriangulationPage />
    </AppLayout>
  )
}
