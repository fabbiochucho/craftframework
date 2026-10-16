import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { ValidationLookupPage } from '../pages/PublicValidationPage'

export const Route = createFileRoute('/validation')({
  head: () => ({ meta: [{ title: 'Verify a validation | CRAFT' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: () => (
    <PublicLayout>
      <ValidationLookupPage />
    </PublicLayout>
  ),
})
