import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { analyticsBeforeNavigate, analyticsRouteResolved, initAnalytics, setAnalyticsTraits } from '../lib/analytics'
import { useAuthCtx, useEntityProfileCtx } from '../lib/context'
import { useI18n } from '../lib/i18n'

/** Connects the router and signed-in user to the consented analytics. Renders nothing; does nothing without consent. */
export function AnalyticsController() {
  const router = useRouter()
  const { currentUser } = useAuthCtx()
  const { entityProfile } = useEntityProfileCtx()
  const { lang } = useI18n()

  useEffect(() => {
    initAnalytics()
    const before = router.subscribe('onBeforeNavigate', e => analyticsBeforeNavigate(e.toLocation.pathname))
    const resolved = router.subscribe('onResolved', () => analyticsRouteResolved())
    analyticsRouteResolved()
    return () => { before(); resolved() }
  }, [router])

  const signedIn = Boolean(currentUser && !currentUser.isDemo)
  const role = signedIn ? currentUser?.role : undefined
  const country = signedIn ? entityProfile.country || undefined : undefined
  useEffect(() => { setAnalyticsTraits({ role, country, language: lang }) }, [role, country, lang])
  return null
}
