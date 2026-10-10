import { test, expect } from '@playwright/test'

const API_ORIGIN = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })

test('support widget uses the real API for private escalation with accessible mobile controls', async ({ page, request }) => {
  expect((await request.post(`${API_ORIGIN}/__test/reset`)).status()).toBe(204)
  await page.route(/\/api\/support-bot\//, async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `${API_ORIGIN}${url.pathname}` })
    await route.fulfill({ response })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/code-of-conduct')
  const toggle = page.getByRole('button', { name: 'Open support chat' })
  await expect(toggle).toBeEnabled()
  await toggle.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'craftframework Support' })
  await expect(dialog).toBeVisible()
  const input = page.getByRole('textbox', { name: 'Your support message' })
  await expect(input).toBeFocused()
  await input.fill('I need to report harassment')
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /I understand non-private/ }).check()
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('log')).toContainText('contact craftframework@becomechange.institute directly')
  await expect(page.getByRole('link', { name: 'View public GitHub issue' })).toHaveCount(0)
  const escalate = page.getByRole('button', { name: 'Escalate privately by email' })
  await expect(escalate).toBeDisabled()
  await page.getByRole('textbox', { name: 'Contact email for escalation' }).fill('reporter@example.com')
  await page.getByRole('checkbox', { name: /I consent to sharing/ }).check()
  await escalate.click()
  await expect(page.getByRole('log')).toContainText('queued, but email is not configured')
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('PostHog is opt-in and captures only support metadata, never message or contact content', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined })
  })
  const captures: Record<string, any>[] = []
  await page.route('https://eu.i.posthog.com/**', async route => {
    const request = route.request()
    if (request.method() === 'POST') {
      const payload = request.postDataJSON()
      captures.push(...(payload.batch ?? (Array.isArray(payload) ? payload : [payload])))
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/api/support-bot/chat', route => route.fulfill({
    status: 201, contentType: 'application/json',
    body: JSON.stringify({ classification: 'question', type: 'question', answer: 'Test answer', issueCreated: true, escalationReason: 'unresolved_question' }),
  }))
  await page.route('**/api/support-bot/escalate', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'accepted', reason: 'unresolved_question', recipientType: 'support_queue' }),
  }))
  await page.goto('/code-of-conduct')
  await page.getByRole('button', { name: 'Open support chat' }).click()
  await page.getByRole('checkbox', { name: /I understand non-private/ }).check()
  const input = page.getByRole('textbox', { name: 'Your support message' })
  await input.fill('setup person@example.com')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('log')).toContainText('Test answer')
  expect(captures).toHaveLength(0)
  await page.getByRole('checkbox', { name: /Allow anonymous support analytics/ }).check()
  await input.fill('setup private@example.com')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect.poll(() => captures.length, { timeout: 30_000 }).toBe(2)
  expect(captures.map(event => event.event)).toEqual(['support_chat_message_sent', 'support_issue_created'])
  expect(captures[0].properties.topic_keywords).toEqual(['setup'])
  expect(captures.every(event => event.properties.$process_person_profile === false)).toBe(true)
  expect(JSON.stringify(captures)).not.toContain('private@example.com')
  expect(JSON.stringify(captures)).not.toContain('$current_url')
  await page.getByRole('textbox', { name: 'Contact email for escalation' }).fill('private@example.com')
  await page.getByRole('checkbox', { name: /I consent to sharing/ }).check()
  await page.getByRole('button', { name: 'Escalate privately by email' }).last().click()
  await expect.poll(() => captures.length).toBe(3)
  expect(captures[2].event).toBe('support_escalated')
  expect(captures[2].properties.reason).toBe('unresolved_question')
  expect(captures[2].properties.$process_person_profile).toBe(false)
  expect(JSON.stringify(captures)).not.toContain('private@example.com')
  await page.getByRole('checkbox', { name: /Allow anonymous support analytics/ }).uncheck()
  await input.fill('compliance')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('log')).toContainText('compliance')
  expect(captures).toHaveLength(3)
})
