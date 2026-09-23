// Structured JSON logging for Netlify Functions. Netlify's own log viewer (and
// any downstream log shipper) can parse/filter/search JSON lines far better
// than free-text console output — a bare `console.error('/api/x failed', err)`
// loses the error's shape the moment it's stringified.
type Level = 'info' | 'warn' | 'error'

function emit(level: Level, scope: string, message: string, extra?: Record<string, unknown>) {
  const line = {
    level,
    scope,
    message,
    time: new Date().toISOString(),
    ...(extra ?? {}),
  }
  const out = JSON.stringify(line, (_key, value) => (value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value))
  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else console.log(out)
}

export const logger = {
  info: (scope: string, message: string, extra?: Record<string, unknown>) => emit('info', scope, message, extra),
  warn: (scope: string, message: string, extra?: Record<string, unknown>) => emit('warn', scope, message, extra),
  error: (scope: string, message: string, err?: unknown, extra?: Record<string, unknown>) =>
    emit('error', scope, message, { ...(extra ?? {}), error: err }),
}
