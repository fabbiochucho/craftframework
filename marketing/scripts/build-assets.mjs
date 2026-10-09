// Generates the CRAFT launch kit: social graphics, banners and logo lockups as
// SVG + PNG in public/launch/, a downloadable zip, and marketing/launch-copy.md.
//
// Usage (from the repo root, Node 22.18+ for TypeScript type stripping):
//   node marketing/scripts/build-assets.mjs
// Requires `rsvg-convert` and `zip` on PATH. For brand-accurate PNGs install
// the Playfair Display, Inter and JetBrains Mono fonts locally first (the
// @fontsource packages in node_modules ship .woff files you can install).

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LAUNCH, KEY_MESSAGES, AUDIENCES, BOILERPLATE, ONE_LINERS, SOCIAL_POSTS,
  LAUNCH_EMAIL, PRESS_RELEASE, PRESS_CONTACT,
} from '../../src/lib/launch.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'public', 'launch')

// --- Brand tokens -----------------------------------------------------------
const C = {
  ink: '#022c22', deep: '#064e3b', emerald: '#10b981', mint: '#34d399', sage: '#94d3bf',
  gold: '#fbbf24', goldLight: '#fde68a', white: '#ffffff', paper: '#f8fafc', slate: '#475569',
}
const SERIF = "'Playfair Display','Georgia',serif"
const SANS = "'Inter','Helvetica Neue',Arial,sans-serif"
const MONO = "'JetBrains Mono','Courier New',monospace"

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The Prism shield mark, drawn in a 512 unit box (matches public/logo.svg).
const MARK_DEFS = `
  <linearGradient id="mShield" x1="256" y1="96" x2="256" y2="470" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#065f46"/><stop offset="0.55" stop-color="#064e3b"/><stop offset="1" stop-color="#022c22"/>
  </linearGradient>
  <linearGradient id="mDelta" x1="256" y1="150" x2="256" y2="364" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fcd34d"/><stop offset="0.16" stop-color="#fbbf24"/><stop offset="0.46" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/>
  </linearGradient>
  <radialGradient id="mSpark" cx="256" cy="176" r="46" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
  </radialGradient>
  <filter id="mGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`

const SHIELD = 'M134 116 H378 Q402 116 402 140 V296 Q402 398 256 466 Q110 398 110 296 V140 Q110 116 134 116 Z'
const DELTA = 'M256 152 L364 360 H148 Z M256 240 L308 332 H204 Z'

function mark(x, y, size, { stroke = false } = {}) {
  const s = size / 512
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="${SHIELD}" fill="url(#mShield)" ${stroke ? 'stroke="#10b981" stroke-opacity="0.55" stroke-width="5"' : ''}/>
    <path d="M158 156 H354 Q372 156 372 174 V292 Q372 372 256 426 Q140 372 140 292 V174 Q140 156 158 156 Z" fill="none" stroke="#10b981" stroke-opacity="0.35" stroke-width="6"/>
    <path d="M256 156 V196 M158 292 H210 M354 292 H302" stroke="#34d399" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
    <circle cx="256" cy="178" r="44" fill="url(#mSpark)"/>
    <path fill-rule="evenodd" fill="url(#mDelta)" filter="url(#mGlow)" d="${DELTA}"/>
  </g>`
}

// Dark emerald canvas with halo, faint delta lattice and a gold top rule.
function canvas(w, h, body, { haloX = w * 0.3, haloY = h * 0.5, rule = true } = {}) {
  const r = Math.max(w, h) * 0.55
  const tile = Math.round(Math.min(w, h) / 9)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
  <defs>${MARK_DEFS}
    <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#022c22"/><stop offset="0.6" stop-color="#03291f"/><stop offset="1" stop-color="#021712"/>
    </linearGradient>
    <radialGradient id="halo" cx="${haloX}" cy="${haloY}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#10b981" stop-opacity="0.26"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldHalo" cx="${w}" cy="${h}" r="${r * 0.8}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbbf24" stop-opacity="0.12"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lattice" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
      <path d="M${tile / 2} ${tile * 0.28} L${tile * 0.72} ${tile * 0.68} H${tile * 0.28} Z" stroke="#34d399" stroke-opacity="0.07" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#lattice)"/>
  <rect width="${w}" height="${h}" fill="url(#halo)"/>
  <rect width="${w}" height="${h}" fill="url(#goldHalo)"/>
  ${rule ? `<rect width="${w}" height="${Math.max(6, Math.round(h / 105))}" fill="${C.gold}"/>` : ''}
  ${body}
</svg>`
}

