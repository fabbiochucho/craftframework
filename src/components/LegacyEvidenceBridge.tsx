import { Link } from '@tanstack/react-router'
import { Card } from './ui'

export function LegacyEvidenceBridge() {
  return <Card className="space-y-3 p-6">
    <h2 className="font-display text-xl font-bold text-slate-900">Secure workspace evidence</h2>
    <p className="text-sm text-slate-600">Legacy assessment records and workspace IDs are separate. Select an authorized workspace, then open its Evidence registry to upload, read and review actual files. No document is uploaded or verified by this legacy screen.</p>
    <Link to="/app/workspaces" className="inline-block font-semibold text-emerald-700 underline">Choose workspace → Evidence registry</Link>
  </Card>
}
