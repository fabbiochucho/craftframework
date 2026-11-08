import { useEffect } from 'react'
import { initMonitoring } from '../lib/monitoring'
import { installStaleChunkReload } from '../lib/staleChunk'

/** Reloads once after a deploy leaves this tab on old code (see staleChunk.ts), and starts error monitoring after the first paint. Renders nothing; does nothing without a Sentry DSN. */
export function MonitoringController() {
  useEffect(() => { installStaleChunkReload(); initMonitoring() }, [])
  return null
}
