import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { AcceptableUsePage } from '../pages/PolicyPages'

export const Route = createFileRoute('/acceptable-use')({
  head: () => ({ meta: [{ title: 'Acceptable Use Policy | CRAFT — DiBadili Institute' }] }),
  component: () => (
    <PublicLayout>
      <AcceptableUsePage />
    </PublicLayout>
  ),
})
