import { test, expect, fakeSession } from './fixtures'
import type { Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

async function independent(page: Page, options: { fail?: boolean; delay?: Promise<void> } = {}) {
  const saves: Array<{ note: string }> = []
  const detail = {
    institute: 'Test Institute', craftOrgId: 'self_owner_acme_example',
    summary: { label: 'NPHI', version: 1, reportingPeriod: '2026', status: 'draft', own: { overall: 60, completeness: 100 }, independent: { overall: 60, answered: 1, total: 1 } },
    catalogue: { title: 'NPHI', version: '1', source: { title: 'Catalogue', url: 'https://example.org' }, levels: ['One', 'Two', 'Three', 'Four', 'Five'], evidenceCap: null, disclaimer: 'Test catalogue',
      sections: [{ id: 'governance', name: 'Governance' }], items: [{ id: 'G1', sectionId: 'governance', name: 'Governance item' }] },
    own: { G1: { score: 3, notApplicable: false, naReason: '', evidence: null } },
    independent: { G1: { score: 3, notApplicable: false, note: '' } },
    canReview: true, declaration: { organisation: 'Independent Firm', declaredAt: '2026-01-01T09:00:00Z' },
  }
  await page.route('**/api/nphi**', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saves.push(body)
      if (saves.length === 1 && options.delay) await options.delay
      if (options.fail) return route.fulfill({ status: 503, json: { error: 'Save temporarily unavailable' } })
      detail.independent.G1.note = body.note
      return route.fulfill({ json: { ok: true, savedAt: '2026-11-22T12:00:00.000Z' } })
    }
    return route.fulfill({ json: detail })
  })
  await page.goto('/nphi-review?id=1')
  await expect(page.getByLabel('What you saw (optional)')).toBeVisible()
  return saves
}

test('independent autosave preserves failed edits and restores them on returning', async ({ signedIn: page }) => {
  const options = { fail: true }
  const saves = await independent(page, options)
  await page.getByLabel('What you saw (optional)').fill('Retain my independent review')
  await expect(page.getByRole('status').filter({ hasText: /Not saved: Save temporarily unavailable/ })).toBeVisible()
  expect(saves).toHaveLength(1)
  options.fail = false
  await page.reload()
  await expect(page.getByLabel('What you saw (optional)')).toHaveValue('Retain my independent review')
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible()
  expect(saves).toHaveLength(2)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('assessment-input:') && k.endsWith(':nphi:1:G1')))).toEqual([])
})

test('independent saves stay ordered while the user edits during a pending request', async ({ signedIn: page }) => {
  let release!: () => void
  const delay = new Promise<void>(resolve => { release = resolve })
  const saves = await independent(page, { delay })
  const input = page.getByLabel('What you saw (optional)')
  await input.fill('Earlier input')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => saves.length).toBe(1)
  await input.fill('Latest input')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(saves).toHaveLength(1)
  release()
  await expect.poll(() => saves.length).toBe(2)
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible()
  expect(saves.map(s => s.note)).toEqual(['Earlier input', 'Latest input'])
  await page.reload()
  await expect(input).toHaveValue('Latest input')
})

test('archive displays the saved period, revision details and server timestamp', async ({ signedIn: page }) => {
  await page.route('**/api/assessment-archive**', route => route.fulfill({ json: { revisions: [{
    id: 2, source: 'independent', assessmentId: '1', recordKey: 'G1', period: '2026', actor: 'owner@acme.example',
    savedAt: '2026-11-22T12:00:00.000Z', snapshot: { note: 'Saved review details' },
  }], next: null } }))
  await page.goto('/assessment-archive')
  await expect(page.getByText('independent · G1 · 2026', { exact: true })).toBeVisible()
  await expect(page.getByText(/2026-11-22T12:00:00.000Z/)).toBeVisible()
  await page.getByText('Saved details', { exact: true }).click()
  await expect(page.getByText(/"note": "Saved review details"/)).toBeVisible()
})

