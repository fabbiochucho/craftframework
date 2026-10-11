# Brag Plan: CRAFT

> **Duration override, explicit and intentional.** `/brag`'s standard range is
> 15-25 seconds. The user was told this directly and chose a ~120-second cut
> anyway over the standard format. This plan scales the storyboard
> proportionally (12 scenes instead of 4-5) rather than padding a short video
> with holds - every scene still shows something real from the product. Treat
> the 15-25s guidance in step-2/step-3 references as superseded by this
> explicit choice for this run only.

## What is this app?
CRAFT is an institutional-readiness assessment platform - it scores an
organization's fiduciary and operational maturity across nine real frameworks
(Pact OMT, Global Fund PR FCR, G7/OECD AI governance, ESG, a 7-rung Capital
Readiness Ladder...), turns every gap into a scheduled action plan, and caps
the accreditation grade mathematically if the evidence doesn't back the paper.

## The angle
Institutional assessment tools are usually static PDFs and spreadsheets.
CRAFT is a *living system*: scores update live, a penalty engine refuses to
let policy-on-paper fake its way to a good grade, and the remediation plan
rescales to whatever timeframe the institution actually has. The angle is
"this is software that doesn't let you lie to yourself" - institutional, but
with teeth. High-energy because the product has a genuine amount of real
depth to move through, not because the subject is silly.

## Hook (first 2-3 seconds)
Hard cut to black. A single red stat SLAMS in: **"101 OPEN CRITICAL RISKS."**
One beat of silence-then-impact on the hit. Then the CRAFT wordmark tears in
right behind it. The hook is a real number pulled from the live demo
dashboard, not an invented claim.

## Key moments (the middle)
- The 4 "blindspot" problem cards machine-gunning in one after another
  (Spreadsheet Trap → Sub-National Blindspot → Paper Compliance Illusion →
  Anonymity Gap), each with a hard-cut impact.
- The actual Paper Compliance Penalty code block rendering on screen -
  `if (implementationEvidence < 50%) accreditationLevel = min(accreditationLevel, "C")`
  - real source text from the live Methodology page, typed/revealed, not
  paraphrased.
- The Capacity Plan length control being clicked through live: 6mo → 12mo →
  24mo → a custom "47" typed in, with the heading and due-date column
  rescaling in sync each time. This is a real, just-shipped feature, not a
  mockup.
- The ESG rating badge counting/flipping through letter grades to land on a
  real band (e.g. BBB), next to the Response / Verified Score / Confidence
  stat trio.
- The 7-rung Capital Readiness Ladder lighting up rung by rung from Survival
  to Capital Market Readiness, landing on "Current Rung 3/7."

## Outro / punchline
Hard cut to white-on-emerald. The accreditation badge letters cycle fast
(E → D → C → B...) like a slot machine, then SLAM to a stop on **A**. Cut to
the CRAFT wordmark, tagline, and "Register Your Institution →" CTA over the
live URL.

## User flow worth showing
1. **Entry:** Assessment Wizard - a maturity slider being dragged across a
   0-5 scale, tier counter ticking (Tier 1 of 5...).
2. **Key action:** The live dashboard assembling - composite score counting
   up, accreditation badge landing, the 10-indices radar chart drawing in.
3. **Result:** Findings flow straight into the Capacity Plan - a gap becomes
   a scheduled action with an owner and a due date that rescales live when
   the plan-length control changes.

## Tone
- Preset: `cinematic`, elevated toward `chaotic` energy
- Creative direction: "institutional trailer cut like an action montage" -
  the subject (fiduciary assessment, accreditation, risk) stays serious and
  big-type cinematic, but the cutting rhythm, hard impacts, and dense beat
  sync borrow chaotic's aggression. Nothing about the content is a joke.
- Interpretation: wide dramatic type and confident reveals (cinematic) cut
  together with hard zooms, flash-frames, and tight, fast transitions
  (chaotic). Restraint lives in the copy and claims; energy lives in the cuts
  and the score.

## Format: landscape — 1920x1080
## Duration: ~120 seconds (12 scenes, explicit user override of the 15-25s default - see note at top)

## Visual identity (from the project)
- Background: white (`#ffffff`), hero uses a radial emerald glow
  (`from-emerald-100 via-white to-white`) with soft emerald/amber blur orbs
- Accent: amber (Tailwind `amber-400`/`amber-300`) for CTAs, hits, and highlights
- Primary/text: emerald-900 (deep green, near-black) for headlines and brand;
  slate-600/700 for body copy
- Display font: Playfair Display (serif) - used for "CRAFT" and all headings
- Body font: Inter; monospace accents (code block scene) in JetBrains Mono
- Strongest visual element: the live Readiness Dashboard - accreditation
  badge (circular letter-grade chip), composite score, and the 10-indices
  radar chart

## Share copy (draft)
"We built an institutional assessment tool that mathematically refuses to
grade you on paperwork alone. CRAFT: 9 real frameworks, one accreditation
that can't be faked. →"

