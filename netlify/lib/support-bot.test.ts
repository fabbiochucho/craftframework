import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifySupportMessage, isPrivateReport, rankSupportFaq, redactSupportMessage, supportDeduplicationKey } from './support-bot.ts'
import { grantAllows } from './access-policy.ts'
import { financeMutationError } from './finance-policy.ts'
import { sendReminderEmail } from './reminder-email.ts'

describe('support bot classification and FAQ ranking', () => {
  it('classifies bug, feature, and question messages deterministically', () => {
    assert.equal(classifySupportMessage('The dashboard crashes with an error').type, 'bug')
    assert.equal(classifySupportMessage('Please add a feature to export reports').type, 'feature')
    assert.equal(classifySupportMessage('How do I get started?').type, 'question')
    assert.equal(classifySupportMessage('How do I add a workspace?').type, 'question')
    assert.deepEqual(classifySupportMessage('The dashboard crashes with an error'), classifySupportMessage('The dashboard crashes with an error'))
  })

  it('ranks the most relevant FAQ and returns no match below its threshold', () => {
    assert.match(rankSupportFaq('How do I install and run this locally?')?.answer ?? '', /Getting Started/)
    assert.equal(rankSupportFaq('Something completely unrelated'), null)
  })

  it('routes conduct and security reports privately and redacts common PII and secrets', () => {
    assert.equal(isPrivateReport('I need to report harassment'), true)
    assert.equal(isPrivateReport('I need to report a conduct issue'), true)
    assert.equal(isPrivateReport('I need to report a security vulnerability'), true)
    assert.equal(isPrivateReport('This report is confidential'), true)
    assert.equal(isPrivateReport('The installation fails'), false)
    const redacted = redactSupportMessage('Email me at person@example.com; api_key=abc123 and https://private.example/data')
    assert.ok(!redacted.includes('person@example.com'))
    assert.ok(!redacted.includes('abc123'))
    assert.ok(!redacted.includes('private.example'))
  })

  it('creates stable deduplication keys without retaining identifying input', () => {
    assert.equal(
      supportDeduplicationKey('question', 'Help me: user@example.com'),
      supportDeduplicationKey('question', 'Help me: [redacted email]'),
    )
    assert.notEqual(supportDeduplicationKey('bug', 'same text'), supportDeduplicationKey('question', 'same text'))
    assert.notEqual(supportDeduplicationKey('bug', 'same text', 1, 2), supportDeduplicationKey('bug', 'same text', 1, 3))
    assert.notEqual(supportDeduplicationKey('bug', 'same text'), supportDeduplicationKey('bug', 'same text', 1, 2))
  })
})

describe('legacy access and finance boundary policies', () => {
  it('denies expired, revoked, read-only and unbounded specialized writes', () => {
    const now = new Date('2026-10-10T00:00:00Z')
    const grant = { status: 'active', level: 'read', role: null, expiresAt: null }
    assert.equal(grantAllows(grant, 'read', now), true)
    assert.equal(grantAllows(grant, 'write', now), false)
    assert.equal(grantAllows({ ...grant, level: 'write' }, 'write', now), true)
    assert.equal(grantAllows({ ...grant, expiresAt: now }, 'read', now), false)
    assert.equal(grantAllows({ ...grant, status: 'revoked' }, 'read', now), false)
    assert.equal(grantAllows({ ...grant, role: 'cbn_examiner' }, 'read', now), false)
    assert.equal(grantAllows({ ...grant, level: 'write', role: 'cbn_examiner', expiresAt: new Date('2027-01-01') }, 'write', now), false)
  })

  describe('reminder provider acceptance', () => {
    it('requires an operator-configured production sender and does not count rejected or failed requests as sent', async () => {
      const savedKey = process.env.RESEND_API_KEY
      const savedFrom = process.env.REMINDER_FROM_EMAIL
      const savedInvite = process.env.INVITE_FROM_EMAIL
      const originalFetch = globalThis.fetch
      let calls = 0
      let status = 403
      globalThis.fetch = async () => { calls++; return new Response('{}', { status }) }
      try {
        process.env.RESEND_API_KEY = 'test-provider'
        delete process.env.REMINDER_FROM_EMAIL
        delete process.env.INVITE_FROM_EMAIL
        const email = { to: 'recipient@example.com', subject: 'Reminder', text: 'Reminder' }
        assert.equal(await sendReminderEmail(email), 'not_configured')
        process.env.REMINDER_FROM_EMAIL = 'CRAFT <onboarding@resend.dev>'
        assert.equal(await sendReminderEmail(email), 'not_configured')
        assert.equal(calls, 0)
        process.env.REMINDER_FROM_EMAIL = 'CRAFT <notifications@example.com>'
        assert.equal(await sendReminderEmail(email), 'failed')
        status = 200
        assert.equal(await sendReminderEmail(email), 'accepted')
        globalThis.fetch = async () => { throw new Error('network unavailable') }
        assert.equal(await sendReminderEmail(email), 'failed')
      } finally {
        globalThis.fetch = originalFetch
        for (const [key, value] of [['RESEND_API_KEY', savedKey], ['REMINDER_FROM_EMAIL', savedFrom], ['INVITE_FROM_EMAIL', savedInvite]] as const) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }
    })
  })

  it('allows only server-assigned workflow roles and sequential transitions', () => {
    assert.equal(financeMutationError('org_finance_officer', null, { status: 'pending_review', expenditures: 50 }), null)
    assert.ok(financeMutationError('admin', null, { status: 'locked' }))
    assert.ok(financeMutationError('org_finance_officer', null, { status: 'locked' }))
    assert.equal(financeMutationError('org_grant_manager', { status: 'pending_review' }, { status: 'pending_assessor', grantManagerCommentary: 'Reviewed' }), null)
    assert.ok(financeMutationError('org_grant_manager', { status: 'pending_review', expenditures: 50 }, { expenditures: 60 }))
    assert.equal(financeMutationError('independent_assessor', { status: 'pending_assessor' }, { status: 'locked', assessorNotes: 'Verified' }), null)
    assert.ok(financeMutationError('independent_assessor', { status: 'locked' }, { status: 'draft' }))
    assert.ok(financeMutationError('org_finance_officer', { status: 'draft', donorId: 'donor-a' }, { donorId: 'donor-b' }))
  })
})
