# Hyperframes Composition Brief: CRAFT

> **Duration override, explicit and intentional.** Target is ~120 seconds
> (12 scenes), not the usual 15-25s `/brag` default. The user was told the
> tradeoff directly and chose the long cut. Everywhere the Hyperframes
> workflow's own guidance says "15-25s," read that as "~120s, scaled
> proportionally" for this composition only. The reading-time floors, beat-
> lock discipline (1-3 strong cues per video → scale to ~6-10 for 120s, one
> or two per major scene), and "show the real product" rules still apply in
> full - only the total runtime and scene count are scaled up.

## Objective
Create a ~2-minute, high-energy launch video for CRAFT - an institutional
readiness and fiduciary assurance assessment platform.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~120 seconds

## Source Material
- Project root: `C:\Users\BlackCzarHP\AppData\Local\Temp\craft_inspect\repo`
- Primary files read: `src/pages/LandingPage.tsx`, `src/lib/data.ts`
  (`BRAND`, `BLINDSPOTS`, `LIFECYCLE`, `PANAFRICAN_BADGES`), `src/styles.css`,
  `src/pages/MethodologyPage.tsx` (Paper Compliance Penalty code block),
  `src/pages/DashboardPage.tsx`, `src/pages/CIPPage.tsx`,
  `src/pages/EsgAssessmentPanel.tsx`, `src/pages/CapitalReadinessPanel.tsx`,
  `src/lib/frameworks.ts` (the 9-framework registry)
- Product name: CRAFT
- Tagline / strongest claim: "Capacity Readiness & Fiduciary Assurance
  Toolkit" / "Building Fiduciary Trust for Direct G2G, DFI and Donor
  Partnerships." / the Paper Compliance Penalty: paper policy alone cannot
  buy a grade above Level C.
- Key UI or visual moment to recreate: the live Readiness Dashboard
  (composite score, accreditation badge, 10-indices radar chart); the Paper
  Compliance Penalty code block; the Capacity Plan length control (preset
  buttons + custom input, due dates rescaling live); the ESG rating badge;
  the 7-rung Capital Readiness Ladder.
- Copy that must appear verbatim:
  - "CRAFT" / "Capacity Readiness & Fiduciary Assurance Toolkit"
  - "Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships."
  - "The Spreadsheet Trap", "The Sub-National Blindspot", "The Paper
    Compliance Illusion", "The Anonymity Gap" (and their one-line
    descriptions, see `brag-plan.md` Scene 2)
  - `if (implementationEvidence < 50%) { accreditationLevel = min(accreditationLevel, "C") }`
  - "101 Open Critical Risks" / "Composite Score" / accreditation letter
    grades A-E
  - "24-Month Strengthening Plan" → "6-Month Strengthening Plan" → "47-Month
    Strengthening Plan" (the plan-length control, see Scene 7)
  - "Register Your Institution"
  - The 9 framework short names from `FRAMEWORKS` in `src/lib/frameworks.ts`
    (Pact OMT v6, OCA/OPI, GF PR FCR, G7 AI, OECD AI, GFA Diagnostic, ESG,
    Capital Ladder, + the newest registered one - pull the live list rather
    than hardcoding it, in case it has grown)

## Creative Direction
- Tone preset: `cinematic`, elevated toward `chaotic` energy
- Creative direction: "institutional trailer cut like an action montage" -
  serious, high-stakes subject matter (fiduciary risk, accreditation) shot
  and typeset like a cinematic trailer, but cut with chaotic's hard zooms,
  flash-frames, and tight aggressive transitions.
- Interpretation: wide dramatic type, confident big reveals, and restraint in
  the copy/claims (cinematic) - combined with fast hard cuts, snap zooms, and
  dense beat-synced hits (chaotic). The product's real depth (9 frameworks,
  a working penalty engine, a just-shipped adjustable plan feature) is the
  spectacle; nothing is invented to manufacture energy.
- Angle: Institutional assessment tools are usually static PDFs and
  spreadsheets. CRAFT is a living system - scores update live, a penalty
  engine refuses to let policy-on-paper fake a good grade, and the
  remediation plan rescales to whatever timeframe the institution actually
  has. "Software that doesn't let you lie to yourself."
- Hook: Hard cut to black. "101 OPEN CRITICAL RISKS" slams in (real number
  from the live demo dashboard). One beat of near-silence into the hit, then
  the CRAFT wordmark tears in right behind it.
- Outro / punchline: Accreditation badge letters cycle fast (slot-machine
  energy) E→D→C→B, then SLAM to a stop on "A." Cut to CRAFT wordmark,
  tagline, "Register Your Institution →" CTA over the live URL.
