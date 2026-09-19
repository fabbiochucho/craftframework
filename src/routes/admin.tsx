import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AdminPage } from '../pages/AdminPage'

export const Route = createFileRoute('/admin')({
  component: AdminRoute,
})

function AdminRoute() {
  return (
    <AppLayout>
      <AdminPage />
    </AppLayout>
  )
}
