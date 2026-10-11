---
version: alpha
name: Editorial Forest — Frame (video / frame layer)
description: >
  Video-first companion to Editorial Forest's design.md. The unit is the frame (1920×1080). Atoms
  are identical and sacred — the green/pink/cream editorial triad, Inter at weight 500
  (optical-size axis) for all display + JetBrains Mono 500 uppercase chrome, flat paper depth (no
  shadows), 2px hairline rules, 6/8px card radii, and the monogram circle stamp. Composition + frame
  scale rewritten. Motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  green: "#00744D"
  green-deep: "#005B3D"
  green-lite: "#009060"
  pink: "#00BC7D"
  pink-deep: "#004F3B"
  cream: "#FFFFFF"
  cream-2: "#ABFFE3"
  ink: "#1E293B"

typography:
  # — reading + chrome ramp —
  body:    { fontFamily: "Inter", cqw: 1.56, weight: 400, lineHeight: 1.38 }
  body-card:{ fontFamily: "Inter", cqw: 1.35, weight: 400, lineHeight: 1.34 }
  label:   { fontFamily: "JetBrains Mono", px: 26, cqw: 1.35, weight: 500, tracking: "0.18em", upper: true }
  caption-mono:{ fontFamily: "JetBrains Mono", px: 24, cqw: 1.25, weight: 500, tracking: "0.14em", upper: true }
  # — display ramp (Inter weight 500, opsz, negative tracking) —
  title-card-sm:{ fontFamily: "Inter", cqw: 2.9, weight: 500, lineHeight: 0.98, tracking: "-0.01em" }
  title-card:{ fontFamily: "Inter", cqw: 3.5, weight: 500, lineHeight: 0.96, tracking: "-0.01em" }
  headline:{ fontFamily: "Inter", cqw: 4.4, weight: 500, lineHeight: 1.0, tracking: "-0.02em" }
  headline-xl:{ fontFamily: "Inter", cqw: 5.0, weight: 500, lineHeight: 0.96, tracking: "-0.02em" }
  display:{ fontFamily: "Inter", cqw: 7.3, weight: 500, lineHeight: 1.02, tracking: "-0.02em" }
  display-hero:{ fontFamily: "Inter", cqw: 11.5, weight: 500, lineHeight: 0.92, tracking: "-0.02em" }
  stat-figure:{ fontFamily: "Inter", cqw: 11.5, weight: 500, lineHeight: 0.92, tracking: "-0.03em" }
  stat-figure-unit:{ fontFamily: "Inter", cqw: 5.7, weight: 500, lineHeight: 0.92 }
  name:    { fontFamily: "Inter", cqw: 2.3, weight: 600, lineHeight: 1.0 }

spacing:
  slide-pad: "5cqw"
  rule: "2px"
  rule-card: "2.5px"
  radius-card: "6px"
  radius-step: "8px"

components:
  topbar:
    typography: "{typography.label} (JetBrains Mono) + monogram-circle or counter"
    placement: "top edge, label left, mark right"
    description: "On EVERY frame — the system's spine; a frame without it reads untreated."
  footline:
    typography: "{typography.caption-mono} ×2, space-between"
    placement: "absolute bottom edge"
    description: "On cover/data/summary frames."
  monogram-circle:
    border: "2px solid {colors.pink}"
    rounded: "50%"
    size: "130px"
    typography: "mono monogram"
    description: "The identity stamp. Cover/summary only."
  topic-tile:
    backgroundColor: "{colors.green} (pink text) / {colors.pink} (green-deep) / {colors.green-lite} (pink) / {colors.cream-2} + 2px {colors.green} border (green)"
    rounded: "{spacing.radius-card}"
    shadow: "none"
    typography: "{typography.caption-mono} ordinal + {typography.title-card-sm} + mono foot"
    description: "Fills rotate; never repeat one across a grid."
  step-tile:
    backgroundColor: "{colors.cream} + green border / {colors.green} / {colors.pink}"
    border: "2.5px solid"
    rounded: "{spacing.radius-step}"
    typography: "mono ordinal + {typography.title-card} + {typography.body-card} + mono marker over a top rule"
    description: "Framework/process card."
  kpi-block:
    typography: "{typography.caption-mono} tag → {typography.stat-figure} (+{typography.stat-figure-unit}) → {typography.body}"
    rule: "2px accent rule above"
    description: "Oversized serif figure."
  meta-dl:
    borderTop: "2px solid {colors.green}"
    typography: "{typography.caption-mono} dt + {typography.meta-value} dd"
    description: "3-column dt/dd grid."
  bar:
    backgroundColor: "{colors.pink} / {colors.cream} / {colors.green}"
    rounded: "3px 3px 0 0"
    size: "56px wide"
    typography: "mono value above"
    description: "Vertical chart bar."
  rule-thin:
    rule: "2px solid (green on cream / pink on green / green-deep on pink)"
    description: "The only separator. Never 1px, never 3px+."
