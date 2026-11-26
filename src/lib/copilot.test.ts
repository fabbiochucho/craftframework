// Level 1 of the Copilot's pre-deployment tests: retrieval accuracy. Each gold case names the template that must come
// first (or none), so a change to matching that pulls the wrong document fails here before any model is involved.
import assert from 'node:assert/strict'
import { retrieve, systemPrompt, NOT_COVERED, type ActionTemplate } from './copilot.ts'

const t = (id: number, over: Partial<ActionTemplate>): ActionTemplate => ({
  id, title: `T${id}`, kind: 'sop', domains: [], keywords: [], archetypes: [], countries: [], body: 'x', source: 's', status: 'approved', ...over,
})
const library = [
  t(1, { title: 'Procurement committee SOP', domains: ['fin.3'], keywords: ['procurement'] }),
  t(2, { title: 'Board charter (CSO)', domains: ['gov.1'], keywords: ['board', 'governance'], archetypes: ['Civil Society'] }),
  t(3, { title: 'Board charter (public body)', domains: ['gov.1'], keywords: ['board'], archetypes: ['Public'] }),
  t(4, { title: 'Nigeria procurement SOP', keywords: ['procurement'], countries: ['NG'] }),
  t(5, { title: 'Unapproved draft', domains: ['fin.3'], status: 'draft' }),
  t(6, { title: 'Retired charter', domains: ['gov.1'], status: 'retired' }),
  t(7, { title: 'Cash handling SOP', keywords: ['cash', 'petty'] }),
]

const gold: Array<[string, Parameters<typeof retrieve>[1], string | null]> = [
  ['exact domain id wins', { domainId: 'fin.3', domainName: 'Procurement', archetype: 'Private', country: 'KE' }, 'Procurement committee SOP'],
  ['organisation type filters charters', { domainId: 'gov.1', domainName: 'Board oversight', archetype: 'Civil Society', country: 'KE' }, 'Board charter (CSO)'],
  ['public body gets the public charter', { domainId: 'gov.1', domainName: 'Board oversight', archetype: 'Public', country: 'GH' }, 'Board charter (public body)'],
  ['keyword match when no id', { domainId: 'fin.9', domainName: 'Petty cash controls', archetype: 'Private', country: 'KE' }, 'Cash handling SOP'],
  ['country-specific beats generic on keywords', { domainId: 'fin.8', domainName: 'Procurement planning', archetype: 'Private', country: 'NG' }, 'Nigeria procurement SOP'],
  ['nothing relevant: route to an expert', { domainId: 'hr.2', domainName: 'Staff appraisal', archetype: 'Private', country: 'KE' }, null],
]
for (const [name, gap, want] of gold) assert.equal(retrieve(library, gap)[0]?.title ?? null, want, name)

assert.ok(!retrieve(library, { domainId: 'fin.3', domainName: 'Procurement', archetype: '', country: '' }).some((x) => x.status !== 'approved'), 'only approved templates')
assert.ok(retrieve(library, { domainId: 'fin.3', domainName: 'Procurement planning procurement', archetype: '', country: 'NG' }).length <= 3)
assert.ok(systemPrompt().includes(NOT_COVERED))
console.log('copilot retrieval ok')
