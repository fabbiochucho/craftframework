import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AssessmentArchivePage } from '../pages/AssessmentArchivePage'

export const Route = createFileRoute('/assessment-archive')({
  component: () => <AppLayout><AssessmentArchivePage /></AppLayout>,
})
