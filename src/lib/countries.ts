// Countries offered in onboarding, settings and the data room: every jurisdiction the laws register covers except the EU
// (not a country). The ten long-standing options stay first; the rest follow alphabetically. Codes match the register
// (`UK` for the United Kingdom, flag from GB).
import { AFRICA_COUNTRIES } from './africa-countries.ts'

export interface Country {
  code: string
  name: string
  flag: string
}

const flagOf = (iso2: string) => String.fromCodePoint(...[...(iso2 === 'UK' ? 'GB' : iso2)].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
const FIRST = ['NG', 'KE', 'RW', 'ZA', 'GH', 'TZ', 'UG', 'ET', 'SN', 'CI']
const NAME_OVERRIDES: Record<string, string> = { CI: "Côte d'Ivoire" }

const all: Country[] = [
  ...AFRICA_COUNTRIES.map((c) => ({ code: c.iso2, name: NAME_OVERRIDES[c.iso2] ?? c.name, flag: flagOf(c.iso2) })),
  { code: 'UK', name: 'United Kingdom', flag: flagOf('UK') },
  { code: 'US', name: 'United States', flag: flagOf('US') },
]

export const COUNTRIES: Country[] = [
  ...FIRST.map((code) => all.find((c) => c.code === code)!),
  ...all.filter((c) => !FIRST.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name)),
]
