import { useEffect } from 'react'
import { initMonitoring } from '../lib/monitoring'

/** Starts error monitoring after the first paint. Renders nothing; does nothing without a Sentry DSN. */
export function MonitoringController() {
  useEffect(() => { initMonitoring() }, [])
  return null
}
