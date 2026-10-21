// The founders' sign-off and reply-to shared by CRAFT's relationship emails (welcome now; lifecycle emails
// later). Pure: no I/O. The signature is an image because email clients don't load web fonts reliably; when
// images are blocked, its alt text shows the names, styled in the same script and colour where supported.

export const CRAFT_REPLY_TO_DEFAULT = 'craftframework@becomechange.institute'

/** Replies go to CRAFT's communications inbox unless CRAFT_REPLY_TO overrides it. */
export function craftReplyTo(env: Record<string, string | undefined> = process.env): string {
  return env.CRAFT_REPLY_TO?.trim() || CRAFT_REPLY_TO_DEFAULT
}

export const SIGNATURE_PATH = '/email/signature-abiola-pauline.png'
export const SIGNATURE_NAMES = 'Abiola & Pauline'
export const SIGNATURE_TEAM = 'CRAFT team, DiBadili Institute'
const SIGNATURE_WIDTH = 240
const SIGNATURE_HEIGHT = 57

/** `typedNames` adds the names as live text under the image, for emails that must show them even where images are blocked. */
export function signatureHtml(appUrl: string, opts: { typedNames?: boolean } = {}): string {
  const src = `${appUrl.replace(/\/+$/, '')}${SIGNATURE_PATH}`
  return `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#475569">Warm regards,</p>
        <img src="${src}" width="${SIGNATURE_WIDTH}" height="${SIGNATURE_HEIGHT}" alt="Abiola &amp; Pauline" style="display:block;border:0;margin:4px 0 2px;font-family:'Great Vibes','Brush Script MT',cursive;font-size:24px;color:#064e3b">
        ${opts.typedNames ? `<p style="margin:0;font-size:15px;line-height:1.5;color:#064e3b;font-weight:600">Abiola &amp; Pauline</p>\n        ` : ''}<p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:#64748b">${SIGNATURE_TEAM}</p>`
}

export function signatureText(): string[] {
  return ['Warm regards,', SIGNATURE_NAMES, SIGNATURE_TEAM]
}
