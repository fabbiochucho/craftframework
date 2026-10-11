# Video direction (shared by every frame — binding)


- palette system (from frame.md, by role): ground = cream #FFFFFF; data frames 1–6 sit on a quiet mint tint #F0FDF4; ink #1E293B for body; pink-deep #004F3B (CRAFT deep green) for display type and hero figures; green #00744D / green-lite #009060 for rules, bars, positive states; ONE alarm accent, brand gold #FFB900, used ONLY where a frame's scene names it (losses, negatives, "less than 1%"); never red. Frame 14 inverts to a pink-deep ground with cream type.
- type: Inter display ramp (weight 500, tight tracking) for claims and figures; `stat-figure` for numbers; JetBrains Mono uppercase `label` / `caption-mono` for chrome, step labels and source lines. Every frame has the topbar spine (mono label left, frame number right).
- citation chrome (frames 1–4 and 6): the source sits as one mono `caption-mono` line with a 2px green rule above, at ~76–80% height, revealed when the figure lands. It is the proof.
- product frames 7–12 show REAL CRAFT screens (assets/screens/*.png, already cropped). Present each inside a flat "window" card: cream frame, 2px green (#00744D) border, 8px radius, no shadow, a thin mono title strip naming the screen. Camera moves are slow push-ins / pans INTO the named region of the screenshot (the image is the world; scale the image inside the window, never distort it). Never redraw or fake product UI; overlays are mono labels, highlight rings (2px gold or green outline) and step chips only.
- walkthrough spine (frames 7–11): a persistent step rail at the top-left in mono — "01 ONBOARD · 02 ASSESS · 03 SCORE · 04 RESULTS · 05 TRACK" — with the current step in pink-deep and the rest muted.
- motion grammar: long-tail power3 eases, smooth over bouncy; every element reveals on its spoken cue (frame-local @seconds given per Scene); count-ups run while the number is spoken; rules draw left→right before the text they underline.
- rhythm: frames 1–4 grave and data-led; 5 lifts; 6 is the turn (slow, held); 7–11 brisk product steps; 12 wide; 13 held pride; 14 held CTA lockup.
- negative list: NEVER the word "DiBadili" in any typed text (institute logo artwork in frame 13 is the single approved exception); no company logos for Flutterwave / Interswitch / Moniepoint / OPay — names are set in type only; no fake UI; no purple/blue AI gradients, no bokeh, no drop shadows; no slideshow (front-load then freeze), no screensaver (independent floating). Nothing important in the bottom ~17% caption band (y > 896px).


## Orchestrator overrides (take precedence over frame.md where they conflict)

- Brand gold #FFB900 IS an approved accent for this film, used only where your Scene lines name it. Do not substitute green for it.
- Fonts: frame.md's captured faces lack basic-Latin Inter 400–700. Add these to your <style> AFTER the frame.md faces, so they win:
  @font-face{font-family:Inter;font-weight:400;font-display:block;src:url("assets/fonts/inter-latin-400.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
  (repeat for weights 500, 600, 700 with inter-latin-500/600/700.woff2). JetBrains Mono: use weight 400 (captured-jetbrains-mono-latin-400-normal-V6pRDFza.woff2); there is no 500 file.
- Every element id and class must START WITH A LETTER (e.g. prefix "f07-"), never a digit. Give every timed element a stable id.
- Exactly one <style> … </style> pair; check it is balanced.
- Real screenshots: show them with <img> inside an overflow:hidden window card; move/scale the IMG (transform) for push-ins and pans; keep aspect ratio; never stretch. Open each screenshot with your Read tool first so you place highlight rings on the actual region.
- Never type the word "DiBadili" anywhere.
