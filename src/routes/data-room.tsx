import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { DataRoomPage } from '../pages/DataRoomPage'

export const Route = createFileRoute('/data-room')({
  component: () => (
    <AppLayout>
      <DataRoomPage />
    </AppLayout>
  ),
})
