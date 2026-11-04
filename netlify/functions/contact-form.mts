// Runs when Netlify Forms accepts a contact-form submission (Netlify signs and verifies the event, so it cannot be
// called from outside). Each message becomes a ticket in the support tracker (Admin → Support); Netlify still sends
// its usual notification email.
import type { FormSubmittedEvent } from '@netlify/functions'
import { db } from '../../db/index.js'
import { openTicket } from '../lib/support-tickets.js'
import { logger } from '../lib/logger.js'

export async function contactSubmitted(data: Record<string, string>) {
  if ((data['form-name'] ?? 'contact') !== 'contact' || data['bot-field']) return
  const message = (data.message ?? '').trim().slice(0, 5000)
  if (!message) return
  const email = (data.email ?? '').trim().slice(0, 254)
  await openTicket(db, {
    subject: message.split('\n')[0].slice(0, 90), body: message, source: 'contact_form',
    contactName: (data.name ?? '').slice(0, 200), contactEmail: /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) ? email : '',
    organisation: data.organization ?? '',
  })
}

export default {
  async formSubmitted(event: FormSubmittedEvent) {
    try {
      await contactSubmitted(event.data)
    } catch (err) {
      logger.error('contact-form', 'could not add the message to the support tracker', err)
    }
  },
}
