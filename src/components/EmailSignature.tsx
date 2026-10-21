import { SIGNATURE_NAMES, SIGNATURE_PATH, SIGNATURE_TEAM } from '../lib/emailSignature'

/** The founders' sign-off used on the thank-you page, matching the lifecycle emails. */
export function EmailSignature() {
  return (
    <div className="mt-6">
      <p className="text-sm text-slate-600">Warm regards,</p>
      <img src={SIGNATURE_PATH} width={240} height={57} alt={SIGNATURE_NAMES} className="my-1 h-auto w-60 max-w-full" />
      <p className="text-sm font-semibold text-emerald-900">{SIGNATURE_NAMES}</p>
      <p className="text-xs text-slate-500">{SIGNATURE_TEAM}</p>
    </div>
  )
}