test('review finalisation flushes pending comments and disables editing until the save finishes', async ({ signedIn: page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const requests: string[] = []
  const row = { id: 'CRL-1A', level: 1, domain: 'Governance', question: 'Governance review', self: 4, validator: 4, delta: 0, optimismBias: 0, sufficiency: 'sufficient', comment: '', evidenceRef: '', result: 'scored',
    checks: { design: 'yes', authorisation: 'yes', systemSupport: 'yes', operating: 'yes', traceability: 'yes', adequacy: 'yes', sustainability: 'yes' } }
  const view = { engagementId: 'autosave-review', status: 'in_progress', engagementStatus: 'active', framework: { name: 'Capital readiness', version: '1' }, type: 'independent_validation',
    lead: true, method: 'combined', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09', levels: [{ level: 1, name: 'Governance' }], rows: [row],
    qualifications: [], problems: [], rungs: { self: 1, validator: 1 }, scored: 1, total: 1 }
  await page.route('**/api/validation-reviews/autosave-review**', async route => {
    const request = route.request()
    if (request.method() !== 'GET') {
      const path = new URL(request.url()).pathname
      requests.push(path)
      if (path.includes('/scores/')) { await pending; row.comment = request.postDataJSON().comment }
      return route.fulfill({ json: { ok: true, savedAt: '2026-11-22T12:00:00.000Z' } })
    }
    return route.fulfill({ json: view })
  })
  await page.goto('/engagements/autosave-review/review')
  const comment = page.getByLabel('Comment', { exact: true })
  await expect(comment).toBeVisible()
  await page.getByRole('combobox', { name: 'Outcome', exact: true }).selectOption('not_validated')
  await comment.fill('Save before freeze')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Finalise and freeze', exact: true }).click()
  await expect.poll(() => requests.length).toBe(1)
  await expect(comment).toBeDisabled()
  expect(requests[0]).toContain('/scores/')
  release()
  await expect.poll(() => requests.some(path => path.endsWith('/finalise'))).toBe(true)
  expect(row.comment).toBe('Save before freeze')
  expect(requests.map(path => path.split('/').pop())).toEqual(['CRL-1A', 'finalise'])
})

test('workspace submission saves pending scores before locking and keeps their period archive', async ({ signedIn: page }) => {
  await page.goto('/app/workspaces')
  await page.getByLabel('Organization name').fill('Autosave Workspace Organisation')
  await page.getByLabel('Country').fill('Kenya')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await page.getByLabel('New workspace').fill('Assessment autosave')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name: 'Assessment autosave' }).click()
  await page.getByRole('main').getByRole('link', { name: 'Governance assessments & CRAFT Scorecard' }).click()
  await page.getByLabel('Framework').selectOption('CRAFT')
  await page.getByLabel('Reporting period').fill('FY2026')
  await page.getByRole('button', { name: 'New assessment' }).click()
  await page.getByRole('main').getByRole('link', { name: 'CRAFT', exact: true }).click()
  await page.getByRole('button', { name: 'Scoring Wizard', exact: true }).click()
  const item = page.locator('div', { has: page.getByText('LDR-1 · Board mandate and composition') }).last()
  await item.getByLabel('Rubric score').selectOption('4')
  await item.getByLabel('Evidence held').check()
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByText('in review', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Scoring Wizard', exact: true }).click()
  await expect(item.getByLabel('Rubric score')).toHaveValue('4')
  await expect(item.getByLabel('Rubric score')).toBeDisabled()
  await page.getByRole('main').getByRole('link', { name: 'My saved revisions', exact: true }).click()
  await expect(page.getByText(/workspace · leadership\/LDR-1 · FY2026/)).toBeVisible()
  await page.getByText('Saved details', { exact: true }).first().click()
  await expect(page.getByText(/"tierLevel": 4/)).toBeVisible()
})

