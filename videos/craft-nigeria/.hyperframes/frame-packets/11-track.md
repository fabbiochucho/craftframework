# Frame packet: 11-track

## Project inputs

- Project: C:\Users\BlackCzarHP\repos\craftframework\videos\craft-nigeria
- Design tokens: C:\Users\BlackCzarHP\repos\craftframework\videos\craft-nigeria\frame.md
- RULES_DIR: C:\Users\BlackCzarHP\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 11 — Step 05 · Track, and let others review

- scene: real 24-Month Strengthening Plan action tracker (with plan-length selector) → real Trust Delta (self vs independent) → real Portfolio view for funders
- voiceover: "Every gap becomes a costed, owned action. Track progress over time, while your funders and independent reviewers see the same evidence, and the same trail."
- duration: 10.21s
- transition_in: push-slide LEFT
- status: outline
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

## Selected blueprint: comparison-split

# comparison-split — Comparison Split-Cards

**intent**: Two paired items of equal weight shown side-by-side with mirrored 3D "book-open" tilts — the eye reads them as a balanced comparison, then a pill badge lands at each card's inner edge to punctuate. The motion IS the symmetry: two cards arriving from opposite wings into a held spread.

**roles served**

- Key_Feature (from `comparison-split-cards`): when two complementary features / capabilities of equal weight should be presented **simultaneously, not sequentially** — an A/B, a "X + Y together," paired concepts the viewer must weigh side-by-side. Not for >2 items (use `grid-card-assemble`) or sequential steps.

**duration**: 4–6s

**shot structure** (a `[bg]` canvas carrying two faint ambient glow blooms — `[accent A]` near 30%, `[accent B]` near 70% — so each side owns a color identity across a 50% symmetry axis; equal-width cards under one shared perspective parent)

- **Scene 1 (0.0–~0.8s) — title sets the concept.** A centered `[title line]` with an `[accent keyword]` slides DOWN into place from just above (a short smooth settle). The downward arrival is deliberate: it forms a non-conflicting T-shape against the cards, which arrive from the sides next.
- **Scene 2 (~0.4–1.9s) — the split-tilt entry (signature move).** Two equal-width feature cards arrive from opposite wings — `[left card]` from the left, `[right card]` from the right ~0.2s behind — each carrying a **mirrored 3D `rotateY` tilt** (left faces right, right faces left, opening like a book) and scaling ~0.85→1 as it lands. The entry overlaps the title's tail so the whole thing reads as ONE arrival, not two beats. Each card holds `[image / label / subtitle]`; box-shadows fall **outward** from the tilt (left shadow right, right shadow left).
- **Scene 3 (~1.9–end) — badges punctuate, then hold.** A pill `[badge]` lands at each card's **inner edge** (left then right, ~0.3s apart), overlapping its card ~15% so it reads as attached, not orbiting. This is the lone overshoot in the shot — it earns the punctuation. Settles and holds.

**motion vocabulary**: title slide-down from above; mirrored opposite-wing card entry; static book-open `rotateY` tilt (`+tilt` left, `−tilt` right); tilt-matched outward box-shadow; inner-edge badge spring-pop; gentle phase-opposed idle float (left vs right, never synchronized) registered as subtle jitter; dual side-glow ambient.

**rule mapping**

- two cards entering from opposite wings with mirrored `rotateY` tilts + tilt-matched shadow → `split-tilt-cards` (the signature; keep the two-layer split so the entry `x`/`scale` and the idle never collide on one alias)
- title slide-down settle → `gsap-effects` (translate + opacity on a long-tail `power3`)
- inner-edge pill badge pop (the one overshoot) → `spring-pop-entrance` (overshoot register — earns the punctuation)
- phase-opposed idle float on the pair → `sine-wave-loop` (low-amplitude register — subtle jitter, NOT lazy breathing; left `sin(t)`, right `sin(t+π)` so they never conveyor-belt)
- the two faint side glows behind the cards → `ambient-glow-bloom` (un-triggered soft bloom, one per accent)

**camera modifier**: camera-static by default — the symmetry is the subject and a move would break the balance.
