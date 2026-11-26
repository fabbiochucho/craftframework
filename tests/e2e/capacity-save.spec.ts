import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Drafts are encrypted at rest; decrypt with the tab's session key to inspect them, and prove they are not plain text.
const draftIn = (page: Page, name: string) => page.evaluate(async name => {
  const stored = localStorage.getItem(name)
  if (!stored) return null
  if (!stored.startsWith('dv1:')) throw new Error('draft stored unencrypted')
  const { key } = JSON.parse(sessionStorage.getItem('craft_draft_key') ?? '{}')
  const bytes = (t: string) => Uint8Array.from(atob(t), c => c.charCodeAt(0))
  const [iv, data] = stored.slice(4).split(':')
  const k = await crypto.subtle.importKey('raw', bytes(key), 'AES-GCM', false, ['decrypt'])
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, k, bytes(data))))
}, name)
const draftEvidence = async (page: Page) => (await draftIn(page, 'cca-draft-cca_browser'))?.responses['board.2'].evidence

const mod = {
  id: 'community', name: 'Community', audience: 'Organisations',
  areas: [{ id: 'governance', name: 'Governance', domains: [{
    id: 'board', name: 'Board', level1: 'No evidence yet',
    levels: { 2: [{ id: 'board.2', text: 'Minutes are signed' }], 3: [], 4: [] },
  }] }],
}

async function assessment(page: Page, options: { canWrite?: boolean; fail?: boolean; delayFirst?: Promise<void> } = {}) {
  const saved: Record<string, unknown>[] = []
  let completeCalls = 0
  const row = {
    id: 'cca_browser', orgId: 'self_owner_acme_example', module: 'community', year: 2026,
    awardRef: '', region: '', district: '', status: 'draft', assessor: '', orgLead: '',
    responses: {}, votes: {}, consensus: {}, notAssessed: {}, planReviewNotes: {}, plan: [], swot: {}, domainIds: null,
  }
  await page.route('**/api/cca**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'PUT') {
      saved.push(request.postDataJSON())
      if (saved.length === 1 && options.delayFirst) await options.delayFirst
      if (options.fail) return route.fulfill({ status: 400, json: { error: 'Could not save SWOT (weaknesses, 0): too long.' } })
      return route.fulfill({ json: { ok: true } })
    }
    if (path.endsWith('/complete')) {
      completeCalls++
      row.status = 'complete'
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: path.endsWith('/modules') ? { modules: [mod] } : { assessments: [row], canWrite: options.canWrite ?? true } })
  })
  await page.goto('/capacity')
  await page.getByRole('button', { name: /2026.*Draft/ }).click()
  await expect(page.getByLabel('Evidence seen for: Minutes are signed')).toBeVisible()
  return { saved, completeCalls: () => completeCalls }
}

test('a delayed save does not discard newer edits, and subsequent saves stay ordered', async ({ signedIn: page }) => {
  let release!: () => void
  const delayFirst = new Promise<void>(resolve => { release = resolve })
  const state = await assessment(page, { delayFirst })
  const evidence = page.getByLabel('Evidence seen for: Minutes are signed')
  await evidence.fill('First version')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => state.saved.length).toBe(1)
  await evidence.fill('Latest version')
  await expect.poll(() => draftEvidence(page)).toBe('Latest version')
  const firstSaved = page.waitForResponse(response => response.url().endsWith('/api/cca/cca_browser') && response.request().method() === 'PUT')
  release()
  await firstSaved
  expect(await draftEvidence(page)).toBe('Latest version')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => state.saved.length).toBe(2)
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ })).toBeVisible()
  expect(state.saved.map(body => (body.responses as Record<string, { evidence: string }>)['board.2'].evidence)).toEqual(['First version', 'Latest version'])
  expect(await page.evaluate(() => localStorage.getItem('cca-draft-cca_browser'))).toBeNull()
  expect(state.saved[1].replaceConsensus).toBe(true)
})

test('a failed save retains the draft and never submits an assessment', async ({ signedIn: page }) => {
  const state = await assessment(page, { fail: true })
  await page.getByLabel('Evidence seen for: Minutes are signed').fill('Signed minutes')
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /Could not save SWOT/ })).toBeVisible()
  expect(state.completeCalls()).toBe(0)
  expect(await draftEvidence(page)).toBe('Signed minutes')
})

test('read-only users can inspect answers without editable fields or save controls', async ({ signedIn: page }) => {
  const state = await assessment(page, { canWrite: false })
  await expect(page.getByLabel('Evidence seen for: Minutes are signed')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Complete assessment', exact: true })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: /read-only access/ })).toBeVisible()
  expect(state.saved).toEqual([])
})

test('completion waits for the current save and prevents edits while submitting', async ({ signedIn: page }) => {
  let release!: () => void
  const delayFirst = new Promise<void>(resolve => { release = resolve })
  const state = await assessment(page, { delayFirst })
  const evidence = page.getByLabel('Evidence seen for: Minutes are signed')
  await evidence.fill('Final signed minutes')
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click()
  await expect.poll(() => state.saved.length).toBe(1)
  await expect(evidence).toBeDisabled()
  expect(state.completeCalls()).toBe(0)
  release()
  await expect.poll(() => state.completeCalls()).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'Assessment completed.' })).toBeVisible()
  await expect(evidence).toBeDisabled()
})

test('an older profile can enter and retain wizard data without a false save confirmation', async ({ signedIn: page, request, context }) => {
  const api = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
  const session = (await context.cookies()).find(cookie => cookie.name === 'nf_jwt')!.value
  const headers = { cookie: `nf_jwt=${session}` }
  expect((await request.put(`${api}/api/legacy-state`, {
    headers, data: { orgId: 'self_owner_acme_example', key: 'entity-profile', value: {
      archetype: 'Civil Society', country: 'KE', sector: 'Health', onboardingComplete: true,
    } },
  })).status()).toBe(200)
  await page.goto('/assessment')
  await expect(page.getByRole('heading', { name: '5-Tier Capacity Assessment', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Next Tier/ }).click()
  await page.getByLabel('Evidence seen for: a.', { exact: true }).fill('Signed financial statements')
  await expect.poll(async () => {
    const response = await request.get(`${api}/api/legacy-state?orgId=self_owner_acme_example&key=craft:statements`, { headers })
    return Object.values((await response.json()).value ?? {}).some(value => (value as { evidence: string }).evidence === 'Signed financial statements')
  }).toBe(true)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Changes save automatically. Check the save status above and the offline sync indicator for confirmation.', { exact: true })).toBeVisible()
  await expect(page.getByText('Assessment saved.', { exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: /Next Tier/ }).click()
  await expect(page.getByLabel('Evidence seen for: a.', { exact: true })).toHaveValue('Signed financial statements')
})
