# Networks

CRAFT lets civil society networks assess their member organisations together, at every level a network works at,
and turn the results into support, learning and evidence.

## Levels and people

- A **network** is a tree of levels: global, continental (e.g. Africa), sub-regional (an AU region or regional
  economic community such as ECOWAS or EAC), national, zonal (a zone or region within a country, e.g. Nigeria's
  geopolitical zones), state or province, and local. A network can start at any level and skip levels.
- **Anyone signed in can set up a network or a funder's grantee cohort** (up to 5 a day), starting from a structure
  template (Africa → 5 AU regions → 54 countries; Nigeria → 6 zones → 36 states and the FCT; a flat cohort; or blank).
  The creator becomes coordinator of the top level. **Coordinators** are added per level and manage that level and
  everything below it; **viewers** see results only.
- Safeguards: members see who set the network up and whether CRAFT has **verified** it before they accept; new
  networks can send 50 invitations a day (500 once verified); the Super Admin can verify networks and **archive**
  misused ones (archived networks are read-only).
- **Members** are CRAFT organisations. A coordinator invites one by its CRAFT ID or contact email; it joins only if
  it accepts, and it chooses what the network sees:
  - **Totals only** (default): counted in results, never named;
  - **Named results**: coordinators at its level and above see its name, overall score and band.

## Privacy rules

- Any group of **fewer than 5 organisations** is withheld everywhere (results, heatmap cells, map squares, the value
  survey, progress comparisons, briefs and exports), **unless every member in that group chose named results**.
- Evidence files are never shared through a network.
- Participation is shown as counts; reminders go straight to the organisations that haven't submitted.
- Every change, and every view or export of named results, is audit-logged.

## Network profile and overview

At the top of each network's page, coordinators see the network profile: the secretariat's Network Capacity Index
score, the members' median overall score in the latest round, and the share of members who completed at least one
improvement action, each on a 0-100 scale, plus a combined figure (their plain average) shown only when all three
exist and always labelled with that formula. Alerts flag levels with no coordinator of their own, rounds closing
within a week with under half submitted, invitations waiting over two weeks, and a secretariat not yet assessed.

## Sign-up

Right after sign-up, CRAFT asks "What brings you to CRAFT?" (my organisation; validator or consultant; funder or
investor; network coordinator) and routes to that path. It is not an account type; one account can do all four.

## Assessment rounds

A coordinator opens a **round** at their level with one CRAFT assessment and a window. Members answer in the usual
assessment screens and press **Submit to the network**, which freezes that assessment's scores for the round
(they can resubmit while it is open). Optional **perspectives** collect 0-5 scores per area from the board,
management, staff, community representatives and a facilitator; areas where views differ by 2 or more are flagged.

## Assessments for networks

- **CRAFT Organisational & Network Capacity Index (CRAFT-ONC)**: 44 indicators in 11 domains for member
  organisations, written for any African country. Questions that depend on national law show the organisation's
  own country's reviewed laws from the laws register. Results also read across to the eight NHOCAT domains
  (Nigeria's National Harmonised Organisational Capacity Assessment Tool) on a four-level scale. This is a
  read-across, not an NHOCAT assessment.
- **CRAFT Network Capacity Index**: 24 indicators for the network's secretariat or coordinating body (mandate and
  legitimacy, member services, coordination, representation, sustainability, accountability to members).

Both are live for organisations (founder sign-off 31 October 2026).

## Network Value Scorecard

For any level and round, three parts side by side, each with a one-line reading:

1. **Capacity**: members per band, median and middle half per area, weakest areas, and a heatmap of areas by the
   levels below.
2. **Value added**: the member value survey (services used and how helpful; would-recommend score).
3. **Use**: joined → assessed → improvement plan → actions completed → reassessed → validated.

Members see only how their own organisation compares with the group.

## Learning and exchange

The **exchange log** records peer learning, exchange visits, study tours, conferences, mentoring, twinning,
communities of practice and joint trainings against the areas they strengthen. Coordinators tick members who share
named results; any member can add itself. The **capacity-building plan** lists, per area, how many members need
support and what kind of collective support fits; **mentoring pairs** are suggested among named-results members.
**Progress between rounds** compares the same members over time, and a contribution view compares exchange
participants with others (only with 5+ on each side; a comparison, not proof).

## Programme Response Scorecards

Modelled on NACA's Subnational HIV Prevention Self-Assessment Scorecards: each unit at a level (e.g. each state)
scores its programme response per programme area on programme management, implementation, service package and
outcome (items 0/1/2). The level above sees how many units are in each band (Immediate action required / Attention
needed / Good, but may need improvement), by zone, with lists, change since the last scorecard, and each unit's
response next to its members' capacity. Bands use CRAFT's thresholds (40% / 70%); NACA's are not published.
Templates: subnational HIV prevention with NACA's seven programme areas (AGYW, condom programming, sex workers,
men who have sex with men, people who inject drugs, transgender people, PrEP) as published in its 2023/2024 report,
and a generic programme template.

## Outputs

Organisation report (the standard index report), Network Value Scorecard, heatmap, Africa tile map (country
levels), benchmark, capacity-building
plan, mentoring pairs, progress between rounds, funder and government brief (printable, totals only), CSV export
(aggregates; named rows only for named-results members), programme scorecard summaries.

## API

`/api/networks`, `/api/network-rounds`, `/api/network-results`, `/api/network-exchanges`,
`/api/network-scorecards`. Rules live in `src/lib/networks.ts`, `networkRounds.ts`, `networkResults.ts`,
`networkExchange.ts` and `programmeScorecard.ts`, each with a self-check.
