// Which features are on for the signed-in person (see src/lib/features.ts). Loaded once per page load and shared;
// until it arrives, or if it can't be loaded (signed out, demo, offline), everything counts as on. The server
// refuses switched-off features on its own, so this only tidies the screens.
import { useEffect, useState } from 'react'
import { featureForPath } from './features'

type FeatureMap = Record<string, { enabled: boolean; reason: string }>
let pending: Promise<FeatureMap> | null = null

export function useFeatures(signedIn: boolean) {
  const [map, setMap] = useState<FeatureMap>({})
  useEffect(() => {
    if (!signedIn) return
    pending ??= fetch('/api/features').then((r) => (r.ok ? r.json() : { features: {} })).then((b) => b.features ?? {}).catch(() => ({}))
    let live = true
    void pending.then((m) => { if (live) setMap(m) })
    return () => { live = false }
  }, [signedIn])
  /** The feature that owns this app path, when it is switched off; otherwise null. */
  const offFor = (path: string) => {
    const f = featureForPath(path, 'routes') ?? featureForPath(path, 'api')
    return f && map[f.key]?.enabled === false ? { label: f.label, reason: map[f.key].reason } : null
  }
  return { offFor, isOn: (key: string) => map[key]?.enabled !== false }
}
