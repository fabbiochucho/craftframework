import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { BenchmarksPage } from '../pages/BenchmarksPage'

export const Route = createFileRoute('/benchmarks')({
  head: () => ({ meta: [{ title: 'CRAFT Benchmarks | CRAFT' }, { name: 'description', content: 'Anonymous capacity benchmarks from organisations that chose to take part, by country, sector, type and size.' }] }),
  component: () => (
    <PublicLayout>
      <BenchmarksPage />
    </PublicLayout>
  ),
})