## Audio direction
- Role: dense rhythmic layer with cinematic low-end support - this is the
  explicit "energetic and action-packed" brief
- Music: high-BPM cinematic-trailer-hybrid bed (driving percussion, rising
  low synth/brass stabs, no vocals) - candidate: whichever bundled track
  reads as "trailer/percussive/high-energy" in the asset library; Hyperframes
  to confirm exact file at composition time
- Music treatment: cold open on the hook hit (near-silence into one sharp
  stab), then the bed drives continuously under scenes 2-11 with a tempo/
  intensity step-up around the Capacity Plan + ESG + Ladder sequence
  (scenes 7-9), full swell into the outro, hard stop or fast fade on the
  final CTA hold
- Music cue guidance: strongCue targets at 0:00 (hook slam), ~0:14 (turn to
  CRAFT reveal), ~0:52 (Capacity Plan scene start), ~1:08 (outro badge
  slot-machine landing on "A"); beat-grid reveals for the 4 blindspot cards
  (scene 2) and the 9-framework grid (scene 10) - detect exact grid at
  composition time per `audio.md`
- Audio-reactive treatment: subtle-to-moderate; emerald glow/badge presence
  may breathe with bass energy in the dashboard and outro scenes; never add
  literal waveform bars
- SFX posture: moderate-to-dense, motion-matched - hard-hit impacts on every
  slam-in, soft UI clicks on the plan-length buttons and slider drag, a
  distinct "ding" on the accreditation badge landing on A
- Audio-coupled moments: typed code-block reveal (scene 6, with key-tick
  SFX), sequential card reveals (scenes 2 and 10), slider drag (scene 4),
  button-click sequence (scene 7), badge slot-machine cycle (outro)
- Restraint rule: never let SFX density bury the two moments that must read
  cleanly - the penalty-engine code block (scene 6) and the final CTA text
  (outro) get a brief audio pocket (bed ducks slightly) so they're legible

## Storyboard

### Scene 1 — The Hook — 4s
Black screen. "101 OPEN CRITICAL RISKS" slams in, huge, white-on-black, pulled
directly from the live demo dashboard's real stat. Hold 1.5s. Hard cut:
CRAFT wordmark (Playfair Display, emerald) tears in from the right, settles.
Sequential/interaction: none
Audio intent: cold open into one massive hit - make the viewer's chest feel it
Audio-coupled idea: the stat slam and the wordmark tear both get their own hit, not one shared hit
Music: silence until the first hit, then the bed begins under the wordmark
Transition mood: hard → Scene 2

### Scene 2 — The Blindspots — 10s
Four problem cards machine-gun in, one every ~2.2s, each a title + one-line
description, each landing with impact: "The Spreadsheet Trap" → "The
Sub-National Blindspot" → "The Paper Compliance Illusion" → "The Anonymity
Gap." Real copy from the product's own blindspot content, not paraphrased.
Sequential/interaction: yes — 4 cards arrive one by one, each held ~1.8-2s settled before the next hard-cuts in
Audio intent: tension building, each card a drumbeat
Audio-coupled idea: card arrival synced to the beat grid, one hit per card
Music: bed at full rhythmic drive
Transition mood: hard cut → Scene 3

### Scene 3 — The Turn — 6s
Full-bleed CRAFT wordmark again, now bigger and centered, radial emerald
glow blooming behind it. Tagline fades up beneath: "Building Fiduciary Trust
for Direct G2G, DFI and Donor Partnerships." Hold long enough to read in full.
Sequential/interaction: none
Audio intent: the drop - the one breathing moment before the demo starts
Audio-coupled idea: glow bloom synced to a swell in the bed
Music: brief pull-back then re-drive into Scene 4
Transition mood: soft bloom → hard cut into Scene 4

### Scene 4 — Assessment Wizard — 10s
Recreate the Assessment Wizard: a maturity slider (0-5 scale) dragged by a
simulated cursor from 1 to 4, a tier counter ticking "Tier 1 of 5" → "Tier 2
of 5," and a small label "5 Tiers · 20 Domains · 7-Point Evidence Matrix"
settling beside it.
Sequential/interaction: yes — simulate the slider drag and tier counter advancing
Audio intent: mechanical, precise, score-building tension
Audio-coupled idea: slider drag gets a soft mechanical sweep SFX; each tier tick gets a short click
Music: steady drive, no swell yet
Transition mood: clean wipe → Scene 5

### Scene 5 — The Dashboard — 12s
The real Readiness Dashboard assembles live: "Composite Score" counts up to
45%, the accreditation badge lands on "D," "101 Open Critical Risks" stat
settles in red, and the 10-indices radar chart draws its shape outward from
center.
Sequential/interaction: yes — stats and radar chart arrive in sequence, not all at once
Audio intent: the product proving itself - confident, a little ominous on the low grade
Audio-coupled idea: the count-up ticks with the music's rhythm; radar chart draw synced to a rising tone
Music: building intensity
Transition mood: hard cut → Scene 6

