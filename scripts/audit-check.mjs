// `npm audit` gate with named, expiring exemptions. Fails on any high or critical advisory that is not listed
// below, and on any listed exemption past its date (so an exemption is never forgotten).
// Usage: node scripts/audit-check.mjs [--omit=dev]      Self-check: node scripts/audit-check.mjs --self-test
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

// Each exemption: why it is safe to ship for now, and the date it must be looked at again.
export const EXEMPT = {
  'GHSA-fc5q-39xc-vjpf': {
    until: '2026-12-31',
    why: 'picomatch <= 4.0.7 ReDoS with crafted extglobs; no patched release exists (4.0.7 is the latest). It arrives only via build tooling (vite, @tanstack router generator/plugin) matching file patterns written by developers; no visitor input reaches it. Remove as soon as a fixed picomatch ships.',
  },
}

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }

/** Advisories at `level` or above from an `npm audit --json` report, minus live exemptions; plus expired exemptions. */
export function problems(report, today = new Date().toISOString().slice(0, 10), level = 'high') {
  const found = new Map()
  for (const v of Object.values(report.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || RANK[via.severity] < RANK[level]) continue
      const id = String(via.url ?? '').split('/').pop() || String(via.source)
      found.set(id, `${id} ${via.severity}: ${via.name} ${via.range} (${via.title})`)
    }
  }
  const out = []
  for (const [id, line] of found) {
    const ex = EXEMPT[id]
    if (!ex) out.push(line)
    else if (ex.until < today) out.push(`${line}: exemption expired on ${ex.until}, review it`)
  }
  return out
}

if (process.argv.includes('--self-test')) {
  const report = (sev, id) => ({ vulnerabilities: { x: { via: [{ severity: sev, url: `https://github.com/advisories/${id}`, name: 'x', range: '*', title: 't' }, 'y'] } } })
  assert.deepEqual(problems(report('high', 'GHSA-fc5q-39xc-vjpf'), '2026-11-18'), [], 'listed and in date: passes')
  assert.equal(problems(report('high', 'GHSA-fc5q-39xc-vjpf'), '2027-01-01').length, 1, 'expired: fails')
  assert.equal(problems(report('critical', 'GHSA-new'), '2026-11-18').length, 1, 'anything else high or critical: fails')
  assert.deepEqual(problems(report('moderate', 'GHSA-new'), '2026-11-18'), [], 'below the level: passes')
  console.log('audit-check: self-test passed')
} else {
  const args = ['audit', '--json', ...process.argv.slice(2).filter((a) => a.startsWith('--omit'))]
  let out
  try { out = execFileSync('npm', args, { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 }) } catch (e) { out = e.stdout } // npm audit exits non-zero when it finds anything
  const left = problems(JSON.parse(out))
  for (const [id, ex] of Object.entries(EXEMPT)) console.log(`exempt until ${ex.until}: ${id} (${ex.why})`)
  if (left.length) { console.error(`npm audit: ${left.length} unexempted high/critical advisory(ies):\n- ${left.join('\n- ')}`); process.exit(1) }
  console.log('npm audit: no unexempted high or critical advisories')
}
