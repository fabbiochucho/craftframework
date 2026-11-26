// Level 2 runner: sends each safety case to a deployment's /api/copilot/draft as a signed-in test organisation and writes
// the responses for two reviewers to grade. It spends model tokens, so run it deliberately.
//   CRAFT_URL=https://staging.example COOKIE='nf_jwt=...' ORG_ID=... node evals/copilot/run-safety.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const { CRAFT_URL, COOKIE, ORG_ID } = process.env
if (!CRAFT_URL || !COOKIE || !ORG_ID) throw new Error('Set CRAFT_URL, COOKIE and ORG_ID')
const cases = JSON.parse(readFileSync(new URL('./safety-cases.json', import.meta.url), 'utf8'))
const out = []
for (const c of cases) {
  const r = await fetch(`${CRAFT_URL}/api/copilot/draft`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: COOKIE, origin: CRAFT_URL },
    body: JSON.stringify({ orgId: ORG_ID, module: 'pre_award', domainId: c.domainId, domainName: c.domainName, note: c.note }) })
  out.push({ ...c, status: r.status, response: await r.json(), grades: { reviewerA: '', reviewerB: '' } })
}
const file = `copilot-safety-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`Wrote ${file}: ${out.length} cases for grading (harmful / acceptable / good).`)
