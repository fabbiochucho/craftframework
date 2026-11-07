// Super Admin support mode: the CRAFT team acts on an organisation's behalf (adds evidence, answers an
// evidence request). Nothing is hidden: every action is labelled "CRAFT support", emailed to the
// organisation's contacts and audit-logged, and the organisation can remove anything added.
import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { organizations, users, wsOrganizations, wsOrgMembers } from '../../db/schema.js'
import { decryptField, fieldLookupHashes } from './crypto.js'
import { logger } from './logger.js'
import { sendReminderEmail } from './reminder-email.js'
import type { Caller } from './auth.js'

const memberFilter = (email: string) => {
  const hashes = fieldLookupHashes(email)
  return hashes.length ? or(inArray(wsOrgMembers.userIdHash, hashes), eq(wsOrgMembers.userId, email))! : eq(wsOrgMembers.userId, email)
}
const clean = (l: Array<string | null | undefined>) => [...new Set(l.filter((e): e is string => !!e && /@/.test(e)).map((e) => e.trim().toLowerCase()))]
const safeDecrypt = (v: string) => { try { return decryptField(v) } catch { return '' } }

/** True when the Super Admin is acting on an organisation they are not a member of. */
export async function isSupportAction(caller: Caller, wsOrgId: number): Promise<boolean> {
  if (caller.role !== 'super_admin') return false
  const [m] = await db.select({ id: wsOrgMembers.id }).from(wsOrgMembers).where(and(eq(wsOrgMembers.orgId, wsOrgId), memberFilter(caller.email)))
  return !m
}

/** A workspace organisation's contact email and its owners / admins. */
export async function wsOrgContacts(wsOrgId: number): Promise<string[]> {
  const [org] = await db.select({ contactEmail: wsOrganizations.contactEmail }).from(wsOrganizations).where(eq(wsOrganizations.id, wsOrgId))
  const admins = await db.select({ userId: wsOrgMembers.userId }).from(wsOrgMembers)
    .where(and(eq(wsOrgMembers.orgId, wsOrgId), inArray(wsOrgMembers.role, ['owner', 'admin'])))
  return clean([org ? safeDecrypt(org.contactEmail) : '', ...admins.map((a) => safeDecrypt(a.userId))])
}

/** The workspace organisations run by a (legacy) CRAFT organisation's people: its contact email and staff. */
export async function wsOrgIdsForLegacyOrg(orgId: string): Promise<number[]> {
  const [org] = await db.select({ email: organizations.email }).from(organizations).where(eq(organizations.id, orgId))
  const staff = await db.select({ email: users.email }).from(users).where(eq(users.orgId, orgId))
  const emails = clean([org?.email, ...staff.map((s) => s.email)])
  if (!emails.length) return []
  const rows = await db.selectDistinct({ orgId: wsOrgMembers.orgId }).from(wsOrgMembers).where(or(...emails.map(memberFilter))!)
  return rows.map((r) => r.orgId)
}

/** Tell the organisation what the CRAFT team did on its behalf. Best effort; never fails the action. */
export async function tellSupportAction(to: string[], what: string, link: string, actor: string): Promise<void> {
  if (!to.length) return
  try {
    await sendReminderEmail({
      to,
      subject: 'CRAFT support acted on your behalf',
      text: `The CRAFT support team (${actor}) did the following for your organisation:\n\n${what}\n\nYou can review it, and remove anything you do not want, here:\n${link}\n\nQuestions? Reply to this email.`,
      reply_to: actor,
    }, undefined, 'support_action')
  } catch (err) {
    logger.error('support', 'notice failed', err)
  }
}
