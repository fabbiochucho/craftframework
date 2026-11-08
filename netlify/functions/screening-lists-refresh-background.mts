import { logger } from '../lib/logger.js'
import { fetchedAt, refreshSource } from '../lib/official-lists.js'
import { refreshDueLists } from '../lib/list-refresh.js'
import { LIST_SOURCES } from '../../src/lib/sanctionsLists.js'

// Background function (up to 15 minutes): refreshes every official sanctions list older than six hours. Started daily
// by screening-lists-refresh; safe to call again (lists refreshed recently are skipped, and a failed list keeps its
// previous copy). Failures are retried a few minutes apart; see list-refresh.ts for when a failure is reported.
export default async () => {
  await refreshDueLists(LIST_SOURCES, {
    fetchedAt,
    refresh: refreshSource,
    log: {
      info: (m) => logger.info('screening-lists', m),
      warn: (m, err) => logger.warn('screening-lists', m, { error: err instanceof Error ? err.message : String(err) }),
      error: (m, err) => logger.error('screening-lists', m, err),
    },
  })
}
