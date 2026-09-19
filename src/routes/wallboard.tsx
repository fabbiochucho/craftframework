import { createFileRoute } from '@tanstack/react-router'
import { WallboardPage } from '../pages/WallboardPage'

// The wallboard is a full-screen broadcast surface, so it deliberately renders
// WITHOUT the AppLayout sidebar/header chrome. Route protection (and optional
// `?demo=` bootstrap) lives inside WallboardPage.
export const Route = createFileRoute('/wallboard')({
  component: WallboardPage,
})