---

# Editorial Forest — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **editorial-forest** preset remixed onto the captured brand. The YAML frontmatter above (colors · typography · components) is **normative and already correct — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — already set to **Inter** (display) / **Playfair Display** (body); ignore any preset font name lingering in prose.
- **Weights** — the brand font ships `{300, 400, 500, 600, 700, 800}` only; every weight is clamped to these — ignore higher preset weights (e.g. 600/700) in prose.
- **Colors** — use the frontmatter hex; preset color NAMES in prose (e.g. "cobalt", "cream") mean the remapped brand values.


## Overview

Editorial Forest at frame scale is a **serif-led literary-editorial system** — the register of a
Penguin classic or a quiet annual report. One confident voice, **Inter at weight 500**
(optical-size axis engaged), carries every headline and stat up to ~12cqw; **JetBrains Mono** at
weight 500 uppercase is the editorial chrome (labels, captions, axis ticks, footlines). Three
surfaces — forest green, dusty rose, oat cream — and nothing else. Depth is **flat and paper-based**:
no shadows, no gradients; elevation is color-block contrast + 2px hairlines + border-vs-fill.

The unmistakable signature is **weight 500** (never 400 display, never 700) and the **mono/serif
role inversion** (mono for chrome, serif for body and display). Body text drops to serif weight
400 — that 500→400 step is the reading rhythm. Every frame carries a mono topbar; the monogram
circle is the identity stamp.

**Key characteristics at frame scale:**

- **Green / pink / cream triad** — two surface tones per frame is typical, three is loud.
- **Inter weight 500** (opsz, negative tracking) for all display; **serif 400** body; **JetBrains Mono 500** uppercase chrome.
- **Flat — no shadows, no gradients**; elevation is color-block + 2px hairline + border-vs-fill.
- **2px hairline rules** are the only separator (2.5px on step tiles); 6/8px card radii; the monogram circle is the only full round.
- **Topbar on every frame** (mono label + monogram/counter); footline on data/cover frames.
- **Spacious & committed** — one subject per frame in deep negative space; fewer elements at larger sizes.

## The Frame

### Frame Craft Bar

Three eyeball tests gate every frame before any structural check:

- **Squint** — one Inter moment dominates at 3–6× its neighbor; the surface block centers the eye.
- **Silence** — one subject per frame in deep negative space; the **topic-tile and step grids are the one dense exception**.
- **Restraint** — **two surface tones max** per frame (three is loud); serif **weight 500** display / **400** body; green ground reserved for gravity moments.
- **Reference** — aim at a **Penguin classic / quiet annual report / art-book spread**; failure looks like a **shadowed, multi-color web dashboard**.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `slide-pad` 5cqw (the source's generous 96–140px); the topbar/footline sit inside it.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw` (the source is a fixed 1920 canvas, so
its px map cleanly: `px ÷ 1920 × 100`). Hairlines stay 2px; card radii stay 6/8px.

## Colors

