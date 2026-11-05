import { logger } from '../lib/logger.js'
import { loadLists, refreshSource } from '../lib/official-lists.js'
import { LIST_SOURCES } from '../../src/lib/sanctionsLists.js'

// Background function (up to 15 minutes): refreshes every official sanctions list older than six hours. Started daily
// by screening-lists-refresh; safe to call again (lists refreshed recently are skipped, and a failed list keeps its
// previous copy).
export default async () => {
  const { status } = await loadLists()
  for (const source of LIST_SOURCES) {
    const s = status.find((x) => x.source === source)
    if (s?.fetchedAt && Date.now() - Date.parse(s.fetchedAt) < 6 * 3_600_000) continue
    try {
      const n = await refreshSource(source)
      logger.info('screening-lists', `${source}: ${n} entries`)
    } catch (err) {
      logger.error('screening-lists', `${source} refresh failed`, err)
    }
  }
}
