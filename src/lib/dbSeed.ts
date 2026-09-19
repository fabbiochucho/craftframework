// ============================================================================
// Database seeding helpers
// ----------------------------------------------------------------------------
// Bridges the canonical in-code definitions (the 450-question master bank in
// data.ts and the obligation templates in obligations.ts) into the Netlify
// Database. Seeding is idempotent: questions are upserted by id, so running it
// repeatedly is safe and keeps the bank in sync with the code.
// ============================================================================

import { db } from '../../db/index.js'
import { questions, type QuestionRow } from '../../db/schema.js'
import { sql } from 'drizzle-orm'
import { MOCK_QUESTIONS, type Question } from './data'

// Map a front-end Question into a questions table row.
function toRow(q: Question): QuestionRow {
  return {
    id: q.id,
    domain: q.domain,
    tier: q.tier,
    tierName: q.tierName ?? '',
    question: q.question,
    insight: q.insight ?? '',
    evidence: q.evidence ?? [],
    verificationMethod: q.verificationMethod ?? '',
    maxScore: q.maxScore ?? 5,
    riskIfWeak: q.riskIfWeak ?? 'Moderate',
    capacityAction: q.capacityAction ?? '',
    donorLink: q.donorLink ?? '',
    nationalLink: q.nationalLink ?? '',
    priority: q.priority ?? 'Moderate',
    riskCategory: q.riskCategory ?? null,
    lens: q.lens ?? null,
    archetypes: q.archetypes ?? [],
    scoringGuide: q.scoringGuide ?? null,
    requiredDataRoomDoc: q.requiredDataRoomDoc ?? null,
  }
}

// Map a DB row back into the front-end Question shape consumed by the UI.
export function rowToQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    domain: r.domain,
    tier: r.tier,
    tierName: r.tierName,
    question: r.question,
    insight: r.insight,
    evidence: r.evidence ?? [],
    verificationMethod: r.verificationMethod,
    score: 0,
    maxScore: r.maxScore,
    riskIfWeak: (r.riskIfWeak as Question['riskIfWeak']) ?? 'Moderate',
    capacityAction: r.capacityAction,
    donorLink: r.donorLink,
    nationalLink: r.nationalLink,
    priority: (r.priority as Question['priority']) ?? 'Moderate',
    riskCategory: r.riskCategory ?? undefined,
    lens: (r.lens as Question['lens']) ?? undefined,
    archetypes: (r.archetypes as Question['archetypes']) ?? undefined,
    scoringGuide: r.scoringGuide ?? undefined,
    requiredDataRoomDoc: r.requiredDataRoomDoc ?? undefined,
  }
}

// Upsert the entire question bank. Returns the number of questions seeded.
export async function seedQuestions(): Promise<number> {
  const rows = MOCK_QUESTIONS.map(toRow)
  // Insert in chunks to stay well under parameter limits.
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    await db
      .insert(questions)
      .values(slice)
      .onConflictDoUpdate({
        target: questions.id,
        set: {
          domain: sql`excluded.domain`,
          tier: sql`excluded.tier`,
          tierName: sql`excluded.tier_name`,
          question: sql`excluded.question`,
          insight: sql`excluded.insight`,
          evidence: sql`excluded.evidence`,
          verificationMethod: sql`excluded.verification_method`,
          maxScore: sql`excluded.max_score`,
          riskIfWeak: sql`excluded.risk_if_weak`,
          capacityAction: sql`excluded.capacity_action`,
          donorLink: sql`excluded.donor_link`,
          nationalLink: sql`excluded.national_link`,
          priority: sql`excluded.priority`,
          riskCategory: sql`excluded.risk_category`,
          lens: sql`excluded.lens`,
          archetypes: sql`excluded.archetypes`,
          scoringGuide: sql`excluded.scoring_guide`,
          requiredDataRoomDoc: sql`excluded.required_data_room_doc`,
        },
      })
  }
  return rows.length
}

// Seed only if the bank is empty - used to lazily populate on first read.
export async function ensureQuestionsSeeded(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
  if (count > 0) return count
  return seedQuestions()
}
