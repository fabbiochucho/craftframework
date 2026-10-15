// Runs before Netlify Identity creates an account. Email sign-ups must carry a valid Cloudflare
// Turnstile token (set by the Register form); Google and GitHub sign-ups are already behind the
// provider's own checks. The token is removed from the stored user metadata.
import type { UserValidateEvent } from '@netlify/functions'
import { verifyTurnstile } from '../lib/turnstile.js'
import { logger } from '../lib/logger.js'

export default {
  async userValidate(event: UserValidateEvent) {
    const { turnstile_token: token, ...userMetadata } = event.user.userMetadata ?? {}
    const secret = process.env.TURNSTILE_SECRET_KEY
    if ((event.user.provider ?? 'email') === 'email' && secret) {
      const result = await verifyTurnstile(token, secret)
      // ponytail: fails open if Cloudflare is unreachable, so an outage does not stop all sign-ups.
      if (result === 'fail') return event.deny()
      if (result === 'unavailable') logger.error('identity-validate', 'Turnstile unavailable; sign-up allowed')
    }
    return { user: { userMetadata } }
  },
}
