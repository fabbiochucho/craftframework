import assert from 'node:assert/strict'
import { navProfile, showsLink } from './navProfile.ts'

// Role decides first; an ordinary account follows its start choice; no choice shows everything.
assert.equal(navProfile('super_admin', 'validator'), 'all')
assert.equal(navProfile('admin', null), 'all')
assert.equal(navProfile('independent', 'organisation'), 'independent')
assert.equal(navProfile('portfolio', null), 'funder')
assert.equal(navProfile('assessor', 'network'), 'network')
assert.equal(navProfile('assessor', null), 'all')
assert.equal(navProfile('assessor', null, true), 'organisation')
assert.equal(navProfile('assessor', 'validator', true), 'validator')

// An independent assessor scores and sees evidence, but not the organisation's own finance and disclosure tools.
assert.ok(showsLink('independent', '/assessment') && showsLink('independent', '/verify') && showsLink('independent', '/data-room'))
assert.ok(!showsLink('independent', '/issb-disclosures') && !showsLink('independent', '/finance-triangulation'))
// Validators do not get the organisation workspace; organisations do not get the validator tools.
assert.ok(showsLink('validator', '/panel') && !showsLink('validator', '/cip'))
assert.ok(!showsLink('organisation', '/training') && showsLink('organisation', '/panel') && showsLink('organisation', '/engagements'))
// Everyone keeps the inbox, settings and help; 'all' shows anything.
for (const p of ['organisation', 'independent', 'validator', 'funder', 'network'] as const) assert.ok(showsLink(p, '/inbox') && showsLink(p, '/help'))
assert.ok(showsLink('all', '/anything'))
console.log('navProfile.test.ts: all assertions passed')
