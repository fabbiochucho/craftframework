// The 'CRAFT member since {year}' badge, generated from data as a self-contained SVG (no external fonts or
// images, so it renders the same on a website, in LinkedIn and when downloaded). PNG is produced from this SVG in
// the browser (canvas) on the /badge page: there is no server-side image tool in the dependency set.
import { BRAND } from './data.ts'

export const BADGE_WIDTH = 720
export const BADGE_HEIGHT = 240

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Splits a name over at most two lines of about `max` characters, ending in an ellipsis if it still does not fit. */
export function wrapName(name: string, max = 26): string[] {
  const words = name.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  const lines: string[] = ['']
  for (const w of words) {
    const line = lines[lines.length - 1]
    if (!line) lines[lines.length - 1] = w
    else if ((line + ' ' + w).length <= max) lines[lines.length - 1] = `${line} ${w}`
    else if (lines.length < 2) lines.push(w)
    else { lines[1] = `${lines[1]} ${w}`; break }
  }
  const out = lines.map((l) => (l.length > max + 6 ? `${l.slice(0, max + 3)}…` : l))
  if (lines[1] && lines[1].length > max) out[1] = `${lines[1].slice(0, max - 1).trimEnd()}…`
  return out.filter(Boolean)
}

export function renderBadgeSvg(input: { orgName: string; year: number }): string {
  const lines = wrapName(input.orgName || 'Your organisation')
  const title = `CRAFT member since ${input.year}: ${lines.join(' ')}`
  const nameSize = lines.length > 1 ? 28 : 34
  const startY = lines.length > 1 ? 150 : 162
  const name = lines.map((l, i) => `<text x="230" y="${startY + i * 34}" font-size="${nameSize}" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${esc(title)}" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif">
  <title>${esc(title)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#064e3b"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#065f46"/><stop offset="1" stop-color="#022c22"/></linearGradient>
    <linearGradient id="delta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="0.5" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient>
  </defs>
  <rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="24" fill="url(#bg)"/>
  <rect x="3" y="3" width="${BADGE_WIDTH - 6}" height="${BADGE_HEIGHT - 6}" rx="21" fill="none" stroke="#fbbf24" stroke-opacity="0.55" stroke-width="2"/>
  <g transform="translate(34 36) scale(0.33)">
    <path d="M134 116 H378 Q402 116 402 140 V296 Q402 398 256 466 Q110 398 110 296 V140 Q110 116 134 116 Z" fill="url(#shield)" stroke="#10b981" stroke-opacity="0.5" stroke-width="10"/>
    <path fill-rule="evenodd" fill="url(#delta)" d="M256 152 L364 360 H148 Z M256 240 L308 332 H204 Z"/>
  </g>
  <text x="230" y="64" font-size="15" font-weight="700" letter-spacing="3" fill="#fbbf24">${esc(BRAND.product)} MEMBER</text>
  <text x="230" y="104" font-size="30" font-weight="800" fill="#ffffff">Member since ${input.year}</text>
  <line x1="230" y1="${lines.length > 1 ? 118 : 126}" x2="${BADGE_WIDTH - 40}" y2="${lines.length > 1 ? 118 : 126}" stroke="#34d399" stroke-opacity="0.5" stroke-width="2"/>
  ${name}
  <text x="230" y="${BADGE_HEIGHT - 22}" font-size="12" fill="#a7f3d0">${esc(BRAND.expansion)} · ${esc(BRAND.institute)}</text>
</svg>
`
}

export const badgeFileName = (orgName: string, year: number): string =>
  `craft-member-since-${year}-${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'organisation'}`