Tokens identical to the source. Default ground `{colors.cream}` for content; `{colors.green}` for
cover/statement/summary gravity. **Headlines:** green on cream, cream (or pink at hero scale) on
green, green-deep on pink. **Body:** ink on cream, cream on green, green-deep on pink. Labels/rules
take the region's accent (pink on green, green on cream, green-deep on pink). Tile fills rotate
green / pink / green-lite / cream-2-with-green-border. **No fourth color family** — the triad +
near-duplicates is the whole palette; never `rgba` transparency on a surface.

## Typography

Two ramps. The **reading/chrome ramp** (Inter **400** body 1.56cqw; JetBrains Mono labels
in px) carries copy + chrome; the **display ramp** (Inter **500** `title-card-sm` 2.9cqw →
`display-hero`/`stat-figure` 11.5cqw, opsz, negative-tracked) carries every headline + figure.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; mono px labels are chrome only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `display-hero`; 4–6 → `headline-xl`; 7+ → `headline`. Reserve the 7.3–11.5cqw tier for statement/stat/cover.
- **Serif is weight 500 for display, 400 for body** (the rhythm), 600 only for an attribution name. Negative tracking (−0.01..−0.03em), tight line-height (0.92–1.02). **Mono uppercase, 0.08–0.18em.** No italic, no underline, no third face, no serif body at 500.

## Depth & Surface

Flat, paper-based. Elevation from:

- **Color-block contrast** — a green tile on cream reads elevated by ink-block separation.
- **2px hairline rules** — section separators in the region's accent.
- **Border vs fill** — a cream-2 tile + 2px green border reads a different elevation than a solid tile.

**Ceiling:** zero shadow (none — adding `box-shadow` shatters the paper feel), no gradient, no glow; surfaces are solid ink-on-paper.

## Shapes

- **6px** topic tiles, **8px** step tiles, **2px** legend swatch, **3px 3px 0 0** bar tops, **50%** monogram circle. No square corners, no heavy rounding.

## Components

- **topbar** (the spine) + **footline** + **monogram-circle** (identity stamp) — the chrome set.
- **topic-tile** (6px, rotating fills) / **step-tile** (8px, 2.5px border) — the catalog + framework patterns.
- **kpi-block** (oversized serif figure) / **meta-dl** (3-col, 2px rule) / **bar** / **rule-thin** — data + structure.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · silence · Fixed/Free · density.
> Topbar on every frame; one subject per frame in deep negative space.

### 1 · Cover (identity · move: oversized serif · green · left)

**Ground** `{colors.green}`, `slide-pad`. **Composes** topbar (mono label + monogram-circle), display-hero, body lede, footline. **Focal** a 2-line Inter `display-hero` in pink (one word in cream), left. **Chrome** mono topbar; mono footline. **Accent** pink display + the monogram circle. **Silence** ~50%. **Fixed** serif 500, flat, monogram 2px pink. **Free** title, which word is cream. **Density** low.

### 2 · Topic Tiles (catalog · move: rotating-fill grid · cream · the dense frame)

**Ground** `{colors.cream}`, `slide-pad`. **Composes** topbar, headline-xl, 3–4× topic-tile. **Focal** a row of 6px tiles, fills rotating green / pink / cream-2-with-border, each a mono ordinal + serif title. **Chrome** mono topbar. **Accent** the tile fills (mix 3 of 4, never repeat one). **Silence** tight — the density exception. **Fixed** 6px radius, rotating fills, no shadow. **Free** tile titles, which fills. **Density** dense-exception.

### 3 · KPI Stat (data · move: oversized figure · green)

**Ground** `{colors.green}`, `slide-pad`. **Composes** topbar, kpi-block (mono tag + 220px stat-figure + serif description), footline. **Focal** a Inter `stat-figure` (~11.5cqw, +unit) in pink over a 2px pink rule. **Chrome** mono topbar + footline. **Accent** the pink figure. **Silence** ~55%. **Fixed** serif 500 figure, 2px accent rule, flat. **Free** the figure (from script), tag, description. **Density** low.