function text(x, y, str, { size, font = SANS, weight = 400, fill = C.white, anchor = 'start', spacing = 0, opacity } = {}) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}"${opacity ? ` fill-opacity="${opacity}"` : ''}>${esc(str)}</text>`
}
const lines = (x, y, arr, lh, opts) => arr.map((l, i) => text(x, y + i * lh, l, opts)).join('\n  ')

function pill(x, y, label, { size = 20, anchor = 'start' } = {}) {
  const w = label.length * size * 0.84 + size * 2
  const h = size * 2.1
  const left = anchor === 'middle' ? x - w / 2 : x
  return `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fbbf24" fill-opacity="0.12" stroke="${C.gold}" stroke-opacity="0.6" stroke-width="1.5"/>
  ${text(left + w / 2, y + h * 0.66, label, { size, weight: 700, fill: C.gold, anchor: 'middle', spacing: size * 0.16, font: SANS })}`
}

const urlLine = (x, y, size, anchor = 'start') =>
  text(x, y, LAUNCH.displayUrl, { size, font: MONO, weight: 500, fill: C.mint, anchor })

// --- Social graphics ---------------------------------------------------------
const graphics = {
  // LinkedIn / Facebook link share & feed landscape
  'craft-launch-1200x627': canvas(1200, 627, `
  ${mark(70, 120, 400)}
  ${pill(520, 120, 'LAUNCHING 12 OCTOBER 2026', { size: 17 })}
  ${lines(520, 252, ['Fiduciary trust,', 'built on evidence.'], 68, { size: 60, font: SERIF, weight: 700 })}
  ${lines(522, 380, ['Readiness scoring, capacity plans and Trust Delta', 'verification for G2G, DFI and donor partnerships.'], 32, { size: 21, fill: C.sage })}
  ${text(522, 500, 'CRAFT · DiBadili Institute', { size: 18, weight: 700, fill: C.white, spacing: 2 })}
  ${urlLine(522, 534, 18)}`, { haloX: 270 }),

  // X / Twitter in-stream image (16:9)
  'craft-launch-1600x900': canvas(1600, 900, `
  ${mark(110, 190, 520)}
  ${pill(720, 190, 'LAUNCHING 12 OCTOBER 2026', { size: 22 })}
  ${lines(720, 360, ['The new standard', 'for institutional', 'readiness.'], 92, { size: 80, font: SERIF, weight: 700 })}
  ${text(722, 650, 'Capacity Readiness & Fiduciary Assurance Toolkit', { size: 27, fill: C.sage })}
  ${urlLine(722, 730, 25)}`, { haloX: 370 }),

  // Instagram / LinkedIn square: save the date
  'craft-save-the-date-1080x1080': canvas(1080, 1080, `
  ${mark(390, 120, 300)}
  ${text(540, 500, 'SAVE THE DATE', { size: 28, weight: 700, fill: C.gold, anchor: 'middle', spacing: 10 })}
  ${text(540, 650, '12.10.2026', { size: 150, font: SERIF, weight: 800, anchor: 'middle' })}
  <rect x="440" y="700" width="200" height="3" fill="${C.gold}" fill-opacity="0.7"/>
  ${text(540, 780, 'CRAFT launches.', { size: 46, font: SERIF, weight: 700, anchor: 'middle' })}
  ${text(540, 840, 'Capacity Readiness & Fiduciary Assurance Toolkit', { size: 25, fill: C.sage, anchor: 'middle' })}
  ${urlLine(540, 970, 24, 'middle')}`, { haloX: 540, haloY: 290 }),

  // Instagram / LinkedIn square: launch day
  'craft-now-live-1080x1080': canvas(1080, 1080, `
  ${mark(90, 100, 180)}
  ${pill(90, 330, 'NOW LIVE', { size: 22 })}
  ${lines(90, 500, ['CRAFT is', 'here.'], 130, { size: 130, font: SERIF, weight: 800 })}
  ${[
    '5 tiers · 20 domains · evidence-backed scoring',
    'Costed 24-month Capacity Improvement Plans',
    'Universal Data Room & Trust Delta verification',
    'Open source digital public good',
  ].map((t, i) => `<circle cx="104" cy="${752 + i * 56}" r="7" fill="${C.gold}"/>${text(130, 761 + i * 56, t, { size: 27, fill: C.white, opacity: '0.92' })}`).join('\n  ')}
  ${urlLine(90, 1010, 24)}`, { haloX: 180, haloY: 190 }),

  // Instagram / LinkedIn square: key message quote card
  'craft-paper-compliance-1080x1080': canvas(1080, 1080, `
  ${text(84, 410, '“', { size: 260, font: SERIF, weight: 800, fill: C.gold })}
  ${lines(90, 420, ['Paper compliance', 'never inflates', 'a score.'], 110, { size: 96, font: SERIF, weight: 700 })}
  ${lines(92, 760, ['CRAFT rewards what institutions actually do,', 'not what their manuals say.'], 40, { size: 28, fill: C.sage })}
  ${mark(90, 880, 120)}
  ${text(230, 935, 'CRAFT · Launching 12 October 2026', { size: 24, weight: 700, spacing: 1 })}
  ${urlLine(230, 972, 21)}`, { haloX: 800, haloY: 300 }),

  // Instagram / Facebook / WhatsApp story (9:16)
  'craft-launch-story-1080x1920': canvas(1080, 1920, `
  ${mark(290, 220, 500)}
  ${text(540, 840, 'CRAFT', { size: 190, font: SERIF, weight: 800, anchor: 'middle', spacing: 6 })}
  ${text(540, 915, 'Capacity Readiness & Fiduciary Assurance Toolkit', { size: 30, fill: C.sage, anchor: 'middle' })}
  ${pill(540, 1010, 'LAUNCHING 12 OCTOBER 2026', { size: 28, anchor: 'middle' })}
  ${lines(540, 1250, ['Prove your institution is ready', 'for direct G2G, DFI and', 'donor partnerships.'], 64, { size: 50, font: SERIF, weight: 700, anchor: 'middle' })}
  <rect x="140" y="1580" width="800" height="110" rx="55" fill="${C.gold}"/>
  ${text(540, 1648, 'craftframework.becomechange.institute', { size: 30, font: MONO, weight: 700, fill: C.ink, anchor: 'middle' })}
  ${text(540, 1780, 'A DiBadili Institute digital public good', { size: 26, fill: C.sage, anchor: 'middle' })}`, { haloX: 540, haloY: 470 }),

  // LinkedIn company/personal cover (profile photo sits bottom-left, so content is right-weighted)
  'craft-linkedin-banner-1584x396': canvas(1584, 396, `
  ${mark(560, 70, 256)}
  ${text(830, 170, 'CRAFT', { size: 84, font: SERIF, weight: 800, spacing: 3 })}
  ${text(832, 220, 'Capacity Readiness & Fiduciary Assurance Toolkit', { size: 26, fill: C.sage })}
  ${pill(832, 255, 'LIVE 12 OCTOBER 2026', { size: 16 })}
  ${urlLine(832, 335, 19)}`, { haloX: 690, haloY: 200 }),

  // X / Twitter header (avatar overlaps bottom-left)
  'craft-x-header-1500x500': canvas(1500, 500, `
  ${mark(520, 110, 280)}
  ${text(820, 230, 'CRAFT', { size: 96, font: SERIF, weight: 800, spacing: 3 })}
  ${text(822, 285, 'Building fiduciary trust for G2G, DFI', { size: 27, fill: C.sage })}
  ${text(822, 320, 'and donor partnerships.', { size: 27, fill: C.sage })}
  ${urlLine(822, 395, 21)}`, { haloX: 660, haloY: 250 }),

  // Email header / newsletter hero
  'craft-email-header-1200x400': canvas(1200, 400, `
  ${mark(80, 70, 260)}
  ${pill(380, 100, 'LAUNCHING 12 OCTOBER 2026', { size: 15 })}
  ${text(380, 215, 'Introducing CRAFT', { size: 60, font: SERIF, weight: 700 })}
  ${text(382, 265, 'Capacity Readiness & Fiduciary Assurance Toolkit', { size: 22, fill: C.sage })}
  ${urlLine(382, 315, 17)}`, { haloX: 210, haloY: 200 }),
}