### Scene 6 — The Penalty Engine — 8s
A dark terminal-style code block renders on screen, real text from the
product's own Methodology page, typed or revealed line by line:
`if (implementationEvidence < 50%) { accreditationLevel = min(accreditationLevel, "C") }`
Caption beneath: "Paper doesn't count. Execution does."
Sequential/interaction: yes — code types/reveals line by line
Audio intent: a brief audio pocket - bed ducks so the reveal reads clean, then a sharp sting on the caption landing
Audio-coupled idea: key-tick SFX on the typed reveal
Music: ducked under the type, stings back up on caption
Transition mood: hard cut → Scene 7

### Scene 7 — Capacity Plan, Your Timeframe — 12s
The Capacity Plan page: heading reads "24-Month Strengthening Plan." A
cursor clicks "6mo" - heading and the due-date column snap to the new
schedule. Cursor clicks the custom input, types "47" - heading slams to
"47-Month Strengthening Plan," due dates rescale again. Caption: "Any
timeframe. Every due date fits."
Sequential/interaction: yes — simulate two button/typing interactions, each causing a visible rescale
Audio intent: snappy, satisfying, mechanically precise - this is the newest feature, give it confidence
Audio-coupled idea: UI click SFX on each preset click; a distinct "snap" SFX when the plan rescales
Music: full drive resumes
Transition mood: hard cut → Scene 8

### Scene 8 — ESG, Scored Honestly — 10s
The ESG Self-Assessment panel: an E·S·G radar chart draws in, then the
rating badge cycles letters fast and lands on a real band (e.g. "BBB") next
to "Response / Verified Score / Confidence" stats settling in beside it.
Sequential/interaction: yes — radar draws, then badge cycles and lands
Audio intent: a small triumphant hit on the badge landing, grounded not celebratory
Audio-coupled idea: badge letter-cycle gets a fast tick-tick-tick, then a single landing hit
Music: sustained drive
Transition mood: hard cut → Scene 9

### Scene 9 — The Capital Ladder — 10s
The 7-rung Capital Readiness Ladder renders vertically. Rungs light up
bottom-to-top in sequence - Survival, Credibility, Resilience... - each a
quick hard-edged glow, stopping on rung 3 "Resilience" with a "Current Rung
3/7" badge.
Sequential/interaction: yes — 7 rungs light up one by one, accelerating slightly as they climb
Audio intent: a climb - each rung a step up in pitch/intensity
Audio-coupled idea: each rung lighting up gets an ascending tick; the stop on rung 3 gets a firm landing hit
Music: rising pitch/energy through the sequence
Transition mood: hard zoom → Scene 10

### Scene 10 — Nine Frameworks, One System — 10s
A fast grid assembly: nine framework name-chips (Pact OMT · OCA/OPI · Global
Fund PR FCR · G7 AI · OECD AI · GFA Diagnostic · ESG · Capital Ladder · +1)
slam into a 3x3 grid in rapid sequence, then the grid compresses into the
CRAFT wordmark.
Sequential/interaction: yes — 9 chips arrive in fast sequence (beat-grid, ~0.4-0.5s apart is fine here - short labels, not sentences), then the whole grid snaps into the wordmark
Audio intent: a flurry, climax energy
Audio-coupled idea: each chip arrival is a fast tick; the grid-to-wordmark compression gets one big hit
Music: peak intensity
Transition mood: flash cut → Scene 11

### Scene 11 — Pan-African, Public Good — 8s
Trust-signal badges settle in: "Open-source · GPL-3.0" / "Digital Public
Good" / "Pan-African Perspective." Clean, confident, a breath after the
climax of Scene 10.
Sequential/interaction: yes — badges settle in one after another, slower than scene 10
Audio intent: the exhale before the final push
Audio-coupled idea: soft settle sound per badge, no hard hits here
Music: pulls back slightly
Transition mood: soft crossfade → Scene 12

### Scene 12 — Outro / CTA — 20s
Accreditation badge letters cycle fast like a slot machine - E, D, C, B... -
then SLAM to a stop on "A." Hard cut to white-on-emerald: CRAFT wordmark,
tagline "Capacity Readiness & Fiduciary Assurance Toolkit," and "Register
Your Institution →" CTA with the live URL beneath. Final hold.
Sequential/interaction: yes — the slot-machine letter cycle is a sequential reveal that must land decisively on "A"
Audio intent: full triumphant swell into a clean, confident final hold
Audio-coupled idea: letter cycle ticks fast then one decisive landing hit on "A"; music swells under the final card and either hard-stops on the last beat or fades in the final 1.5s
Music: full swell → resolve
Transition mood: final hold (no further transition)

**Music mood for this video:** cinematic/high-energy hybrid - driving, percussive, trailer-scale, no vocals
**Audio summary:** Cold open on one massive hit, then a continuously driving percussive-cinematic bed that steps up in intensity through the product tour (problem → dashboard → new features → framework montage), peaks at the nine-framework grid-compression, briefly exhales for the trust-badge beat, then swells to a decisive full-stop landing on the final accreditation "A" and CTA.
