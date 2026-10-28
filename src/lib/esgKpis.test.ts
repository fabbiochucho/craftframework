// Self-check: `node src/lib/esgKpis.test.ts` — ESG KPI calculator.
import assert from 'node:assert/strict'
import { ESG_KPIS, computeKpi, computeAll, esgKpiNarrativeBlocks, type KpiInputs } from './esgKpis.ts'

// Thirteen KPIs across E, S and G, each with a formula, units and a boundary note
assert.equal(ESG_KPIS.length, 13)
assert.deepEqual([...new Set(ESG_KPIS.map((k) => k.pillar))], ['E', 'S', 'G'])
assert.ok(ESG_KPIS.every((k) => k.formula && k.unit && k.note))
assert.ok(!ESG_KPIS.some((k) => /diversity ratio/i.test(k.name)), 'women ÷ employees is a gender measure, not diversity')

const v = (id: string, i: KpiInputs) => computeKpi(id, i)
// GHG intensity records the Scope 2 method used
assert.equal(v('ghg-intensity', { scope1: 1200, scope2: 800, revenue: 4 }), 500)
assert.equal(ESG_KPIS.find((k) => k.id === 'ghg-intensity')!.choices?.scope2Method?.length, 2)
// Waste diversion: incineration is not diversion
assert.equal(v('waste-diversion', { wasteTotal: 100, landfilled: 30, incinerated: 20 }), 50)
// LTIFR: per million hours by default, or per 200,000 hours when stated
assert.equal(v('ltifr', { lostTimeInjuries: 3, hoursWorked: 1_500_000 }), 2)
assert.equal(v('ltifr', { lostTimeInjuries: 3, hoursWorked: 1_500_000, ltifrBasis: 200_000 }), 0.4)
// Year-on-year change is positive for a reduction
assert.equal(v('yoy-reduction', { previousEmissions: 1000, currentEmissions: 900 }), 10)
assert.equal(v('board-independence', { independentDirectors: 4, totalDirectors: 9 }), 44.4)
// Missing or zero denominators give no value, never Infinity or NaN
assert.equal(v('renewable-share', { renewableEnergy: 10, totalEnergy: 0 }), null)
assert.equal(v('turnover', { leavers: 5 }), null)
assert.equal(v('nope', {}), null)

// The narrative section reports only computed KPIs, with the method choices stated
const all = computeAll({ scope1: 1200, scope2: 800, revenue: 4, scope2Method: 'market', wasteTotal: 100, landfilled: 30, incinerated: 20 })
assert.equal(all.filter((r) => r.value !== null).length, 2)
const text = JSON.stringify(esgKpiNarrativeBlocks(all, { scope2Method: 'market' }))
assert.ok(text.includes('market-based'))
assert.ok(text.includes('Waste diversion'))
assert.ok(!text.includes('Board independence'), 'KPIs without data are left out')
console.log('esg kpis: ok')
