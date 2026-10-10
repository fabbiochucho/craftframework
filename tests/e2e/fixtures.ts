import { test as base, expect, type BrowserContext, type Page, type Route } from '@playwright/test'

const API_ORIGIN = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8899}`
const WEB_ORIGIN = `http://localhost:${process.env.E2E_WEB_PORT ?? 3000}`
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

// Unsigned, runtime-generated session token. Only the test API server reads it;
// the production function verifies real Netlify Identity sessions instead.
function fakeSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: `e2e-${email}`, email, exp })}.`
  return { token, exp }
}

/** Installs the test-only sign-in (browser session + /api forwarding) for one user. */
export async function signInAs(context: BrowserContext, email: string) {
  const { token, exp } = fakeSession(email)
  await context.addCookies([{ name: 'nf_jwt', value: token, url: WEB_ORIGIN }])
  await context.addInitScript(([e, t, x]) => {
    localStorage.setItem('gotrue.user', JSON.stringify({
      url: `${location.origin}/.netlify/identity`,
      token: { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: (x as number) * 1000, refresh_token: 'e2e-placeholder' },
      id: `e2e-${e}`, email: e, aud: '', role: '', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'E2E User' },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }))
  }, [email, token, exp] as const)
}

export const test = base.extend<{ signedIn: Page; apiRoutes: void }>({
  apiRoutes: [async ({ context }, use) => {
    // Only this test fixture redirects APIs; deployed bundles retain normal auth.
    await context.route(/\/api\//, async (route: Route) => {
      const req = route.request()
      const url = new URL(req.url())
      const response = await route.fetch({ url: `${API_ORIGIN}${url.pathname}${url.search}`, headers: await req.allHeaders() })
      await route.fulfill({ response })
    })
    await use()
  }, { auto: true }],
  signedIn: async ({ page, context, request }, use) => {
    const reset = await request.post(`${API_ORIGIN}/__test/reset`)
    expect(reset.status()).toBe(204)
    await signInAs(context, 'owner@acme.example')
    await use(page)
  },
})
export { expect }
