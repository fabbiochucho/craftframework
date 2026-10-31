// Every English string in the network assessments and network screens' fixed labels, for professional translation:
// the CRAFT team downloads them per language, a translator corrects the machine translation, and the reviewed file is
// uploaded back (reviewed translations win everywhere). Self-check: `node src/lib/networkStrings.test.ts`.
import { CRAFT_ONC } from './indices/craftOnc.ts'
import { NETWORK_CAPACITY } from './indices/networkCapacity.ts'
import type { FoundationModule } from './foundationModules.ts'
import { LEVEL_LABEL, SHARING_LABEL } from './networks.ts'
import { PERSPECTIVE_LABEL } from './networkRounds.ts'
import { SERVICE_LABEL } from './networkResults.ts'
import { EXCHANGE_LABEL } from './networkExchange.ts'
import { BAND_LABEL, COMPONENT_LABEL, ITEM_SCALE, TEMPLATES } from './programmeScorecard.ts'
import { MATURITY_LEVELS } from './indices/craftOnc.ts'

function moduleStrings(m: FoundationModule): (string | undefined)[] {
  return [
    m.title, m.question, m.intro, m.lensTitle, m.lensBlurb,
    ...m.dimensions.flatMap((d) => [d.name, d.question]),
    ...m.indicators.flatMap((i) => [i.domain, i.question, ...Object.values(i.soe), i.evidence, i.recommendation, i.whyItMatters]),
    ...m.bands.flatMap((b) => [b.label, b.summary]),
    ...m.lenses.flatMap((l) => [l.name, l.description]),
  ]
}

/** Unique strings, in a stable order. */
export function networkStrings(): string[] {
  const all = [
    ...moduleStrings(CRAFT_ONC), ...moduleStrings(NETWORK_CAPACITY),
    ...Object.values(LEVEL_LABEL), ...Object.values(SHARING_LABEL), ...Object.values(PERSPECTIVE_LABEL),
    ...Object.values(SERVICE_LABEL), ...Object.values(EXCHANGE_LABEL), ...Object.values(BAND_LABEL), ...Object.values(COMPONENT_LABEL),
    ...ITEM_SCALE.map((s) => s.label), ...MATURITY_LEVELS,
    ...TEMPLATES.flatMap((t) => [t.name, ...t.areas.flatMap((a) => [a.name, ...Object.values(a.items).flatMap((list) => (list ?? []).map((i) => i.text))])]),
  ]
  return [...new Set(all.map((s) => s?.trim() ?? '').filter(Boolean))]
}

// ---- CSV (RFC 4180) for the translator round trip ----
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}
