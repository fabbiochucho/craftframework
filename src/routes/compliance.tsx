import { createFileRoute, redirect } from '@tanstack/react-router'

// The Compliance Calendar is now the "Reporting Cycle Calendar" tab of the
// unified Obligations surface.
export const Route = createFileRoute('/compliance')({
  beforeLoad: () => {
    throw redirect({ to: '/obligations' })
  },
})
