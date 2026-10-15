import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { DataProcessingPage } from '../pages/PolicyPages'

export const Route = createFileRoute('/data-processing')({
  head: () => ({ meta: [{ title: 'Data Processing Terms | CRAFT — DiBadili Institute' }] }),
  component: () => (
    <PublicLayout>
      <DataProcessingPage />
    </PublicLayout>
  ),
})
