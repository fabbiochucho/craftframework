import { getStore } from '@netlify/blobs'
import { and, desc, eq, inArray, isNotNull, lt, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { benchmarkSnapshots, ccaAssessments, organizations, validations } from '../../db/schema.js'
import { dashboard, effectiveNotAssessed, type CcaModule } from '../../src/lib/cca/engine.js'
import { CCA_MODULES, contentProblems } from '../../src/lib/cca/modules.js'
import { computeBenchmarks, type BenchmarkData, type BenchmarkInput } from '../../src/lib/benchmarks.js'

const CCA_STORE = 'cca-private' // the private module content (netlify/functions/cca.mts)
const KEEP = 30

/** Recompute the public benchmarks from opted-in organisations and store a snapshot. Aggregates only leave this file. */
export async function refreshBenchmarks(now = new Date()): Promise<BenchmarkData> {
  const content = await getStore(CCA_STORE).get('modules', { type: 'json' }) as CcaModule[] | null
  const modules = content && !contentProblems(content).length ? content : []
  const orgs = await db.select().from(organizations).where(and(isNotNull(organizations.benchmarkOptInAt), eq(organizations.status, 'active')))
  const ids = orgs.map((o) => o.id)
  const done = ids.length ? await db.select().from(ccaAssessments).where(and(inArray(ccaAssessments.orgId, ids), eq(ccaAssessments.status, 'complete'))) : []
  const validated = new Set(ids.length ? (await db.select({ orgId: validations.orgId }).from(validations)
    .where(and(inArray(validations.orgId, ids), eq(validations.status, 'current'), ne(validations.outcome, 'not_validated')))).map((v) => v.orgId) : [])
  // Latest completed assessment per organisation and module (by year, then completion).
  const latest = new Map<string, (typeof done)[number]>()
  for (const a of done) {
    const k = `${a.orgId}|${a.module}`
    const prev = latest.get(k)
    if (!prev || a.year > prev.year || (a.year === prev.year && (a.completedAt?.getTime() ?? 0) > (prev.completedAt?.getTime() ?? 0))) latest.set(k, a)
  }
  const byOrg = new Map(orgs.map((o) => [o.id, o]))
  const rows: BenchmarkInput[] = []
  for (const a of latest.values()) {
    const mod = modules.find((m) => m.id === a.module)
    const org = byOrg.get(a.orgId)
    if (!mod || !org) continue
    const d = dashboard(mod, a.responses ?? {}, effectiveNotAssessed(mod, a.notAssessed ?? {}, a.domainIds))
    if (!d.average) continue
    rows.push({ module: a.module, country: org.country, sector: org.sector ?? '', archetype: org.archetype ?? '', size: org.sizeBand ?? '', validated: validated.has(org.id), average: d.average })
  }
  const data = computeBenchmarks(rows, CCA_MODULES.map((m) => ({ id: m.id, name: m.name })), now)
  const [saved] = await db.insert(benchmarkSnapshots).values({ computedAt: now, data }).returning({ id: benchmarkSnapshots.id })
  const [cutoff] = await db.select({ id: benchmarkSnapshots.id }).from(benchmarkSnapshots).orderBy(desc(benchmarkSnapshots.id)).offset(KEEP - 1).limit(1)
  if (cutoff && cutoff.id < saved.id) await db.delete(benchmarkSnapshots).where(lt(benchmarkSnapshots.id, cutoff.id))
  return data
}

export async function latestBenchmarks(): Promise<BenchmarkData | null> {
  const [row] = await db.select().from(benchmarkSnapshots).orderBy(desc(benchmarkSnapshots.id)).limit(1)
  return row?.data ?? null
}
