// Approved jurisdictions for the laws register, loaded once per page and refreshable after a Super Admin change.
import { useCallback, useEffect, useState } from 'react'
import { fetchLawApprovals, type LawApproval } from '../api'

export function useLawApprovals() {
  const [records, setRecords] = useState<LawApproval[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetchLawApprovals(controller.signal).then((r) => { if (!controller.signal.aborted) setRecords(r) })
    return () => controller.abort()
  }, [tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { records, approved: records.map((r) => r.jurisdiction), reload }
}
