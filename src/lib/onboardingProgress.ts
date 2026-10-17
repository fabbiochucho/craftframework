// The three steps of /onboarding, shared by the page, the progress tracker and the Super Admin analytics.
export const ONBOARDING_STEPS = ['Workspace', 'Donor Alignment', 'Team & Import'] as const

// 1-based step number -> its name, or null when out of range.
export function onboardingStepName(step: number): string | null {
  return Number.isInteger(step) && step >= 1 && step <= ONBOARDING_STEPS.length ? ONBOARDING_STEPS[step - 1] : null
}
