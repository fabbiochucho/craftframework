import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { SecurityPolicyPage } from '../pages/PolicyPages'

export const Route = createFileRoute('/security')({
  head: () => ({ meta: [{ title: 'Security | CRAFT — DiBadili Institute' }] }),
  component: () => (
    <PublicLayout>
      <SecurityPolicyPage />
    </PublicLayout>
  ),
})
