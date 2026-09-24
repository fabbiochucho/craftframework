import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BellRing } from 'lucide-react'
import { fetchCompliance } from '../lib/api'
import { computeMetrics } from '../lib/obligations'
import { cn } from '../lib/utils'

// Surfaces upcoming/overdue compliance deadlines in the app chrome, not just
// the daily reminder email — a user who signs in has no in-app signal that
// something is due until they happen to open the Compliance Calendar. Renders
// nothing when there's nothing urgent, so it never adds noise to a clean
// workspace. Reuses computeMetrics (same function ObligationsPage uses) rather
// than re-deriving due-date tiers, so "submitted" items are correctly excluded
// and both surfaces always agree on what counts as urgent.
export function ComplianceDeadlineBadge({ orgId, isDemo }: { orgId: string | undefined; isDemo: boolean }) {
  const [urgentCount, setUrgentCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)

  useEffect(() => {
    // Demo sessions are fully in-memory and never touch the API (there is no
    // real Identity session for the server to authenticate) — every other
    // mutation/fetch in the app gates on this; this one didn't, and always
    // 401'd during a demo walkthrough.
    if (!orgId || isDemo) {
      setUrgentCount(0)
      setOverdueCount(0)
      return
    }
    let active = true
    fetchCompliance(orgId).then(items => {
      if (!active) return
      const metrics = computeMetrics(items)
      setUrgentCount(metrics.reportsDue30 + metrics.regulatoryExpiries30)
      setOverdueCount(metrics.overdue)
    })
    return () => {
      active = false
    }
  }, [orgId, isDemo])

  const total = urgentCount + overdueCount
  if (total === 0) return null

  return (
    <Link
      to="/regulatory-compliance"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        overdueCount > 0
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
      )}
      title={`${overdueCount} overdue, ${urgentCount} due within 30 days`}
    >
      <BellRing className="h-3.5 w-3.5" />
      {total} deadline{total === 1 ? '' : 's'} {overdueCount > 0 ? 'overdue' : 'due soon'}
    </Link>
  )
}
