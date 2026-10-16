// Self-check — run directly with `node src/lib/onboardingRoutes.test.ts`.
import assert from 'node:assert/strict'
import { skipsOnboarding } from './onboardingRoutes.ts'

for (const p of ['/app/workspaces', '/directory', '/directory/validators/abc', '/training', '/training/module/m1',
  '/engagements', '/engagements/42/review', '/panel', '/panel/7', '/validation/CRAFT-V-X', '/validations/3']) {
  assert.ok(skipsOnboarding(p), p)
}
for (const p of ['/dashboard', '/assessment', '/cip', '/directoryx', '/apple', '/']) {
  assert.ok(!skipsOnboarding(p), p)
}
console.log('onboardingRoutes.test.ts: all assertions passed')
