# Brag Plan: CRAFT — Launch Announcement (Narrated)

> **Duration + narration overrides, explicit and intentional.** `/brag`'s
> standard is a 15-25s, no-voice clip. The user dictated the full announcement
> script directly (DiBadili Institute framing, 50-years credibility line, the
> problem, features, results, CTA with email) and explicitly chose: ~2 minutes
> (same as the prior brag-output/ video), and voiceover narration via Kokoro
> (`am_michael` — the closest available male voice; Kokoro has no
> African-accented English voice, confirmed and flagged to the user, who
> accepted the closest available voice rather than adding a second TTS
> provider). Treat the standard 15-25s/no-voice defaults as superseded for
> this run only.

## What is this video?

An announcement/launch video from the DiBadili Institute ("Become Change")
introducing CRAFT, told in first person ("we built...") rather than a cold
product-tour cut like the prior brag-output/ video. Narration carries the
story; visuals illustrate each beat (dashboard, features, results) alongside
it rather than replacing it with dense on-screen text.

## Grounding (pulled from the live codebase, not invented)

- Institute: DiBadili Institute, meaning "Become Change" (`src/lib/launch.ts` BOILERPLATE.institute)
- Problem, verbatim press-release framing (`src/lib/launch.ts` PRESS_RELEASE):
  "Capable institutions are too often locked out of direct funding simply
  because they cannot prove what they already do well... too many funders
  rely on policy manuals that never reach practice."
- Product: CRAFT = Capacity Readiness & Fiduciary Assurance Toolkit, built on ICARF v4.0
- Features (KEY_MESSAGES in launch.ts): 5 tiers / 20 domains / 0-5 maturity
  scale; Paper Compliance Penalty Engine; gaps -> costed Capacity Improvement
  Plan (now self-determinable length, per the recently shipped feature); a
  Universal Data Room + independent Trust Delta verification; open source
  (GPL-3.0 / CC BY-SA 4.0)
- Audiences: ministries/public agencies, NGOs/civil society, private sector,
  donors/DFIs/auditors (AUDIENCES in launch.ts)
- Contact/CTA: register at craftframework.becomechange.institute; feedback to
  craftframework@becomechange.institute (both from launch.ts / data.ts)
- The "50 years of combined experience ... donors, development partners,
  private sector, government, civil society organizations across Africa" line
  is supplied directly by the user as DiBadili's own credibility statement —
  not pulled from the codebase, used verbatim as given.

## Tone

- Preset: `polished` leaning `cinematic` — a founder announcement, not a
  product-tour montage. Calm, confident, first-person "we." Less hard-cut
  machine-gun pacing than the previous brag-output/ video; more settle-and-
  breathe, matched to spoken narration pace (~130 wpm average).
- Voice direction: male, confident "tech founder" delivery, panache + calm
  professional energy. Kokoro `am_michael`, `--speed 0.97` (very slightly
  under natural pace, matching the calm-professional direction).

## Format: landscape — 1920x1080, ~120 seconds, 12 scenes

## Narration script (12 lines, one per scene, synthesized separately)

1. (0-6s) "Something exciting just went live from the DiBadili Institute, Become Change."
2. (6-10s) "This is CRAFT."
3. (10-20s) "With over fifty years of combined experience working with donors, development partners, the private sector, government, and civil society organizations across Africa,"
4. (20-32s) "we kept seeing the same problem. Capable institutions locked out of direct funding, simply because they couldn't prove what they already did well, while funders leaned on manuals that never reached practice."
5. (32-40s) "So we built CRAFT, the Capacity Readiness and Fiduciary Assurance Toolkit."
6. (40-50s) "CRAFT scores institutions across five tiers and twenty domains, on a zero to five maturity scale, backed by real evidence."
7. (50-60s) "A Paper Compliance Penalty Engine makes sure a well written policy manual never stands in for a working system."
8. (60-72s) "Every gap becomes a costed, owned, time bound action inside a Capacity Improvement Plan, rescaled to whatever timeframe your institution actually has."
9. (72-82s) "A secure Universal Data Room and independent Trust Delta verification give donors, D F Is, and auditors one shared, trustworthy picture."
10. (82-94s) "The result. An accreditation funders actually trust, a clear plan for every gap, and institutions ready for direct government to government, D F I, and donor partnerships."
11. (94-102s) "And because trust should be a public good, CRAFT is open source, free for every institution."
12. (102-120s) "Register your organization. Visit craft framework dot become change dot institute. Explore it, and tell us what you think, at craft framework at become change dot institute. This is CRAFT, built in Africa, for the partnerships Africa deserves."

Durations above are planning targets; actual scene timings are adjusted after
synthesis to match each line's real spoken length plus lead-in/hold.

## Storyboard (visual per scene)

1. **Announcement hook** — Deep emerald bg. "DIBADILI INSTITUTE · BECOME CHANGE" eyebrow, soft glow bloom.
2. **CRAFT reveal** — Hard cut, CRAFT wordmark slams in, full bleed.
3. **Credibility** — Scrolling/settling stat chips: "50+ years combined experience", small icon row (donors, development partners, private sector, government, civil society) across a stylized Africa-outline motif.
4. **The problem** — Dark, serious beat: "Capable. Locked out." stays on screen while two contrasting lines settle in (capable institution vs. paperwork-only funder view).
5. **The turn / solution** — CRAFT wordmark + "Capacity Readiness & Fiduciary Assurance Toolkit" full name settles.
6. **Feature: scoring** — 5 tiers / 20 domains / 0-5 maturity scale visual (same style dashboard radar as prior video, reused motif).
7. **Feature: penalty engine** — the penalty-engine code line (same real line as before), typed reveal.
8. **Feature: capacity plan** — plan-length control rescaling (6mo/12mo/custom), same shipped feature shown before.
9. **Feature: data room + trust delta** — document/shield icon row, "Universal Data Room" + "Trust Delta Verification" labels settling.
10. **Results** — accreditation badge landing on a real grade, "Ready for direct G2G, DFI & donor partnerships" settling beneath.
11. **Open source** — GPL-3.0 / CC BY-SA 4.0 badges, "Free. Open. A public good." settling.
12. **CTA / outro** — Emerald card: "Register Your Institution", craftframework.becomechange.institute, feedback line craftframework@becomechange.institute, CRAFT wordmark + DiBadili Institute credit.

## Audio direction

- Narration is the spine; music bed sits well under it throughout (lower
  overall level than the prior no-voice video — this one needs the voice to
  read clearly start to finish, not just in one duck window).
- Reuse the bundled `happy-beats-business-moves-vol-1` track at a lower,
  steady bed level (~0.12-0.18) under narration, with brief swells only in
  the narration gaps between lines (scene transitions) and a fuller swell
  under the final CTA hold after the last word lands.
- Light SFX only at hard visual beats that have no narration over them
  (CRAFT wordmark slam in scene 2, feature-card settles) — kept sparse so
  nothing competes with the voice.
