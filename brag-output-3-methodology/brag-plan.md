# Brag Plan: The CRAFT Framework — Methodology Explainer (Narrated)

> **Duration + narration overrides, explicit and intentional.** Third video
> in this series. User asked for an explainer covering the science, logic
> and methodology, how results differ by organization category, the
> different assessment types, a DiBadili Institute reference, both real
> logos, and a strong CTA. User chose ~3 minutes and voiceover narration
> (Kokoro `am_michael`, same voice as video 2 — Kokoro has no African-accented
> voice, already flagged and accepted in the prior video in this session).

## Grounding (pulled from the live codebase via a research pass — all verbatim/paraphrased-with-citation, not invented)

- **CRAFT has a real image logo**, not just a text wordmark: `public/logo.svg`
  — an emerald shield (`#065f46`→`#022c22`) with a glowing green-to-gold
  triangular "Delta" at its center, rendered everywhere via
  `src/components/Logo.tsx`. Copied locally to
  `composition/assets/logos/craft-logo.svg` for this video.
- **DiBadili Institute logo**: real PNG at
  `https://www.becomechange.institute/dibadili-logo.png` (the same one fixed
  in video 1's footer) — downloaded locally to
  `composition/assets/logos/dibadili-logo.png`. White background, black/green
  wordmark — needs a light card, not the dark emerald scenes used elsewhere.
- **What CRAFT is** (`MethodologyPage.tsx:12-19`): "ICARF v4.0 assesses
  institutions across 5 tiers and 20 domains, then drives a closed loop of
  accreditation, strengthening, and monitoring." Universal fiduciary core +
  archetype-specific adaptation (Public Sector / Civil Society / Private
  Sector) + optional thematic lenses (climate, emergency, research).
- **5 tiers** (`data.ts:113-119`): Organizational Maturity, Fiduciary
  Assurance, Grant Management, Donor & USG Readiness, Digital & Operational
  Readiness. **20 domains** listed in `data.ts:122-143`.
- **7-point evidence ladder** (`data.ts:2141`): No Evidence → Drafted →
  Approved → Disseminated → Partially Implemented → Implemented →
  System-Enforced.
- **Composite indices** (`computeCompositeIndices`, `data.ts:1536-1566`): 8
  baseline indices — Governance, Fiduciary, Grant Mgmt, Program Delivery,
  Digital, Risk Mgmt, Sustainability, USG Compliance (2 more — Resilience,
  Climate & ESG — only when optional lenses are active; not used here to
  keep the claim accurate without over-explaining lens conditionality).
- **Paper Compliance Penalty Engine** (`data.ts:1785-1799`,
  `MethodologyPage.tsx:60-70`): real pseudocode —
  `if (implementationEvidence < 50%) { accreditationLevel = min(accreditationLevel, "C") }`
  — same line used in video 1, reused here for consistency.
- **Three archetypes**, exact differentiated FAQ language
  (`data.ts:2124-2126`):
  - Public Sector: Supreme Audit Institution oversight, public finance
    transparency, sub-national reporting reach, G2G funding controls.
  - Civil Society: independent board, restricted-fund accounting,
    whistleblowing/safeguarding, MEL credibility, grant eligibility framing.
  - Private Sector: clean cap tables, verified beneficial ownership, credible
    unit economics, investor-grade ESG/safeguard controls.
- **Two assessment types**: the public, no-auth **Quick Readiness Check**
  (`PreAssessmentPage.tsx`, 10 questions, ~2 minutes, "measures policy
  intent... does not test for operational evidence") vs. the full **450-
  question ICARF wizard** (`AssessmentPage.tsx`, 5 tiers × 20 domains, real
  evidence).
- **Specialized framework library** (`src/lib/frameworks.ts`): 11 named
  modules. Script references a representative subset for time: Pact OMT,
  Global Fund PR FCR, G7/OECD AI governance, ESG (scored against GRI/IFRS/
  TCFD), and the 7-rung Capital Readiness Ladder.
- **Trust Delta verification** + Universal Data Room — reused motif/visual
  language from video 2's data-room scene for series consistency.
- **CTA**: register at craftframework.becomechange.institute, feedback to
  craftframework@becomechange.institute (`src/lib/launch.ts`, `data.ts`).

## Tone

- Preset: `polished`/explainer — authoritative, calm, confident. Less
  cinematic slam than videos 1-2; this one is a methodology walkthrough, so
  pacing favors clarity over spectacle. Diagrams and real framework language
  over hype copy.
- Voice: Kokoro `am_michael`, `--speed 0.97` (same as video 2).

## Format: landscape — 1920x1080, ~180 seconds, 15 scenes

## Narration script (15 lines, one per scene)

1. "This is the CRAFT Framework, built by the DiBadili Institute, Become Change."
2. "CRAFT stands for the Capacity Readiness and Fiduciary Assurance Toolkit, built on I C A R F version four point oh."
3. "It assesses institutions across five tiers and twenty domains, driving one closed loop: accreditation, strengthening, and monitoring."
4. "A universal fiduciary core runs through every assessment. Archetype specific questions then adapt it to Public Sector, Civil Society, and Private Sector institutions."
5. "Every answer is backed by evidence, scored zero to five, and placed on a seven point ladder: from No Evidence, through Drafted and Approved, all the way to System Enforced."
6. "Those answers roll up into a composite readiness score, and into indices covering governance, fiduciary controls, grant management, program delivery, digital systems, risk, sustainability, and donor compliance."
7. "But paper is not proof. If implementation evidence falls below fifty percent, the Paper Compliance Penalty Engine caps accreditation at Level C, no matter how polished the policy looks."
8. "Public Sector institutions are measured on Supreme Audit oversight, public finance transparency, and the controls donors require before funding flows government to government."
9. "Civil Society organizations are measured on independent governance, restricted fund accounting, safeguarding, and the monitoring and evaluation donors actually trust."
10. "Private Sector institutions are measured on clean cap tables, verified ownership, credible unit economics, and investment grade E S G controls."
11. "Start with the two minute Quick Readiness Check, a snapshot of policy intent. Or go deeper with the full four hundred and fifty question assessment, built for real, verified evidence."
12. "Beneath that sits a library of specialized instruments: the Pact Organizational Mapping Tool, the Global Fund's Financial Compliance Reporting, G seven and O E C D A I governance, E S G scored against G R I and T C F D standards, and the seven rung Capital Readiness Ladder."
13. "Every gap, in every category, becomes a costed, owned, time bound action, inside a plan that rescales to your institution's own timeframe."
14. "Donors and auditors can then commission independent Trust Delta verification, so what we score and what they see is the same shared, trustworthy picture."
15. "This is the CRAFT Framework, from the DiBadili Institute. Register your institution at craft framework dot become change dot institute, and tell us what you think, at craft framework at become change dot institute."

## Storyboard (visual per scene)

1. **Lockup hook** — light card, CRAFT shield+wordmark and DiBadili logo side by side.
2. **What is CRAFT** — CRAFT shield + wordmark, "Capacity Readiness & Fiduciary Assurance Toolkit", "Built on ICARF v4.0".
3. **Methodology** — "5 Tiers · 20 Domains" stat, the 5 tier names listing in, "Accreditation → Strengthening → Monitoring" loop.
4. **Universal core + archetypes** — center "Universal Fiduciary Core" with Public / Civil Society / Private radiating around it.
5. **Evidence ladder** — 7-step vertical ladder, No Evidence → System-Enforced, lighting bottom to top.
6. **Composite indices** — grid of the 8 index chips.
7. **Penalty engine** — real code-block reveal (reused from video 1).
8. **Public Sector card** — keywords: Supreme Audit · Public Finance Transparency · G2G Controls.
9. **Civil Society card** — keywords: Independent Governance · Restricted-Fund Accounting · Safeguarding · MEL.
10. **Private Sector card** — keywords: Cap Tables · Verified Ownership · Unit Economics · ESG.
11. **Quick vs Full** — split comparison: 2-Minute Quick Check vs 450-Question Full Assessment.
12. **Specialized frameworks** — fast chip grid: Pact OMT, Global Fund PR FCR, G7/OECD AI, ESG, Capital Readiness Ladder.
13. **Action plan** — "Every Gap → Costed. Owned. Time-Bound." plan visual.
14. **Trust Delta** — Data Room + verification icon motif (reused from video 2).
15. **CTA / outro** — both logos again, Register CTA, URL, feedback email.

## Audio direction

Same posture as video 2: low, steady music bed (~0.12-0.18) under
narration throughout, brief swell in the final CTA hold after the last
word lands. Sparse SFX only on non-narrated hard-cut beats (logo lockup
settle, code-block caption landing).