### 4 · Statement (quote · move: display serif · cream · left)

**Ground** `{colors.cream}`, generous pad. **Composes** topbar, display, name (600), caption-mono role. **Focal** a 2-line Inter `display` (~7.3cqw) in green; a 600-weight attribution name + mono role beneath. **Chrome** mono topbar. **Accent** none — the serif carries it. **Silence** ~55%. **Fixed** serif 500 display + 600 name only, no italic. **Free** quote, name, role. **Density** low.

### 5 · Step Framework (process · move: 8px step tiles · cream/green)

**Ground** `{colors.cream}` (or green), `slide-pad`. **Composes** topbar, headline, 3–4× step-tile. **Focal** a row of 8px step tiles (2.5px border) — mono ordinal + serif 68px title + body + mono marker over a top rule; fills rotate cream-with-green-border / green / pink. **Accent** the tile fills. **Silence** moderate. **Fixed** 8px radius, 2.5px border, mono markers. **Free** steps, fills. **Density** standard.

### 6 · Chart (data · move: bars + meta · green)

**Ground** `{colors.green}`, `slide-pad`. **Composes** topbar, headline, bars + 2px axis rules, meta-dl. **Focal** 56px pink/cream/green bars on inner-edge 2px rules with mono ticks; an optional 3-col meta-dl beneath. **Chrome** mono topbar. **Accent** the bar fills. **Silence** moderate. **Fixed** 56px bars, 3px tops, 2px axes, mono ticks. **Free** values (from script), labels. **Density** standard.

## Composition Rules

### Do

- Run every display in **Inter weight 500**, opsz, negative-tracked, tight line-height; **body at 400**.
- Set every label/caption/axis/footline in **JetBrains Mono 500 uppercase, 0.08–0.18em**.
- Give every frame a **topbar** (mono label + monogram or counter); footline on data/cover.
- Pick **one dominant surface per frame** (max two tones); **rotate tile fills**, never repeat one across a grid.
- Separate sections with **2px hairlines** in the region's accent; reserve the monogram circle for cover/summary.
- Scale display aggressively (7.3–11.5cqw) for statement/stat/cover; lean left/editorial, one subject per frame.

### Don't

- No box-shadow, gradient, or glow — flat, paper-based depth only.
- No third typeface; no italic/underline; no serif body at 500; no mono at headline scale.
- No fourth color family; no `rgba` surfaces; no 1px or 4px+ rules (2px / 2.5px only).
- No two competing content blocks; don't omit the topbar.
- Don't blow a headline edge-to-edge — step the ramp down.

## Aspect-Ratio Behavior

| Treatment      | 16:9                             | 9:16                        | 1:1                      |
| -------------- | -------------------------------- | --------------------------- | ------------------------ |
| Cover          | display left, monogram top-right | display top, monogram below | display, monogram corner |
| Topic Tiles    | 3–4 across                       | stacked                     | 2×2                      |
| KPI Stat       | figure left                      | figure centered, taller     | centered                 |
| Statement      | quote left                       | quote stacked               | centered                 |
| Step Framework | 3–4 across                       | stacked                     | 2×2                      |
| Chart          | bars + meta                      | bars taller, meta stacks    | square chart             |

`slide-pad` holds on the short edge; re-step display above the 1.4cqw floor. Topbar spans the top
on every ratio; the monogram may drop to a corner.

## Approved Real Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. The monogram, footline strings, and tile counters carry per-deck identity; figures are content.

## Numerals & Claims (hard rule)

Never invent figures, KPIs, dates, or counts at frame scale. Render slots as `— figure —`,
`{metric}`, `— %`. KPI blocks, bars, and meta values especially carry placeholders until the script
supplies them. Issue numbers / counters are decorative chrome.

## Pre-Render Self-Audit

