import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifySupportMessage, isPrivateReport, rankSupportFaq, redactSupportMessage, supportDeduplicationKey } from './support-bot.ts'

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
  })
})