- Avoid:
  - Generic SaaS language ("streamline your workflow," etc.)
  - Abstract filler visuals (color washes, generic particle systems)
  - Any claim, number, or feature name not traceable to the source files
    above
  - Waveform/equalizer visuals, musical-note graphics, or literal strobing

## Visual Identity
- Background: white (`#ffffff`); hero treatment uses a radial emerald glow
  (emerald-100 → white → white) with soft emerald/amber blur orbs in the
  corners
- Text: emerald-900 (deep green-black) for headlines/brand; slate-600/700 for
  body copy; white-on-black or white-on-emerald for high-contrast hook/outro
  cards
- Accent: amber (Tailwind amber-300/400) for CTAs, hit-flashes, and
  highlight chips; rose/red reserved specifically for the "Critical" risk
  stat and off-track indicators (matches the product's own severity color
  coding - don't repurpose red for anything else)
- Display font: Playfair Display (serif) - used for "CRAFT," all scene
  headlines, and the accreditation letter grades
- Body font: Inter - body copy, captions, stat labels
- Monospace accent: JetBrains Mono - reserved for the Paper Compliance
  Penalty code-block scene only, to match how the real product renders it
- Visual references from the project: the circular accreditation-grade
  badge chip; the radar/spider chart shape (reused for both the dashboard's
  10-indices chart and the ESG E·S·G chart - keep their visual language
  consistent since they're the same chart type in the real product); the
  vertical rung-ladder shape; the rounded pill/chip style used throughout
  for stats and badges

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract -
all 12 scenes, their exact durations, on-screen text, sequencing, and audio
intent are specified there in full. Summary:

1. The Hook — 4s — "101 OPEN CRITICAL RISKS" slam, then CRAFT wordmark tears in
2. The Blindspots — 10s — 4 problem cards machine-gun in with real copy
3. The Turn — 6s — CRAFT wordmark + full tagline, the one breathing moment
4. Assessment Wizard — 10s — simulated slider drag, tier counter advancing
5. The Dashboard — 12s — composite score counts up, badge lands on D, radar chart draws
6. The Penalty Engine — 8s — real code block types/reveals, bed ducks for legibility
7. Capacity Plan, Your Timeframe — 12s — live click-through of the plan-length control (the newest feature)
8. ESG, Scored Honestly — 10s — E·S·G radar + rating badge cycling to a landing grade
9. The Capital Ladder — 10s — 7 rungs light up bottom-to-top, lands on rung 3
10. Nine Frameworks, One System — 10s — framework grid slams in, compresses into wordmark
11. Pan-African, Public Good — 8s — trust badges settle, the exhale before the climax
12. Outro / CTA — 20s — accreditation slot-machine lands on "A," final CTA card, hold

## Audio
- Audio role: dense rhythmic layer with cinematic support - matches the
  user's explicit "energetic and action-packed" request
- Audio arc: cold open (near-silence → one hit) → continuous driving bed
  through scenes 2-6 → brief ducked pocket for the code-block scene →
  renewed full drive through 7-9 with rising intensity → peak at the scene
  9→10 framework-grid compression → brief exhale at scene 11 → full swell
  and decisive resolve at the outro
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` - confirmed
  via its bundled cue preset as the highest-tempo track in the library
  (120.19 BPM vs ~110 BPM for the alternatives) and the table's own
  "most energetic" / `default` + high-energy description. Source duration
  163.96s comfortably covers the ~120s runtime without looping - trim/fade
  at the composition's own end rather than at the track's natural end.
- Music treatment: start at ~0 volume under the cold-open hit, in to ~0.35
  under the wordmark tear, sustain through the build, ducks to ~0.15-0.20
  under the Scene 6 code-block reveal only, back to full drive for 7-9,
  swells toward 0.45-0.5 under the Scene 10 climax, pulls back slightly for
  Scene 11, swells again into the outro and either hard-stops on the final
  beat or fades over the last ~1.5s
- Music cue guidance: bundled preset at
  `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`
  (and matching `.md`) - tempo 120.19 BPM. The bundled preset's "Useful Beat
  Grid" only covers its own 0-25s planning window; for the rest of this
  120s composition, re-run cue/beat detection on the same file (e.g.
  `npx hyperframes beats` on the composition once the track is wired in, or
  `analyze_music_cues.py` with a wider window) to get beat/strongCue data
  covering the full ~120s rather than reusing only the first-25s grid.
  Suggested strongCue targets (align to the nearest real detected cue,
  ±0.15s): ~0:00 (hook slam), ~0:14 (Scene 3 wordmark bloom), ~0:52 (Scene 7
  start), ~1:08 (outro slot-machine landing on "A"). This is 4 locks;
  Hyperframes may add 2-4 more at other major scene transitions (still well
  under the "use sparingly" ceiling for a video this long - treat ~1 strong
  lock per 15-20s of runtime as the ceiling, not every scene boundary).
- Audio-reactive treatment: subtle-to-moderate - the dashboard's emerald
  glow/badge presence (Scene 5) and the outro's final card (Scene 12) may
  breathe with bass/RMS energy. No waveform/equalizer visuals.
- Audio-coupled moments:
  - Scene 1 hook stat slam + wordmark tear — two distinct hits, not one shared hit
  - Scene 2 — 4 blindspot cards, each arrival gets its own hit, snapped to the beat grid
  - Scene 4 — slider drag (soft mechanical sweep), tier-tick clicks
  - Scene 6 — typed/revealed code block with key-tick SFX, music ducked for legibility
  - Scene 7 — UI click SFX per preset button + a distinct "snap" SFX on each rescale
  - Scene 8 — fast tick-tick-tick on the badge letter-cycle, one landing hit
  - Scene 9 — ascending tick per rung, firm landing hit on rung 3
  - Scene 10 — 9 framework chips arrive fast (beat-grid, short labels can run closer together than sentence text), one big hit on grid→wordmark compression
  - Scene 12 — fast slot-machine ticks, one decisive hit landing on "A," final swell/resolve
- SFX selection guidance: moderate-to-dense overall, motion-matched to each
  interaction/reveal type above (card-arrival sounds for the blindspot and
  framework-grid sequences; UI click sounds for the plan-length and slider
  interactions; keypress sounds for the code-block typing; impact/bell
  sounds reserved for the biggest payoffs - the wordmark reveal, the
  framework-grid compression, and the final "A" landing)
- SFX analysis guidance: read
  `<skill-dir>/assets/sfx/sfx-analysis.md` / `.json` before final selection;
  prefer low/medium high-frequency-risk files for the moments that repeat
  across the video (card arrivals, UI clicks happen multiple times - don't
  let them fatigue the ear), reserve higher-risk/sharper files for the
  handful of true one-off peak moments (hook slam, "A" landing)
- Exact SFX choice: Hyperframes should choose filenames, timestamps,
  density, and volume based on the implemented animation
- Audio files: copy the chosen music and any Hyperframes-selected SFX into
  `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`
(composition contract + `data-*` timing), `hyperframes-animation` (motion),
`hyperframes-creative` (design spec, beats, audio-reactive),
`hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli`
(lint/check/render). `/brag` is its own workflow: do not enter the
`hyperframes` entry-point intent interview and do not route into its generic
promo / launch-video workflow. Prefer native Hyperframes conventions over
anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source
  project (this composition shows several - the dashboard, the penalty
  code block, the Capacity Plan control, the ESG panel, the Capital Ladder).
- Keep all text readable in the final render - respect the reading-time
  floors from `step-2-plan.md` (short label ~0.8s settled, sentence ~0.3s/
  word) even though this composition is much longer than the usual 15-25s.
- Target runtime ~120 seconds (explicit override - see note at top of this
  brief and in `brag-plan.md`).
- Include the planned music/SFX layer - audio was not disabled.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose exact
  SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides
  exact animation timing and should ignore cues that hurt readability, scene
  pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s.
  Smaller entrances may align to nearby beat points within about 0.10s.
  Scale the strong-cue-lock ceiling to this video's length (roughly one lock
  per 15-20s of runtime, concentrated at the scenes called out above) rather
  than the 1-3-per-video ceiling meant for a 15-25s cut.
- Use SFX to support motion and interaction: card sounds for card-like
  reveals, short announcement cues for major payoffs, key/click sounds for
  text or user actions, and restraint when the edit is already busy.
- Honor the planned music treatment (ducking under the code-block scene,
  beat-aligned reveals, the final swell/resolve) using the best
  Hyperframes-supported implementation.
- When music is present and the treatment is not `none` (it isn't here),
  use the Hyperframes audio-reactive workflow: extract audio data and wire
  RMS/frequency energy to subtle, brand-specific motion (glow, depth, card
  presence). Avoid waveform/equalizer visuals, musical-note graphics,
  generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies.
- Run `hyperframes check` before render — it is brag's single gate.
- Keep creation and rendering local. Remote or publishing workflows require
  a separate explicit user request.
