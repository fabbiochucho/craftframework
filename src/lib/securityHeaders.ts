// Reads the `for = "/*"` header block of netlify.toml, the single source of truth for security headers.
export function securityHeaders(toml: string): [string, string][] {
  const block = /for = "\/\*"\s*\[headers\.values\]([\s\S]*?)(?:\n\s*\n|\[\[)/.exec(toml)?.[1]
  if (!block) throw new Error('netlify.toml: no [[headers]] block for "/*"')
  return [...block.matchAll(/^\s*([\w-]+) = "([^"]*)"\s*$/gm)].map(m => [m[1], m[2]])
}
