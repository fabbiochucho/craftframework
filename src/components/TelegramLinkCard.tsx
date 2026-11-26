import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui'

// Settings → link Telegram: a one-time code opens the CRAFT bot, which links the chat to this account (src/lib/telegramBot.ts).
export function TelegramLinkCard() {
  const [state, setState] = useState<{ configured: boolean; linked: number } | null>(null)
  const [link, setLink] = useState<{ url: string; code: string; expiresAt: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(() => {
    fetch('/api/telegram/link').then((r) => (r.ok ? r.json() : null)).then(setState).catch(() => {})
  }, [])
  useEffect(load, [load])
  if (!state?.configured) return null
  const start = async () => {
    const r = await fetch('/api/telegram/link', { method: 'POST' })
    const body = await r.json().catch(() => ({}))
    if (r.ok) setLink(body); else setMessage(body.error ?? 'Could not create a link code.')
  }
  const unlink = async () => {
    await fetch('/api/telegram/link', { method: 'DELETE' })
    setMessage('Unlinked. CRAFT will not send anything more to Telegram.'); setLink(null); load()
  }
  return (
    <Card>
      <CardHeader><CardTitle>Telegram</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        <p>Get CRAFT notices on your phone, ask questions and run the quick screen in Telegram. It works on slow connections.</p>
        {state.linked > 0
          ? <><p>Linked to {state.linked} chat{state.linked > 1 ? 's' : ''}.</p><Button size="sm" variant="outline" onClick={() => void unlink()}>Unlink Telegram</Button></>
          : link
            ? <p>Open <a className="font-semibold text-emerald-700 underline" href={link.url} target="_blank" rel="noreferrer">the CRAFT bot</a> and press Start, or send it <code className="font-mono">/start {link.code}</code>. The code works once, until {new Date(link.expiresAt).toLocaleTimeString()}.</p>
            : <Button size="sm" onClick={() => void start()}>Link Telegram</Button>}
        {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  )
}
