import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { NphiReviewPage } from '../pages/NphiReviewPage'

// /nphi-review?id=<assessment>: an institute's independent assessor scores its NPHI, JEE or SPAR assessment.
export const Route = createFileRoute('/nphi-review')({
  validateSearch: (search: Record<string, unknown>): { id?: number } => (Number.isInteger(Number(search.id)) ? { id: Number(search.id) } : {}),
  component: ReviewRoute,
})

function ReviewRoute() {
  const { id } = Route.useSearch()
  return <AppLayout><NphiReviewPage id={id} /></AppLayout>
}
