import { createFileRoute, redirect } from '@tanstack/react-router'

// The Data Room Vaults are now the "Framework Vaults" tab of the unified Data Room.
export const Route = createFileRoute('/vaults')({
  beforeLoad: () => {
    throw redirect({ to: '/data-room' })
  },
})
