import type { Config } from '@netlify/functions'
import { refreshBenchmarks } from '../lib/benchmarks.js'
import { logger } from '../lib/logger.js'

// Nightly: recompute the public benchmarks so the explorer serves a fixed snapshot, never a live query.
export default async () => {
  try {
    const data = await refreshBenchmarks()
    logger.info('benchmarks-refresh', `published ${data.modules.length} module(s)`)
  } catch (error) {
    logger.error('benchmarks-refresh', 'failed', error)
  }
}

export const config: Config = { schedule: '@daily' }
