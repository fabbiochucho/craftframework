// Pages a signed-in user may open before finishing the legacy organisation
// onboarding wizard. The /app/* platform has its own "create organization" flow;
// the validator system serves consultants, auditors and funding partners who are
// not an assessed organisation, so forcing them through organisation setup would
// lock them out of the directory, training, engagements and Review Panel.
const SKIP_ONBOARDING = ['/app', '/directory', '/training', '/engagements', '/panel', '/validation', '/validations', '/networks', '/start']

export function skipsOnboarding(pathname: string): boolean {
  return SKIP_ONBOARDING.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