- **Squint** — one serif moment dominates; the surface block centers the eye.
- **Silence** — one subject per frame in deep negative space; only the topic-tile/step grids run dense.
- **Triad** — two surface tones max; headlines/body/labels use the correct per-surface color; no fourth family.
- **Type** — Inter **500** display (opsz, negative-tracked) / **400** body; mono uppercase 0.08–0.18em; ≥1.4cqw floor.
- **Depth** — 0 shadow, 0 gradient; 2px hairlines; 6/8px radii; monogram the only full round.
- **Chrome** — topbar present on every frame; footline on data/cover.
- **Fabrication** — every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only; the source relies on `deck-stage.js` for scaling/nav, no transition spec.
- **Inter (opsz 8..60) + JetBrains Mono via Google Fonts** — the optical-size axis is critical; a non-opsz fallback flattens the size-aware letterforms. CJK: LXGW WenKai (display) / Noto Serif SC (body) / Noto Sans Mono CJK (chrome).
- **9:16 / 1:1 are guidance**; verify the floor and that two-tone discipline holds per ratio.
- Bars, hairlines, tiles, and the monogram circle are CSS-only; no external imagery is required.
- **Contrast:** green-on-pink / pink-on-green only at display scale (84px+); keep small text cream-on-green or ink-on-cream.


## Font loading (auto-generated)

The brand font ships as local files in `assets/fonts/` — do NOT link Google Fonts for it. Paste this `<style>` into every frame's `<head>`/`<template>` (captions use the same files) so `font-family` resolves in preview, snapshot, and render alike:

```html
<style>
@font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:300;src:url("assets/fonts/captured-inter-latin-ext-300-normal-CPgO9Ksf.woff2") format("woff2"), url("assets/fonts/captured-inter-latin-ext-300-normal-Dp1L8vcn.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:300;src:url("assets/fonts/captured-inter-latin-300-normal-BVlfKGgI.woff2") format("woff2"), url("assets/fonts/captured-inter-latin-300-normal-i8F0SvXL.woff") format("woff");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:400;src:url("assets/fonts/captured-inter-latin-ext-400-normal-C1nco2VV.woff2") format("woff2"), url("assets/fonts/captured-inter-latin-ext-400-normal-77YHD8bZ.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Playfair Display;font-style:normal;font-display:swap;font-weight:500;src:url("assets/fonts/captured-playfair-display-latin-ext-500-normal-DE-Iylxw.woff2") format("woff2"), url("assets/fonts/captured-playfair-display-latin-ext-500-normal-CFxFMdkY.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Playfair Display;font-style:normal;font-display:swap;font-weight:500;src:url("assets/fonts/captured-playfair-display-latin-500-normal-DIxvyhka.woff2") format("woff2"), url("assets/fonts/captured-playfair-display-latin-500-normal-BScSeVwi.woff") format("woff");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Playfair Display;font-style:normal;font-display:swap;font-weight:600;src:url("assets/fonts/captured-playfair-display-latin-ext-600-normal-CEjQclLc.woff2") format("woff2"), url("assets/fonts/captured-playfair-display-latin-ext-600-normal-BumBfC1v.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:JetBrains Mono;font-style:normal;font-display:swap;font-weight:400;src:url("assets/fonts/captured-jetbrains-mono-latin-ext-400-normal-Bc8Ftmh3.woff2") format("woff2"), url("assets/fonts/captured-jetbrains-mono-latin-ext-400-normal-fXTG6kC5.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:JetBrains Mono;font-style:normal;font-display:swap;font-weight:400;src:url("assets/fonts/captured-jetbrains-mono-latin-400-normal-V6pRDFza.woff2") format("woff2"), url("assets/fonts/captured-jetbrains-mono-latin-400-normal-6-qcROiO.woff") format("woff");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:JetBrains Mono;font-style:normal;font-display:swap;font-weight:600;src:url("assets/fonts/captured-jetbrains-mono-latin-ext-600-normal-BfB_LPfz.woff2") format("woff2"), url("assets/fonts/captured-jetbrains-mono-latin-ext-600-normal-DObL3zCW.woff") format("woff");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
</style>
```
