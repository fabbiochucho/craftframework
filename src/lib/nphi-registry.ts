// Verified national public health institutes and their official domains. An organisation that
// registers as an NPHI is verified automatically when the admin's email is on one of these
// domains; otherwise a CRAFT platform operator confirms it manually.
// Only institute-specific domains are listed — never a generic government domain (e.g. gov.gh),
// which would let any civil servant self-verify. Each domain was confirmed on the institute's own
// website on the date shown; `emailSeen` records whether an email address on that domain was shown.
// Self-check: `node src/lib/nphi-registry.test.ts`.

export interface NphiEntry {
  country: string // ISO 3166 alpha-2
  name: string
  website: string
  domains: string[]
  emailSeen: boolean
  checked: string
}

const e = (country: string, name: string, website: string, domains: string[], emailSeen = false): NphiEntry => ({ country, name, website, domains, emailSeen, checked: '2026-10-14' })

export const NPHI_REGISTRY: NphiEntry[] = [
  e('NG', 'Nigeria Centre for Disease Control and Prevention (NCDC)', 'https://ncdc.gov.ng', ['ncdc.gov.ng']),
  e('ZA', 'National Institute for Communicable Diseases (NICD)', 'https://www.nicd.ac.za', ['nicd.ac.za']),
  e('ET', 'Ethiopian Public Health Institute (EPHI)', 'https://ephi.gov.et', ['ephi.gov.et'], true),
  e('ZM', 'Zambia National Public Health Institute (ZNPHI)', 'https://ww2.znphi.co.zm', ['znphi.gov.zm', 'znphi.co.zm'], true),
  e('LR', 'National Public Health Institute of Liberia (NPHIL)', 'https://nphil.gov.lr', ['nphil.gov.lr']),
  e('UG', 'Uganda National Institute of Public Health (UNIPH)', 'https://uniph.go.ug', ['uniph.go.ug']),
  e('RW', 'Rwanda Biomedical Centre (RBC)', 'https://rbc.gov.rw', ['rbc.gov.rw']),
  e('MZ', 'Instituto Nacional de Saúde (INS)', 'https://ins.gov.mz', ['ins.gov.mz']),
  e('SL', 'National Public Health Agency (NPHA)', 'https://npha.gov.sl', ['npha.gov.sl']),
  e('BF', 'Institut National de Santé Publique (INSP)', 'https://www.insp.bf', ['insp.bf'], true),
  e('CD', 'Institut National de Santé Publique (INSP)', 'https://insp.cd', ['insp.cd']),
  e('CI', 'Institut National d’Hygiène Publique (INHP)', 'https://www.inhp.ci', ['inhp.ci'], true),
]
// Known NPHIs without a confirmed institute domain (verified manually): Kenya (KNPHI), Burundi (INSP), and others.

export const emailDomain = (email: string) => email.trim().toLowerCase().split('@')[1] ?? ''

/** The registry entry whose domain matches the email (exact domain or a subdomain of it). */
export function nphiForEmail(email: string): (NphiEntry & { matchedDomain: string }) | null {
  const d = emailDomain(email)
  if (!d) return null
  for (const entry of NPHI_REGISTRY) {
    const m = entry.domains.find((x) => d === x || d.endsWith(`.${x}`))
    if (m) return { ...entry, matchedDomain: m }
  }
  return null
}

export type TypeVerification = 'not_required' | 'pending' | 'verified' | 'rejected'
