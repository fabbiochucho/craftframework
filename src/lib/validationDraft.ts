import { z } from 'zod'

export const validationDraftSchema = z.object({
  validatorName: z.string().max(200),
  validatorOrganisation: z.string().max(200),
  scope: z.string().max(2000),
  method: z.enum(['document_review', 'sample_testing', 'interviews', 'site_visit', 'combined']),
  outcome: z.enum(['validated', 'validated_with_qualifications', 'not_validated']),
  notes: z.string().max(4000),
  rescore: z.record(z.string().max(100), z.object({
    score: z.enum(['', '1', '2', '3', '4', '5']),
    evidence: z.boolean(),
    comment: z.string().max(1000),
  }).strict()),
}).strict()

export type ValidationDraft = z.infer<typeof validationDraftSchema>
export const emptyValidationDraft = (): ValidationDraft => ({
  validatorName: '', validatorOrganisation: '', scope: '', method: 'document_review',
  outcome: 'validated', notes: '', rescore: {},
})
