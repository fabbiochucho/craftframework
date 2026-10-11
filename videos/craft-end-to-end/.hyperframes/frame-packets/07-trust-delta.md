# Frame packet: 07-trust-delta

## Project inputs

- Project: C:\Users\BlackCzarHP\repos\craftframework\videos\craft-end-to-end
- Design tokens: C:\Users\BlackCzarHP\repos\craftframework\videos\craft-end-to-end\frame.md
- RULES_DIR: C:\Users\BlackCzarHP\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 7 — Prove it: Data Room and Trust Delta

- scene: evidence files land in the Data Room; split view — Self-assessed vs Independent score, the Trust Delta gap highlighted between them
- voiceover: "Lodge your evidence in the Data Room. The Trust Delta shows your self-score beside the independent verifier's."
- duration: 7.9s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/07-trust-delta.html
- type: feature_showcase
- persuasion: Transparency as proof
- beat: control
- asset_candidates:

narrativeRole: the verification step that makes trust auditable.
keyMessage: self-score vs independent score, side by side.

- blueprint: comparison-split (Reproduce)

Scene 1 (0.0-2.8s): left-centre: a "Data Room" panel; on "Lodge your evidence" @0.3 three file chips (audited-accounts-2025.pdf, procurement-register.xlsx, board-minutes.pdf) drop into it one after another by @2.0, each stamped "LOGGED" in mono green.
Scene 2 (2.8-5.3s): the Data Room slides out left; two equal cards enter from opposite wings with mirrored book-open tilts on "The Trust Delta" @3.0: left "SELF-ASSESSED" 3.8, right "INDEPENDENT VERIFIER" 3.1; the scores count up as the VO says "self-score @4.3 beside the independent verifier's @5.3".
Scene 3 (5.3-7.9s): inner-edge pill badges spring-pop on each; between them a gold bracket draws and a pill "TRUST DELTA · −0.7" pops into the centre seam. Hold.

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
