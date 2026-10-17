// Self-check — run directly with `node src/lib/analyticsScrub.test.ts`.
import assert from 'node:assert/strict'
import { filterEvent, sanitizeText, sanitizeUrl, scrubProperties, stripQuery, type EventContext } from './analyticsScrub.ts'

const ctx = (pathname: string, over: Partial<EventContext> = {}): EventContext => ({ analytics: true, replay: false, support: false, pathname, ...over })
const ev = (event: string, properties: Record<string, unknown> = {}) => ({ event, properties: { token: 't', distinct_id: 'abc', ...properties } })

// URLs lose query strings and fragments; ids collapse to the route pattern
assert.equal(stripQuery('https://x.test/a?b=1#c'), 'https://x.test/a')
assert.equal(sanitizeUrl('https://craft.test/directory?q=jane%40example.com'), 'https://craft.test/directory')
assert.equal(sanitizeUrl('https://craft.test/directory/validators/abc123?x=1#y'), 'https://craft.test/directory/$kind/$id')
assert.equal(sanitizeUrl('/validation/CRAFT-V-1?token=s'), '/validation/$verificationId')
assert.equal(sanitizeUrl('https://elsewhere.example/path?utm_source=x'), 'https://elsewhere.example/path')

// Emails and embedded URLs inside text
assert.equal(sanitizeText('Failed for jane.doe+x@example.co.uk now'), 'Failed for [email] now')
assert.equal(sanitizeText('at https://craft.test/auth?code=SECRET:1:2'), 'at https://craft.test/auth')
assert.equal(sanitizeText('see /accept/abc?token=zzz ok'), 'see /accept/abc ok')

// Pageview on an allowed page: query stripped, email dropped, campaign params and titles removed
const pv = filterEvent(ev('$pageview', {
  $current_url: 'https://craft.test/directory?email=a@b.com&utm_source=mail', $pathname: '/directory', $referrer: 'https://google.com/search?q=secret',
  $title: 'Jane Doe — Organisation', utm_source: 'mail', $initial_utm_campaign: 'x', $browser: 'Chrome',
}), ctx('/directory'))!
assert.equal(pv.properties.$current_url, 'https://craft.test/directory')
assert.equal(pv.properties.$referrer, 'https://google.com/search')
assert.equal(pv.properties.$browser, 'Chrome')
for (const k of ['$title', 'utm_source', '$initial_utm_campaign']) assert.ok(!(k in pv.properties), k)
assert.ok(!JSON.stringify(pv).includes('@'))

// Autocapture: visible text and attribute values never leave
const ac = filterEvent(ev('$autocapture', {
  $el_text: 'Send to jane@example.com', $event_type: 'click',
  $elements: [{ tag_name: 'button', $el_text: 'Save my notes', attr__value: 'secret', attr__class: 'btn', nth_child: 1 }],
  $elements_chain: 'button.btn:attr__class="btn"nth-child="1"text="Save my notes"attr__value="secret"attr__href="/a?b=1"',
}), ctx('/auth'))!
assert.ok(!('$el_text' in ac.properties))
const el = (ac.properties.$elements as Record<string, unknown>[])[0]
assert.deepEqual(Object.keys(el).sort(), ['attr__class', 'nth_child', 'tag_name'])
assert.ok(!String(ac.properties.$elements_chain).includes('Save my notes'))
assert.ok(!String(ac.properties.$elements_chain).includes('secret'))

// Free text and unknown properties on funnel events are dropped; only the schema survives
const search = filterEvent(ev('directory_search', { type: 'validators', has_results: true, q: 'jane doe', country: 'Kenya', $current_url: 'https://craft.test/directory?q=jane' }), ctx('/directory'))!
assert.deepEqual(search.properties.type, 'validators')
assert.equal(search.properties.has_results, true)
assert.ok(!('q' in search.properties) && !('country' in search.properties))
assert.equal(search.properties.$current_url, 'https://craft.test/directory')
assert.deepEqual(filterEvent(ev('directory_search', { type: 'a free text query', has_results: 'yes' }), ctx('/directory'))!.properties, { token: 't', distinct_id: 'abc' })
assert.equal(filterEvent(ev('onboarding_step_completed', { step: 'identity' }), ctx('/onboarding'))!.properties.step, 'identity')
assert.ok(!('step' in filterEvent(ev('onboarding_step_completed', { step: 'Acme Ltd, Lagos' }), ctx('/onboarding'))!.properties))
assert.ok(!('step' in filterEvent(ev('onboarding_step_completed', { step: 'a@b.co' }), ctx('/onboarding'))!.properties))
assert.equal(filterEvent(ev('training_module_completed', { module: 'm3', answers: [1, 2] }), ctx('/training/module/m3'))!.properties.answers, undefined)

