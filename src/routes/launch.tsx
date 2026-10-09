import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { LaunchKitPage } from '../pages/LaunchKitPage'

const SITE = 'https://craftframework.becomechange.institute'
const TITLE = 'CRAFT Launch & Press Kit | DiBadili Institute'
const DESC = 'CRAFT launches 12 October 2026. Download social graphics, logos, brand guidelines, launch copy and the official press release.'
const IMAGE = `${SITE}/launch/craft-launch-1200x627.png`

export const Route = createFileRoute('/launch')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESC },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESC },
      { property: 'og:url', content: `${SITE}/launch` },
      { property: 'og:image', content: IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '627' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESC },
      { name: 'twitter:image', content: IMAGE },
    ],
  }),
  component: () => (
    <PublicLayout>
      <LaunchKitPage />
    </PublicLayout>
  ),
})
