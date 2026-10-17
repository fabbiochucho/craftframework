// `?next=` on /auth may only send a person to a page on this site. Anything that could leave the site
// (a scheme, a protocol-relative `//host`, a backslash that browsers read as a slash, control characters)
// is refused, and the caller falls back to its normal destination.
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const url = new URL(raw, 'https://same-site.invalid')
    if (url.origin !== 'https://same-site.invalid') return null
  } catch {
    return null
  }
  return raw
}
