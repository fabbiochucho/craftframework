import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { SubprocessorsPage } from '../pages/PolicyPages'

export const Route = createFileRoute('/subprocessors')({
  head: () => ({ meta: [{ title: 'Sub-processors | CRAFT — DiBadili Institute' }] }),
  component: () => (
    <PublicLayout>
      <SubprocessorsPage />
    </PublicLayout>
  ),
})
