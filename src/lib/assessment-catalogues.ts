// Registry of catalogue-based assessments (scored item by item with catalogueScore) and which
// organisation types may use them. Health-security types are limited to NPHIs and subnational
// governments; the public-sector performance assessment to public bodies.
import { CATALOGUES, HEALTH_SECURITY_LABELS, HEALTH_SECURITY_TYPES, healthSecurityTypesFor, type Catalogue } from './health-security.ts'
import { PSP } from './public-sector.ts'

export const ASSESSMENT_CATALOGUES: Record<string, Catalogue> = { ...CATALOGUES, PSP }
export const catalogueByType = (type: string): Catalogue | null => ASSESSMENT_CATALOGUES[type] ?? null

export const PUBLIC_BODY_ORG_TYPES = ['government', 'subnational', 'nphi']
export const RESTRICTED_TYPES = [...HEALTH_SECURITY_TYPES, 'PSP'] as const
export const RESTRICTED_LABELS: Record<string, string> = { ...HEALTH_SECURITY_LABELS, PSP: 'Public-sector performance (APRM, performance system, PEFA, OECD-DAC, Agenda 2063)' }

/** Assessment types an organisation may use. NPHI-only types need a verified NPHI. */
export const assessmentTypesFor = (orgType: string, nphiVerified = true): string[] =>
  [...(PUBLIC_BODY_ORG_TYPES.includes(orgType) ? ['PSP'] : []), ...(orgType === 'nphi' && !nphiVerified ? [] : healthSecurityTypesFor(orgType))]