// --- Logo lockups --------------------------------------------------------------
function lockup(onDark) {
  const w = 880, h = 360
  const fg = onDark ? C.white : '#064e3b'
  const sub = onDark ? C.sage : C.slate
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
  <defs>${MARK_DEFS}</defs>
  ${mark(20, 20, 320, { stroke: onDark })}
  ${text(340, 200, 'CRAFT', { size: 150, font: SERIF, weight: 800, fill: fg, spacing: 4 })}
  ${text(346, 262, 'ICARF v4.0 · DiBadili Institute', { size: 34, fill: sub, weight: 500, spacing: 1 })}
</svg>`
}

const monoMark = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <path fill-rule="evenodd" fill="#ffffff" d="${SHIELD} ${DELTA}"/>
</svg>`

const fullMark = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>${MARK_DEFS}</defs>
  ${mark(0, 0, 512)}
</svg>`

const logos = {
  'craft-mark': fullMark,
  'craft-mark-mono-white': monoMark,
  'craft-lockup-light-bg': lockup(false),
  'craft-lockup-dark-bg': lockup(true),
}

// --- Markdown copy deck -------------------------------------------------------
function copyDeck() {
  const md = []
  md.push(`# CRAFT launch copy deck\n`)
  md.push(`Launch date: **${LAUNCH.dateLong}** · Site: ${LAUNCH.url} · Contact: ${LAUNCH.contactEmail}\n`)
  md.push(`> Generated from \`src/lib/launch.ts\` by \`marketing/scripts/build-assets.mjs\`. Edit the TypeScript source, then re-run the script.\n`)
  md.push(`## Headline\n\n${LAUNCH.headline}\n`)
  md.push(`## Key messages\n`)
  KEY_MESSAGES.forEach(m => md.push(`- **${m.title}:** ${m.body}`))
  md.push(`\n## Audiences\n`)
  AUDIENCES.forEach(a => md.push(`- **${a.name}:** ${a.pitch}`))
  md.push(`\n## One-liners\n`)
  ONE_LINERS.forEach(l => md.push(`- ${l}`))
  md.push(`\n## Boilerplate\n\n**Short:** ${BOILERPLATE.short}\n\n**Medium:** ${BOILERPLATE.medium}\n\n**About the DiBadili Institute:** ${BOILERPLATE.institute}\n`)
  md.push(`## Hashtags\n\n${LAUNCH.hashtags.join(' ')}\n`)
  md.push(`## Social posts\n`)
  SOCIAL_POSTS.forEach(p => md.push(`### ${p.channel} · ${p.phase}\n\n\`\`\`\n${p.text}\n\`\`\`\n`))
  md.push(`## Launch email\n\n**Subject:** ${LAUNCH_EMAIL.subject}  \n**Preheader:** ${LAUNCH_EMAIL.preheader}\n\n\`\`\`\n${LAUNCH_EMAIL.body}\n\`\`\`\n`)
  md.push(`## Press release\n\n${PRESS_RELEASE.dateline}\n\n### ${PRESS_RELEASE.title}\n\n*${PRESS_RELEASE.subtitle}*\n`)
  PRESS_RELEASE.paragraphs.forEach(p => md.push(`${p}\n`))
  md.push(`**About the DiBadili Institute**\n\n${BOILERPLATE.institute}\n`)
  md.push(`**Media contact:** ${PRESS_CONTACT.name} · ${PRESS_CONTACT.email} · ${PRESS_CONTACT.web}\n\n###\n`)
  return md.join('\n')
}

// --- Build ----------------------------------------------------------------------
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

function render(name, svg, scale = 1) {
  const svgPath = join(out, `${name}.svg`)
  writeFileSync(svgPath, svg)
  execFileSync('rsvg-convert', ['-z', String(scale), '-o', join(out, `${name}.png`), svgPath])
}

for (const [name, svg] of Object.entries(graphics)) render(name, svg)
for (const [name, svg] of Object.entries(logos)) render(name, svg, name.includes('mark') ? 2 : 1)

const deck = copyDeck()
writeFileSync(join(root, 'marketing', 'launch-copy.md'), deck)
writeFileSync(join(out, 'craft-launch-copy.md'), deck)
copyFileSync(join(root, 'marketing', 'brand-guidelines.md'), join(out, 'craft-brand-guidelines.md'))

const files = readdirSync(out).filter(f => !f.endsWith('.zip'))
execFileSync('zip', ['-q', '-j', join(out, 'craft-launch-kit.zip'), ...files.map(f => join(out, f))])
console.log(`Built ${files.length} files + craft-launch-kit.zip in public/launch/`)
