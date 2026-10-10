import assert from 'node:assert/strict'
import { ALL_DOMAINS, GOVERNANCE_DOMAINS } from './governanceDomains.ts'
import { DOMAINS, MOCK_QUESTIONS, TIER_NAMES } from './data.ts'

assert.equal(ALL_DOMAINS.length, DOMAINS.length)
assert.equal(ALL_DOMAINS.length, 20)
assert.deepEqual(Object.keys(GOVERNANCE_DOMAINS), TIER_NAMES)
assert.deepEqual(new Set(ALL_DOMAINS.map(({ domain }) => domain)), new Set(DOMAINS))

for (const { pillar, domain } of ALL_DOMAINS) {
  const tier = TIER_NAMES.indexOf(pillar) + 1
  assert.ok(MOCK_QUESTIONS.some((question) => question.domain === domain && question.tier === tier), `${domain} must map to ${pillar}`)
}

console.log('governanceDomains.test.ts: all assertions passed')
