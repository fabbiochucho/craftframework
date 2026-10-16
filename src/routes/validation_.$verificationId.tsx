import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { PublicValidationPage } from '../pages/PublicValidationPage'

export const Route = createFileRoute('/validation_/$verificationId')({
  head: () => ({ meta: [{ title: 'Validation verification | CRAFT' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: VerificationRoute,
})

function VerificationRoute() {
  const { verificationId } = Route.useParams()
  return (
    <PublicLayout>
      <PublicValidationPage verificationId={verificationId} />
    </PublicLayout>
  )
}