// Funnel milestones from a sensitive page carry no location at all
const eng = filterEvent(ev('engagement_created', { orgId: 7, $current_url: 'https://craft.test/engagements/9?x=1', $pathname: '/engagements/9', $referrer: 'https://craft.test/panel', $title: 'Acme' }), ctx('/engagements'))!
assert.equal(eng.event, 'engagement_created')
assert.deepEqual(Object.keys(eng.properties).sort(), ['distinct_id', 'token'])

// Nothing else is sent from sensitive pages; replay events need replay consent
for (const path of ['/assessment', '/evidence', '/app/workspaces/1/evidence', '/engagements', '/dashboard', '/admin', '/anything-unknown']) {
  for (const name of ['$pageview', '$pageleave', '$autocapture', '$web_vitals', '$exception', '$$heatmap', '$identify', '$snapshot', '$rageclick']) {
    assert.equal(filterEvent(ev(name), ctx(path, { replay: true })), null, `${name} on ${path}`)
  }
}
assert.equal(filterEvent(ev('$snapshot'), ctx('/directory')), null)
assert.ok(filterEvent(ev('$snapshot'), ctx('/directory', { replay: true })))
assert.equal(filterEvent(ev('$rageclick'), ctx('/directory')), null)
assert.equal(filterEvent(ev('some_custom_event'), ctx('/directory')), null)

// Nothing without consent
assert.equal(filterEvent(ev('$pageview'), ctx('/directory', { analytics: false })), null)
assert.equal(filterEvent(ev('signed_up'), ctx('/auth', { analytics: false })), null)

// Support events keep their own narrower rules
const sup = filterEvent(ev('support_issue_created', { category: 'bug', privacy_level: 'public', $current_url: 'x', message: 'hi a@b.co' }), ctx('/help', { analytics: false, support: true }))!
assert.deepEqual(sup.properties, { token: 't', distinct_id: 'abc', category: 'bug', privacy_level: 'public', $process_person_profile: false })
assert.equal(filterEvent(ev('support_issue_created'), ctx('/help', { analytics: true, support: false })), null)
assert.equal(filterEvent(ev('support_issue_created'), ctx('/assessment', { support: true })), null)

// Exceptions: message and stack only, without URLs' queries or emails
const exc = filterEvent(ev('$exception', {
  $exception_list: [{ type: 'Error', value: 'Bad input jane@example.com', stacktrace: { frames: [{ filename: 'https://craft.test/assets/a.js?v=3', lineno: 4, function: 'f' }] } }],
  $current_url: 'https://craft.test/auth?code=1',
}), ctx('/auth'))!
const list = exc.properties.$exception_list as any[]
assert.equal(list[0].value, 'Bad input [email]')
assert.equal(list[0].stacktrace.frames[0].filename, 'https://craft.test/assets/a.js')

// Heatmaps keep only trackable pages, keyed by route pattern
const hm = filterEvent(ev('$$heatmap', { $heatmap_data: {
  'https://craft.test/directory?q=x': [{ x: 1, y: 2 }], 'https://craft.test/assessment': [{ x: 9, y: 9 }], 'https://craft.test/directory/validators/1': [{ x: 3, y: 4 }],
} }), ctx('/directory'))!
assert.deepEqual(Object.keys(hm.properties.$heatmap_data as object).sort(), ['https://craft.test/directory', 'https://craft.test/directory/$kind/$id'])

// Identify: person properties limited to role, country, language
const idEvent = filterEvent({ ...ev('$identify'), $set: { role: 'assessor', country: 'Kenya', language: 'en', email: 'a@b.co', name: 'Jane', org: 'Acme' } }, ctx('/auth'))!
assert.deepEqual(idEvent.$set, { role: 'assessor', country: 'Kenya', language: 'en' })
assert.deepEqual(filterEvent({ ...ev('$identify'), $set: { role: 'a@b.co' } }, ctx('/auth'))!.$set, undefined)
assert.ok(!('$set_once' in filterEvent(ev('$pageview', { $set_once: { $initial_current_url: 'https://craft.test/?a=b' } }), ctx('/'))!.properties))

// scrubProperties directly
assert.deepEqual(scrubProperties({ $current_url: 'https://craft.test/assessment?a=1', $browser: 'x' }, { routeClass: 'sensitive' }), { $browser: 'x' })
assert.equal(filterEvent(null, ctx('/')), null)

console.log('analyticsScrub.test.ts: all assertions passed')
