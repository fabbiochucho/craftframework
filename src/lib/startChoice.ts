// "What brings you to CRAFT?" — the answer only routes people to the right path; it is not an account type, because
// one person can be several (a consultant who also runs a network). Kept in this browser as a convenience: if it is
// missing (new device, private window), the question is simply asked again. Self-check: `node src/lib/startChoice.test.ts`.

export const START_CHOICES = ['organisation', 'validator', 'funder', 'network'] as const
export type StartChoice = (typeof START_CHOICES)[number]

const KEY = 'craft-start-choice'

export function readStartChoice(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): StartChoice | null {
  try {
    const v = storage?.getItem(KEY)
    return (START_CHOICES as readonly string[]).includes(v ?? '') ? (v as StartChoice) : null
  } catch {
    return null
  }
}

export function saveStartChoice(c: StartChoice, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(KEY, c) } catch { /* storage blocked: the question is asked again next time */ }
}

/** Where someone who hasn't set up an organisation goes after signing in. */
export const unconfiguredHome = (choice: StartChoice | null): string => (choice === 'organisation' ? '/onboarding' : '/start')

/** Where each answer leads. */
export const START_PATH: Record<StartChoice, string> = {
  organisation: '/onboarding',
  validator: '/directory',
  funder: '/networks?setup=cohort',
  network: '/networks?setup=network',
}
