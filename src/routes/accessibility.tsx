import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { AccessibilityPage } from '../pages/PolicyPages'

export const Route = createFileRoute('/accessibility')({
  head: () => ({ meta: [{ title: 'Accessibility Statement | CRAFT — DiBadili Institute' }] }),
  component: () => (
    <PublicLayout>
      <AccessibilityPage />
    </PublicLayout>
  ),
})
