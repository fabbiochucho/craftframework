import { createFileRoute, redirect } from '@tanstack/react-router'

// The Evidence Vault is now the "Document Vault" tab of the unified Data Room.
export const Route = createFileRoute('/evidence')({
  beforeLoad: () => {
    throw redirect({ to: '/data-room' })
  },
})
