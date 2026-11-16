import { and, eq, inArray, ne, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accessGrants, engagementMembers, networkAdmins, networkMembers, organizations, users, validationEngagements } from '../../db/schema.js'
import type { Caller } from './auth.js'

export type Contact = { email: string; name: string }

/**
 * The people a caller may message: only those they already work with, so the inbox cannot be used to
 * write to strangers. That is anyone who shares
 *   - an organisation: its staff, its contact address, and everyone it has granted active access
 *     (the caller's own organisation plus the organisations that granted the caller access);
 *   - a validation engagement: its named members, validator and creator;
 *   - a network level: its coordinators and the organisations that are members of it.
 */
export async function contactsOf(caller: Caller): Promise<Contact[]> {
  const found = new Set<string>()
  const add = (e: string | null | undefined) => { const v = e?.trim().toLowerCase(); if (v && v.includes('@')) found.add(v) }

  // Network levels the caller coordinates, or that their organisation belongs to.
  const [adminNodes, memberNodes] = await Promise.all([
    db.select({ nodeId: networkAdmins.nodeId }).from(networkAdmins).where(eq(networkAdmins.email, caller.email)),
    db.select({ nodeId: networkMembers.nodeId }).from(networkMembers).where(and(eq(networkMembers.orgId, caller.orgId), eq(networkMembers.status, 'active'))),
  ])
  const coordinated = adminNodes.map((n) => n.nodeId)
  const nodeIds = [...new Set([...coordinated, ...memberNodes.map((n) => n.nodeId)])]
  if (nodeIds.length) (await db.select({ email: networkAdmins.email }).from(networkAdmins).where(inArray(networkAdmins.nodeId, nodeIds))).forEach((r) => add(r.email))
  const networkOrgIds = coordinated.length
    ? (await db.select({ orgId: networkMembers.orgId }).from(networkMembers).where(and(inArray(networkMembers.nodeId, coordinated), eq(networkMembers.status, 'active')))).map((r) => r.orgId)
    : []

  // Organisations: the caller's own, those that granted them access, and members of levels they coordinate.
  const granted = await db.select({ orgId: accessGrants.orgId }).from(accessGrants).where(and(eq(accessGrants.grantee, caller.email), eq(accessGrants.status, 'active')))
  const orgIds = [...new Set([caller.orgId, ...granted.map((g) => g.orgId), ...networkOrgIds])]
  const [staff, orgRows, grantees] = await Promise.all([
    db.select({ email: users.email }).from(users).where(inArray(users.orgId, orgIds)),
    db.select({ email: organizations.email, createdBy: organizations.createdBy }).from(organizations).where(inArray(organizations.id, orgIds)),
    db.select({ email: accessGrants.grantee }).from(accessGrants).where(and(inArray(accessGrants.orgId, orgIds), eq(accessGrants.status, 'active'))),
  ])
  staff.forEach((r) => add(r.email)); grantees.forEach((r) => add(r.email))
  orgRows.forEach((r) => { add(r.email); add(r.createdBy) })

  // Validation engagements the caller is part of.
  const mine = await db.select({ id: engagementMembers.engagementId }).from(engagementMembers).where(and(eq(engagementMembers.email, caller.email), ne(engagementMembers.status, 'removed')))
  const engagements = await db.select({ id: validationEngagements.id, validatorEmail: validationEngagements.validatorEmail, createdBy: validationEngagements.createdBy })
    .from(validationEngagements)
    .where(or(eq(validationEngagements.orgId, caller.orgId), eq(validationEngagements.validatorEmail, caller.email), eq(validationEngagements.createdBy, caller.email), ...(mine.length ? [inArray(validationEngagements.id, mine.map((m) => m.id))] : [])))
  engagements.forEach((e) => { add(e.validatorEmail); add(e.createdBy) })
  if (engagements.length) {
    (await db.select({ email: engagementMembers.email }).from(engagementMembers)
      .where(and(inArray(engagementMembers.engagementId, engagements.map((e) => e.id)), ne(engagementMembers.status, 'removed')))).forEach((r) => add(r.email))
  }

  found.delete(caller.email)
  if (!found.size) return []
  const names = new Map((await db.select({ email: users.email, name: users.name }).from(users).where(inArray(users.email, [...found]))).map((u) => [u.email, u.name.trim()]))
  return [...found].map((email) => ({ email, name: names.get(email) || email })).sort((a, b) => a.name.localeCompare(b.name))
}
