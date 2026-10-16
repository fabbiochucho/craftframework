import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { DirectoryPage } from '../pages/DirectoryPage'

export const Route = createFileRoute('/directory')({
  component: () => (
    <AppLayout>
      <DirectoryPage />
    </AppLayout>
  ),
})
