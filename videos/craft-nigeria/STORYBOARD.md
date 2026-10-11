---
format: 1920x1080
duration: 156s
message: "Nigeria — like Africa and the Global South — is underfunded because trust is hard to prove; CRAFT turns trust into evidence funders accept."
arc: PAS + Demo Loop — Nigeria data (problem) → success despite it → imagine (turn) → five-step product walkthrough → who it serves → local competence → CTA
audience: Nigerian ministries & agencies, NGOs, SMEs/startups; donors, DFIs, investors and auditors
mode: autonomous
music: none
---

## Video direction

- palette system (from frame.md, by role): ground = cream #FFFFFF; data frames 1–6 sit on a quiet mint tint #F0FDF4; ink #1E293B for body; pink-deep #004F3B (CRAFT deep green) for display type and hero figures; green #00744D / green-lite #009060 for rules, bars, positive states; ONE alarm accent, brand gold #FFB900, used ONLY where a frame's scene names it (losses, negatives, "less than 1%"); never red. Frame 14 inverts to a pink-deep ground with cream type.
- type: Inter display ramp (weight 500, tight tracking) for claims and figures; `stat-figure` for numbers; JetBrains Mono uppercase `label` / `caption-mono` for chrome, step labels and source lines. Every frame has the topbar spine (mono label left, frame number right).
- citation chrome (frames 1–4 and 6): the source sits as one mono `caption-mono` line with a 2px green rule above, at ~76–80% height, revealed when the figure lands. It is the proof.
- product frames 7–12 show REAL CRAFT screens (assets/screens/*.png, already cropped). Present each inside a flat "window" card: cream frame, 2px green (#00744D) border, 8px radius, no shadow, a thin mono title strip naming the screen. Camera moves are slow push-ins / pans INTO the named region of the screenshot (the image is the world; scale the image inside the window, never distort it). Never redraw or fake product UI; overlays are mono labels, highlight rings (2px gold or green outline) and step chips only.
- walkthrough spine (frames 7–11): a persistent step rail at the top-left in mono — "01 ONBOARD · 02 ASSESS · 03 SCORE · 04 RESULTS · 05 TRACK" — with the current step in pink-deep and the rest muted.
- motion grammar: long-tail power3 eases, smooth over bouncy; every element reveals on its spoken cue (frame-local @seconds given per Scene); count-ups run while the number is spoken; rules draw left→right before the text they underline.
- rhythm: frames 1–4 grave and data-led; 5 lifts; 6 is the turn (slow, held); 7–11 brisk product steps; 12 wide; 13 held pride; 14 held CTA lockup.
- negative list: NEVER the word "DiBadili" in any typed text (institute logo artwork in frame 13 is the single approved exception); no company logos for Flutterwave / Interswitch / Moniepoint / OPay — names are set in type only; no fake UI; no purple/blue AI gradients, no bokeh, no drop shadows; no slideshow (front-load then freeze), no screensaver (independent floating). Nothing important in the bottom ~17% caption band (y > 896px).

## Frame 1 — Investment swings

- scene: Nigeria FDI net inflows 2010–2025 line chart draws on, plunging below zero in 2022, recovering to $4.01bn
- voiceover: "Nigeria is Africa's most populous nation. Yet foreign investment swings wildly: eight point eight billion dollars in 2011, below zero in 2022, four billion last year."
- duration: 12.3s
- transition_in: cut
- status: animated
- src: compositions/frames/01-fdi.html
- type: hook
- persuasion: Statistical proof
- beat: tension
- asset_candidates:
- data: NGA FDI net inflows US$bn — 2010 6.03 · 2011 8.84 · 2012 7.07 · 2013 5.56 · 2014 4.69 · 2015 3.06 · 2016 3.45 · 2017 2.41 · 2018 0.78 · 2019 2.31 · 2020 2.39 · 2021 3.31 · 2022 −0.19 · 2023 1.87 · 2024 1.61 · 2025 4.01
- source: SOURCE · WORLD BANK WORLD DEVELOPMENT INDICATORS · FDI, NET INFLOWS (BOP, CURRENT US$)

narrativeRole: open on volatility — capital does not trust the market steadily.
keyMessage: investment into Nigeria is volatile.

- blueprint: dataviz-countup (Adapt)

Adapt: the hero is a line chart, traversed by the camera to land on three called-out points.
Scene 1 (0.0–3.2s): mint-tint ground, topbar ("NIGERIA · FOREIGN DIRECT INVESTMENT" left, "01" right). On "Nigeria" @0.3 a display line "Nigeria" settles upper-left with a mono sub "AFRICA'S MOST POPULOUS NATION" on "populous" @1.6. A hairline chart frame (x axis 2010–2025, y axis US$bn with a highlighted zero line) draws in across the lower 60% of the frame.
Scene 2 (3.2–5.3s): on "swings wildly" @4.3 the FDI line draws left→right across all 16 years in pink-deep, the camera easing with the pen.
Scene 3 (5.3–7.9s): on "eight point eight billion" @5.4 a callout pin pops on the 2011 peak: "2011 · US$8.84BN", figure counting up.
Scene 4 (7.9–9.8s): on "below zero" @8.0 the 2022 point flashes brand gold #FFB900 with a callout "2022 · −US$0.19BN"; the zero line pulses once in gold.
Scene 5 (9.8–12.3s): on "four billion last year" @9.9 the 2025 point pins "2025 · US$4.01BN" in green; source line draws on. Hold still.

## Frame 2 — Slow, rigorous finance

- scene: a 19-cell month calendar fills one cell at a time; "19 months" lands; "scrutiny" stamp
- voiceover: "Development finance moves slower still. At the World Bank, approval has taken up to nineteen months. And the scrutiny is toughest on institutions like ours."
- duration: 11.22s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-time.html
- type: pain_point
- persuasion: Pain agitation
- beat: frustration
- asset_candidates:
- source: SOURCE · WORLD BANK PRESIDENT AJAY BANGA, 2024 (APPROVAL TIMES, 17–19 MONTHS)

narrativeRole: money that does come is slow to arrive.
keyMessage: up to 19 months to approval.

- blueprint: dataviz-countup (Adapt)

Adapt: the count-up is a grid of month cells filling, not a ring.
Scene 1 (0.0–3.0s): mint-tint ground; topbar ("DEVELOPMENT FINANCE" / "02"). On "Development finance" @0.3 mono label "FROM FIRST CONVERSATION TO APPROVAL" types on upper-left.
Scene 2 (3.0–6.8s): on "World Bank" @3.4 a calendar grid of 19 month cells (two rows, hairline green outlines) is laid out across the middle; on "approval has taken" @4.2 the cells fill pink-deep one by one left→right, finishing on "nineteen months" @5.4 as stat-figure "19" + unit "months" counts up beside the grid.
Scene 3 (6.8–9.8s): on "the scrutiny is toughest" @7.4 three mono checklist lines stack beside the grid one after another — "DUE DILIGENCE", "FIDUCIARY REVIEW", "PROCUREMENT ASSESSMENT" — each with a small gold tick-box ticking.
Scene 4 (9.8–11.22s): source line draws on. Hold.

## Frame 3 — Under one percent

- scene: a 100-square waffle = global venture capital; Africa lights less than one square; Nigeria a sliver of that
- voiceover: "In 2025, all of Africa raised about four billion dollars in venture capital, less than one percent of the world's total. Nigeria's share, five hundred and seventy-two million."
- duration: 12.01s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-vc.html
- type: pain_point
- persuasion: Negative contrast
- beat: frustration
- asset_candidates:
- source: SOURCE · PARTECH AFRICA TECH VENTURE CAPITAL REPORT 2025 · AVCA

narrativeRole: private capital under-invests too.
keyMessage: Africa gets <1% of global VC.

- blueprint: dataviz-countup (Adapt)

Adapt: hero stat plus a 10×10 waffle grid for the share.
Scene 1 (0.0–3.0s): mint-tint ground; topbar ("VENTURE CAPITAL · 2025" / "03"). A 10×10 waffle grid of hairline squares assembles in a quick cascade on the right half on "In 2025" @0.3, labelled mono "GLOBAL VENTURE CAPITAL = 100".
Scene 2 (3.0–5.0s): on "four billion dollars" @3.1 stat-figure "US$4.1bn" counts up on the left half in pink-deep with mono tag "ALL OF AFRICA".
Scene 3 (5.0–7.6s): on "less than one percent" @5.1 a single square in the waffle lights brand gold #FFB900 — but only ~80% of it fills — and a gold callout "< 1% OF THE WORLD'S TOTAL" slides in beside the figure.
Scene 4 (7.6–10.8s): on "Nigeria's share" @7.8 the lit square splits and a small sliver highlights in green; a kpi line "NIGERIA · US$572M" counts up under the hero figure on "five hundred and seventy-two million" @8.9.
Scene 5 (10.8–12.01s): source line draws on. Hold.

## Frame 4 — Across the Global South

- scene: "Not only Nigeria" → 100 dots, 3.6 lit — humanitarian funding reaching local organisations directly
- voiceover: "And it is not only Nigeria. Across Africa and the Global South, just three point six percent of humanitarian funding reaches local organisations directly."
- duration: 10.26s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-south.html
- type: pain_point
- persuasion: Generalisation from evidence
- beat: gravity
- asset_candidates:
- source: SOURCE · GLOBAL HUMANITARIAN ASSISTANCE REPORT 2025, ALNAP

narrativeRole: widen from Nigeria to the whole Global South.
keyMessage: 3.6% reaches local actors directly.

- blueprint: kinetic-type-beats (Adapt)

Adapt: kinetic type for the widening, then a dot-field stat payoff.
Scene 1 (0.0–2.5s): mint-tint ground; topbar ("THE GLOBAL SOUTH" / "04"). Display line "Not only Nigeria." centred, words landing on "not @0.8 / only @1.1 / Nigeria @1.3".
Scene 2 (2.5–4.6s): the line lifts to the top third and token-swaps to "Across Africa and the Global South." on "Across" @2.6, with "Global South" in green.
Scene 3 (4.6–8.4s): a 10×10 grid of round dots fades in centre; on "three point six percent" @4.9 exactly 3.6 dots fill pink-deep (three whole, one ~60%) while stat-figure "3.6%" counts up to the left; on "reaches local organisations directly" @7.0 a mono tag "OF HUMANITARIAN FUNDING · DIRECT TO LOCAL ACTORS" appears under the figure.
Scene 4 (8.4–10.26s): source line draws on. Hold.

## Frame 5 — And still, Nigeria builds

- scene: four company names stack in big type — Flutterwave, Interswitch, Moniepoint, OPay — then chips for businesses, NGOs, public agencies
- voiceover: "And still, Nigeria builds: Flutterwave, Interswitch, Moniepoint, OPay, and thousands of strong businesses, NGOs and public agencies."
- duration: 10.11s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/05-builds.html
- type: social_proof
- persuasion: Proof of capability
- beat: pride
- asset_candidates:

narrativeRole: the problem is not capability.
keyMessage: Nigeria already builds world-class institutions.

- blueprint: kinetic-type-beats (Adapt)

Adapt: a roll-call of names landing one per beat, then a breadth payoff.
Scene 1 (0.0–2.0s): clean cream ground (the lift after the data); topbar ("AND STILL" / "05"). Headline-xl "Nigeria builds." lands left on "Nigeria builds" @1.1, "builds" in green.
Scene 2 (2.0–5.2s): on the right half, four names stack as display type, each sliding up on its word: "Flutterwave" @2.1, "Interswitch" @2.9, "Moniepoint" @3.8, "OPay" @4.6; a small mono tag "UNICORN" rides each one (text only, no company logos).
Scene 3 (5.2–10.11s): a full-width green rule draws under both columns on "and thousands" @5.5; three mono chips pop beneath it on their words — "STRONG BUSINESSES" @6.4, "NGOs" @7.1, "PUBLIC AGENCIES" @8.1. Hold.

## Frame 6 — Imagine

- scene: "Imagine if they could prove it." → "When trust is proven, money moves." → 70% count-up, Nigeria Humanitarian Fund 2025
- voiceover: "Now imagine they could prove it, with evidence any funder accepts. When trust is proven, money moves. In 2025, the Nigeria Humanitarian Fund sent a record seventy percent of direct allocations to Nigerian NGOs."
- duration: 15.75s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-imagine.html
- type: product_intro
- persuasion: Future pacing + evidence
- beat: hope → conviction
- asset_candidates:
- source: SOURCE · UN NIGERIA, "NIGERIA'S HUMANITARIAN RESET", 23 JAN 2026 (NIGERIA HUMANITARIAN FUND)

narrativeRole: the turn — proof unlocks money; there is evidence for it.
keyMessage: when trust is proven, money moves (70%).

- blueprint: kinetic-type-beats (Adapt)

Adapt: kinetic statements build to a single count-up payoff.
Scene 1 (0.0–4.4s): clean cream ground, slow and calm. Display "Imagine they could prove it." centred, words landing on "imagine @0.6 / prove @1.3 / it @1.6"; on "evidence any funder accepts" @2.2 a mono sub fades in beneath: "WITH EVIDENCE ANY FUNDER ACCEPTS".
Scene 2 (4.4–7.5s): the statement swaps to headline-xl "When trust is proven, money moves." on "When" @4.7, "proven" in green @5.4, "moves" lands @6.4 with a short green underline draw.
Scene 3 (7.5–14.0s): the line lifts and shrinks to the top third; on "the Nigeria Humanitarian Fund" @9.3 a mono label "NIGERIA HUMANITARIAN FUND · 2025" appears centre; on "seventy percent" @11.2 stat-figure "70%" counts 0→70 in pink-deep, huge; on "to Nigerian NGOs" @13.2 a tag "OF DIRECT ALLOCATIONS TO NATIONAL NGOs · A RECORD" slides in beneath.
Scene 4 (14.0–15.75s): source line draws on. Hold.

## Frame 7 — Step 01 · Onboard

- scene: real screens — the Readiness Check hero, then the "Set up your workspace" onboarding card, then the Assessment Frameworks catalogue
- voiceover: "That is what CRAFT does, and it starts in minutes. Register your institution, set up your workspace, and align to the frameworks your funders already use."
- duration: 10.76s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/07-onboard.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease
- asset_candidates: assets/screens/pre-assessment.png — real CRAFT public page hero, dark green: "2-MINUTE QUICK READINESS CHECK" badge + headline "Is Your Institution Truly Ready for Direct G2G, DFI and Donor Funding?" (1000×400 crop); assets/screens/onboarding.png — real onboarding step 1 card "Set up your workspace" with stepper (Workspace · Donor Alignment · Team & Import) and fields Organization Name, Entity Archetype, Country of Operation, Sector / Mandate, Organization Logo (800×680 crop); assets/screens/frameworks.png — real "Assessment Frameworks" catalogue grid (Pact OMT, Pact OCA, Global Fund PR FCR, G7 AI, OECD/UNESCO, GFA, ESG, CRAFT Capital Readiness Ladder, CRAFT Institutional Resilience Index) (1664×985 crop)
- focal: assets/screens/onboarding.png
- roles: pre-assessment = supporting (opening card) · onboarding = cutout hero in window card · frameworks = supporting (third window)

narrativeRole: step 1 — getting started is fast.
keyMessage: register, set up, align to your funders' frameworks.

- blueprint: device-surface-showcase (Adapt)

Adapt: a floating window cycles through three real screens of the onboarding flow; step rail top-left shows "01 ONBOARD" active.
Scene 1 (0.0–4.0s): clean cream ground, topbar ("CRAFT · HOW IT WORKS" / "07"), step rail appears. Headline "That is what CRAFT does." lands left on "CRAFT" @1.0; on "starts in minutes" @2.2 a mono chip "IN MINUTES" pops and the pre-assessment.png window card slides up on the right (60% width).
Scene 2 (4.0–7.0s): on "Register your institution" @4.1 the window's screen swaps (vertical slide) to onboarding.png; on "set up your workspace" @5.6 the camera pushes gently into the form fields; a green highlight ring traces the "Organization Name / Entity Archetype / Country / Sector" field group.
Scene 3 (7.0–10.76s): on "align to the frameworks" @7.1 the screen swaps to frameworks.png and pans slowly across the framework cards; a mono label "MAP TO PACT · GLOBAL FUND · GFA · ESG …" sits under the window. Hold.

## Frame 8 — Step 02 · Assess

- scene: the real 5-Tier Capacity Assessment wizard; five tier chips light in sequence; online/offline badge
- voiceover: "Then assess your organisation, tier by tier: organisational maturity, fiduciary assurance, grant management, donor readiness and digital operations, online or offline."
- duration: 11.43s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/08-assess.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: control
- asset_candidates: assets/screens/assessment.png — real "5-Tier Capacity Assessment" wizard: statutory controls injected by jurisdiction (Nigeria CBN codes listed), tier stepper Tier 1–5 along the bottom, "Organizational Maturity" active, progress 48% (1664×985 crop)
- focal: assets/screens/assessment.png
- roles: assessment = cutout hero in window card

narrativeRole: step 2 — the assessment covers the whole organisation.
keyMessage: five tiers, every part of the organisation.

- blueprint: cursor-ui-demo (Adapt)

Adapt: no cursor — locked stage; the screenshot window holds left (65%) while a tier list on the right lights on each spoken tier; camera pushes on the screen's tier stepper.
Scene 1 (0.0–2.8s): step rail shows "02 ASSESS" active. The assessment.png window card enters left on "assess your organisation" @0.6; on "tier by tier" @2.0 the camera pushes into the screenshot's bottom tier stepper (Tier 1 … Tier 5).
Scene 2 (2.8–9.0s): on the right, a vertical list of five mono-numbered tier rows lights one by one, each turning pink-deep with a green tick as spoken: "01 Organisational Maturity" @2.9, "02 Fiduciary Assurance" @4.4, "03 Grant Management" @5.8, "04 Donor & USG Readiness" @6.8, "05 Digital & Operational Readiness" @7.8. The camera eases back out to the full screenshot as the list completes.
Scene 3 (9.0–11.43s): on "online or offline" @9.1 two pills pop under the list: "WEB WIZARD" and "OFFLINE EXCEL TEMPLATE"; a green "OFFLINE READY" dot pulses once. Hold.

## Frame 9 — Step 03 · The logic

- scene: the real Readiness Dashboard; scale 0–5 and the 7-point evidence matrix explained; camera pushes into the "Paper Compliance Penalty Active" banner
- voiceover: "The logic is rigorous. Every answer is scored from zero to five, and tested against a seven-point evidence matrix. Policies on paper don't count until practice proves them."
- duration: 12.15s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/09-logic.html
- type: feature_showcase
- persuasion: Authority of method
- beat: confidence
- asset_candidates: assets/screens/dashboard.png — real "Readiness Dashboard" for a demo National Public Health Agency: red "Paper Compliance Penalty Active" banner near the top ("Implementation Evidence is 4%, below the 50% threshold. Accreditation is mathematically capped at Level C…"), KPI cards (Composite Score 45%, Implementation Self-Score Proxy 4%, Open Critical Risks 101), 10 Composite Indices radar, 5-Tier Maturity bars, Level D accreditation badge top-right (1664×985 crop)
- focal: assets/screens/dashboard.png
- roles: dashboard = cutout hero in window card

narrativeRole: step 3 — why the score can be trusted.
keyMessage: scored 0–5, evidence-tested; paper alone doesn't count.

- blueprint: compose

Compose: a two-part explainer graphic on the left, the real dashboard on the right; the camera push lands on the penalty banner.
Scene 1 (0.0–2.4s): step rail "03 SCORE" active. Headline "The logic is rigorous." lands left on "rigorous" @1.0. The dashboard.png window card sits on the right (55% width), whole screen visible.
Scene 2 (2.4–4.6s): on "scored from zero to five" @3.1 a horizontal 0–5 maturity scale draws on under the headline: six ticks 0·1·2·3·4·5 with a pink-deep marker sliding to 3.
Scene 3 (4.6–7.9s): on "seven-point evidence matrix" @5.6 a 7-cell mono matrix row assembles beneath the scale (cells labelled 1–7, three filling green), labelled "EVIDENCE MATRIX".
Scene 4 (7.9–12.15s): on "Policies on paper" @8.1 the camera pushes into the screenshot's "Paper Compliance Penalty Active" banner and a 2px gold #FFB900 ring traces it; on "practice proves them" @9.9 a mono callout "PAPER COMPLIANCE NEVER INFLATES A SCORE" lands under the window. Hold.

## Frame 10 — Step 04 · Results and reports

- scene: real Reports & Exports screen with "Level D" accreditation; then the Narrative Report Generator screen
- voiceover: "The results are immediate: a readiness level from A to E, the gaps that matter most, and reports ready for your board and your funders."
- duration: 8.58s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/10-results.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: clarity
- asset_candidates: assets/screens/reports.png — real "Reports & Exports": Executive Summary (print / PDF) and Capacity Plan (CSV) cards; "Executive Summary: National Public Health Agency" with Accreditation Level D, Composite 45%, and the top critical risks list (1664×985 crop); assets/screens/narrative-report.png — real Narrative Report Generator: "Sustainability & Regulatory Implementation Plan", jurisdictions incl. Nigeria, Download Document / Print buttons, generated plan text citing CBN / SEC Nigeria / FRCN (1664×985 crop)
- focal: assets/screens/reports.png
- roles: reports = cutout hero in window card · narrative-report = supporting second window

narrativeRole: step 4 — results you can hand to a board or funder.
keyMessage: a level A–E, the key gaps, ready-made reports.

- blueprint: device-surface-showcase (Adapt)

Adapt: one window, two real screens, with a level ladder overlay.
Scene 1 (0.0–2.6s): step rail "04 RESULTS" active. reports.png window card enters centre-right (65%); on "readiness level from A to E" @1.8 a vertical mono ladder A·B·C·D·E draws on at the left edge and "D" highlights pink-deep while the camera pushes to the screenshot's "Level D" accreditation block.
Scene 2 (2.6–4.8s): on "the gaps that matter most" @3.6 the camera pans down the screenshot's top critical risks list; a green bracket marks it.
Scene 3 (4.8–8.58s): on "reports ready" @5.0 the window's screen swaps to narrative-report.png; mono chips pop beside it on "board" @6.0 "BOARD-READY PDF" and on "funders" @6.5 "FUNDER NARRATIVE". Hold.

## Frame 11 — Step 05 · Track, and let others review

- scene: real 24-Month Strengthening Plan action tracker (with plan-length selector) → real Trust Delta (self vs independent) → real Portfolio view for funders
- voiceover: "Every gap becomes a costed, owned action. Track progress over time, while your funders and independent reviewers see the same evidence, and the same trail."
- duration: 10.21s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/11-track.html
- type: benefit_highlight
- persuasion: Transparency as proof
- beat: trust
- asset_candidates: assets/screens/cip.png — real "24-Month Strengthening Plan": plan-length selector top-right (6m · 12m · 18m · 24m · custom), status counters, Action Tracker table with owners, due dates, severity and status (1664×985 crop); assets/screens/trust-delta.png — real "Trust Delta & Negotiated Consensus": Optimism Bias +29.2%, self vs independent diverging bar chart, Reconciliation Register (1664×985 crop); assets/screens/portfolio.png — real "Portfolios & Institutions" funder/portfolio-reviewer view: register institutions, institutions in this portfolio, scoped access notice (1664×985 crop)
- focal: assets/screens/trust-delta.png
- roles: cip = supporting (first window) · trust-delta = cutout hero · portfolio = supporting (third window)

narrativeRole: step 5 — progress everyone can see and verify.
keyMessage: you, your funders and independent reviewers see the same evidence.

- blueprint: comparison-split (Adapt)

Adapt: starts as one window (the plan), then splits into two side-by-side windows ("YOU" vs "FUNDERS & INDEPENDENT REVIEWERS") with mirrored book-open tilts; inner-edge badges pop.
Scene 1 (0.0–3.4s): step rail "05 TRACK" active. cip.png window card centred; on "costed, owned action" @1.3 the camera pushes into the Action Tracker rows (owner / due / status columns) with a green ring; on "Track progress" @3.5 a small mono chip "PLAN LENGTH: YOUR CHOICE" points at the plan-length selector.
Scene 2 (3.4–6.6s): on "over time" @4.2 the window shrinks left and a second window enters from the right with mirrored tilt — left labelled "YOU", right "FUNDERS & INDEPENDENT REVIEWERS"; the right window shows trust-delta.png on "independent reviewers" @5.8.
Scene 3 (6.6–10.21s): on "see the same evidence" @7.0 the right window swaps to portfolio.png; inner-edge pill badges pop between the two windows: "SAME EVIDENCE" @7.2 and "SAME AUDIT TRAIL" @8.4. Hold.

## Frame 12 — Big and small

- scene: org-type chips cascade (ministries, agencies, NGOs, cooperatives, startups, SMEs, informal enterprises) around two real screens: the Data Room's Nigeria-aware compliance engine and the Informal Economy track; "one evidence base → many funders"
- voiceover: "It is built for ministries and agencies, NGOs and cooperatives, startups, SMEs, even informal enterprises. One evidence base, reused across funders, saving time and resources."
- duration: 13.4s
- transition_in: crossfade
- status: animated
- src: compositions/frames/12-everyone.html
- type: benefit_highlight
- persuasion: Inclusion + value stacking
- beat: belonging → efficiency
- asset_candidates: assets/screens/data-room.png — real "Unified Data Room" with the "Regulatory Compliance Engine": entity archetype, Country of Operation = Nigeria, sector Fintech, jurisdiction chips (Nigeria selected), data-room completeness 40% (1664×985 crop); assets/screens/informal-economy.png — real "Simplified ROCA / CPI Assessment" informal-economy track: plain-language questions (Record Keeping, Group Savings, Leadership & Trust) with Minimal/Basic/Moderate/Strong choices, readiness 2.60 "Developing" (1664×985 crop)
- focal: assets/screens/data-room.png
- roles: data-room = cutout window (left) · informal-economy = supporting window (right)

narrativeRole: it serves everyone, big and small, and saves effort.
keyMessage: one evidence base, many funders — for any size of institution.

- blueprint: grid-card-assemble (Adapt)

Adapt: the cascade is org-type chips; the payoff is a "one → many" diagram.
Scene 1 (0.0–7.2s): clean cream; topbar ("BIG OR SMALL" / "12"). Two window cards sit side by side in the upper 55%: data-room.png (left, label "MINISTRY · AGENCY · NGO · SME") and informal-economy.png (right, label "INFORMAL ENTERPRISE"). Beneath them mono chips cascade on their words: "MINISTRIES" @1.0, "AGENCIES" @1.7, "NGOs" @2.4, "COOPERATIVES" @3.2, "STARTUPS" @4.0, "SMEs" @4.7, "INFORMAL ENTERPRISES" @5.7; when the data-room window appears the camera nudges toward its "Nigeria" jurisdiction chip with a green ring.
Scene 2 (7.2–10.3s): the windows and chips slide up and shrink; on "One evidence base" @7.8 a single pink-deep node "ONE EVIDENCE BASE" appears centre-left; on "reused across funders" @9.1 four hairline spokes draw to four mono nodes on the right: "DONOR", "DFI", "INVESTOR", "GOVERNMENT".
Scene 3 (10.3–13.4s): on "saving time" @10.8 and "resources" @11.3 two green kpi tags pop under the diagram: "LESS TIME" and "FEWER RESOURCES". Hold.

## Frame 13 — Local competence, global relevance

- scene: Become Change Institute logo card; "Built here." → "Local competence. Global relevance."
- voiceover: "And it is built here, by the Become Change Institute. Local competence, for global relevance."
- duration: 7.74s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/13-local.html
- type: branding
- persuasion: Identity / pride
- beat: pride
- asset_candidates: assets/institute-logo.png — Become Change Institute logo (full artwork, placed on a light card, never cropped or recoloured)
- focal: assets/institute-logo.png
- roles: institute-logo = cutout on a light card

narrativeRole: who builds it, and why it matters.
keyMessage: local competence for global relevance.

- blueprint: titlecard-reveal (Adapt)

Adapt: one restrained reveal, then a held two-line title.
Scene 1 (0.0–3.6s): clean cream; headline "Built here." centred on "built here" @0.8; on "Become Change Institute" @1.9 the logo card (cream, 2px green border, 8px radius) slides up beneath it with title-card-sm "Become Change Institute" under the card (exact text only).
Scene 2 (3.6–7.74s): on "Local competence" @4.0 a two-line display title builds right of the card: "Local competence." @4.0 then "Global relevance." @5.4 with "Global" in green. Hold still.

## Frame 14 — Trust, proven

- scene: pink-deep ground; URL pill; CRAFT shield + wordmark; "Trust, proven."
- voiceover: "Take the free Readiness Check, at craftframework dot becomechange dot institute. CRAFT. Trust, proven."
- duration: 10.6s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/14-cta.html
- type: cta
- persuasion: Friction reduction
- beat: urgency-to-act → resolve
- asset_candidates: assets/craft-logo.svg — CRAFT shield logo
- focal: assets/craft-logo.svg
- roles: craft-logo = cutout (centred mark)

narrativeRole: the single next step, then the brand promise.
keyMessage: take the free Readiness Check.

- blueprint: logo-assemble-lockup (Adapt)

Adapt: CTA first, then the shield blooms and the lockup extends to the tagline.
Scene 1 (0.0–5.0s): pink-deep #004F3B ground, cream type. Headline "Take the free Readiness Check" slides up centred on "Take" @0.3; on "craftframework" @2.1 a cream pill with pink-deep mono text "craftframework.becomechange.institute" reveals left→right; mono sub "2 MINUTES · FREE · NO SIGN-UP".
Scene 2 (5.0–7.0s): the CTA block lifts to the top third and shrinks; on "CRAFT" @5.2 the CRAFT shield blooms from zero at centre with the wordmark "CRAFT" in display beside it.
Scene 3 (7.0–10.6s): on "Trust, proven." @6.6–7.3 the tagline lands under the lockup — "Trust," then "proven." with "proven." in brand gold #FFB900; a 2px cream rule draws and a mono foot "BECOME CHANGE INSTITUTE" fades in. Hold to the end; fade the final 0.6s.
