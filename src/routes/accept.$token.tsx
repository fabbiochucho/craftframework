import { createFileRoute } from '@tanstack/react-router'
import { AcceptInvitePage } from '../pages/AcceptInvitePage'

export const Route = createFileRoute('/accept/$token')({
  component: AcceptInvitePage,
})
