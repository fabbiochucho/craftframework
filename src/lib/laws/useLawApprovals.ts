// Approved jurisdictions for the laws register, loaded once per page and refreshable after a Super Admin change.
import { useCallback, useEffect, useState } from 'react'
import { fetchLawApprovals, type LawApproval } from '../api'
import { currentApprovals } from './jurisdictionReport'

export function useLawApprovals() {
  const [records, setRecords] = useState<LawApproval[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetchLawApprovals(controller.signal).then((r) => { if (!controller.signal.aborted) setRecords(r) })
    return () => controller.abort()
  }, [tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  // Only approvals for the current register version count in reports.
  return { records, approved: currentApprovals(records), reload }
}
