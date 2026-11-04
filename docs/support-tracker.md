# Support tracker (Admin → Support)

An internal inbox for every support request, used in-house instead of a helpdesk product. Only the Super Admin can
open it, and two-step sign-in is required, for reading too.

## Where tickets come from

| Source | How it arrives |
|---|---|
| Support chat | Each new public support-chat issue (`/api/support-bot/chat`) opens a ticket. |
| Bot escalation / private report | Each new escalation (`/api/support-bot/escalate`) opens a ticket; private reports are marked confidential and set to high priority. |
| Contact form | `netlify/functions/contact-form.mts` handles Netlify Forms' `formSubmitted` event; Netlify's notification email still goes out. |
| Email, phone, WhatsApp, meeting, other | Logged by hand with **Log a request**. |

Tickets that existed before the tracker (support-chat issues and escalations) were imported by migration
`20261104120000_support_tracker`.

## Working a ticket

- **Statuses:** New → Open → Waiting on them → Resolved / Closed. A note moves a new ticket to Open, and a sent reply moves
  it to Waiting (or to Resolved with **Send and resolve**).
- **Due dates:** set when a ticket opens, from its priority: urgent 1 day, high 2, normal 5, low 10. They can be changed.
  A ticket is **overdue** when it's past due and not waiting, resolved or closed.
- **Internal notes** are never sent.
- **Replies** are emailed through Resend, with reply-to `craftframework@becomechange.institute` and the ticket number in
  the subject. If email isn't configured or the provider refuses, the reply stays on the timeline as "not sent" and the
  status doesn't change.
- Every change is recorded on the ticket's timeline. The audit log records who did what to which ticket, never the
  contact details.

## Data

- `support_tickets`: the subject, message, contact name and email are encrypted at rest; imported rows are encrypted
  by the daily encryption backfill.
- `support_ticket_events`: the timeline, append-only, with no update or delete route.
- Search runs over the latest 2,000 tickets after decryption (`ponytail` note in `netlify/functions/support-tickets.mts`).