test('workspace independent drafts persist across sessions and require explicit recording', async ({ signedIn: page, request, context }) => {
  const origin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
  const owner = (await context.cookies()).find(c => c.name === 'nf_jwt')!.value
  const headers = { cookie: `nf_jwt=${owner}` }
  const created = await request.post(`${origin}/api/orgs`, { headers, data: { name: 'Validation draft org', type: 'ngo', country: 'KE' } })
  expect(created.status()).toBe(201)
  const org = await created.json()
  expect((await request.post(`${origin}/api/orgs/${org.id}/members`, { headers, data: { email: 'draft-creator@acme.example', role: 'assessor' } })).status()).toBe(201)
  const creator = { cookie: `nf_jwt=${fakeSession('draft-creator@acme.example').token}` }
  const assessment = await request.post(`${origin}/api/workspaces/${org.defaultWorkspaceId}/assessments`, { headers: creator, data: { assessmentType: 'CRAFT', reportingPeriod: 'FY2026' } })
  expect(assessment.status()).toBe(201)
  const id = (await assessment.json()).id
  const base = `${origin}/api/workspaces/${org.defaultWorkspaceId}/assessments/${id}`
  expect((await request.put(`${base}/scores/leadership/LDR-1`, { headers: creator, data: { score: 4, evidenceUploaded: true } })).status()).toBe(200)
  expect((await request.post(`${base}/submit`, { headers: creator, data: {} })).status()).toBe(200)
  expect((await request.post(`${base}/approve`, { headers, data: {} })).status()).toBe(200)
  await page.goto(`/app/workspaces/${org.defaultWorkspaceId}/governance/assessments/${id}`)
  await page.getByRole('button', { name: 'Scorecard', exact: true }).click()
  await page.getByLabel('Validator name').fill('Independent Reviewer')
  await page.getByLabel('Notes (required unless fully validated)').fill('Review observations')
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible()
  expect((await (await request.get(`${base}/scorecard`, { headers })).json()).validations).toHaveLength(0)
  await page.reload()
  await page.getByRole('button', { name: 'Scorecard', exact: true }).click()
  await expect(page.getByLabel('Validator name')).toHaveValue('Independent Reviewer')
  await expect(page.getByLabel('Notes (required unless fully validated)')).toHaveValue('Review observations')
  await expect(page.getByRole('button', { name: 'Record independent validation' })).toBeDisabled()
  await page.getByLabel(/I declare that I am independent/).check()
  await page.getByRole('button', { name: 'Record independent validation' }).click()
  await expect.poll(async () => (await (await request.get(`${base}/scorecard`, { headers })).json()).validations.length).toBe(1)
  expect((await (await request.get(`${base}/validation-draft`, { headers })).json()).draft).toBeNull()
  await page.reload()
  await page.getByRole('button', { name: 'Scorecard', exact: true }).click()
  await expect(page.getByText('Independent validation recorded.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Validator name')).toHaveCount(0)
})

test('funding partner dashboard displays notes separately from scores', async ({ signedIn: page }) => {
  await page.route('**/api/validations/funder', route => route.fulfill({ json: [{
    id: 'v1', organization: 'Riverbend', framework: 'Readiness', statusLabel: 'Current',
    progress: { done: 2, total: 5 }, nextFollowUp: '2026-12-01',
    notes: [{ firmId: 'firm1', note: 'Follow up on the action plan', updatedAt: '2026-11-22T12:00:00Z' }],
  }] }))
  await page.goto('/dashboard')
  await expect(page.getByText('Funding partner inputs')).toBeVisible()
  await expect(page.getByText(/2 of 5 actions complete/)).toBeVisible()
  await expect(page.getByText(/Follow up on the action plan/)).toBeVisible()
  await expect(page.getByText(/do not change assessment scores/)).toBeVisible()
})

test('dashboard hides the expected read-only role denial but displays other funder errors', async ({ signedIn: page }) => {
  let specialized = true
  await page.route('**/api/validations/funder', route => route.fulfill({
    status: 403, json: specialized ? { code: 'SPECIALIZED_READ_ONLY' } : { error: 'Forbidden' },
  }))
  await page.goto('/dashboard')
  await expect(page.getByText('Funding partner information could not be loaded')).toHaveCount(0)
  specialized = false
  await page.reload()
  await expect(page.getByText('Funding partner information could not be loaded (403).')).toBeVisible()
})
