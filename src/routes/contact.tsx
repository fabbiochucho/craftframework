import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { ContactPage } from '../pages/ContactPage'

export const Route = createFileRoute('/contact')({
  component: () => (
    <PublicLayout>
      <ContactPage />
    </PublicLayout>
  ),
})
