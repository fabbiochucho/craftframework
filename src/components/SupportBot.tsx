import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  issueUrl?: string
}

function safeLink(target: string): boolean {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' || url.protocol === 'http:' ||
      (url.protocol === 'mailto:' && url.pathname === 'craftframework@becomechange.institute')
  } catch {
    return false
  }
}

function safeIssueLink(target: string): boolean {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' && url.hostname === 'github.com' &&
      url.pathname.startsWith('/fabbiochucho/craftframework/issues/')
  } catch {
    return false
  }
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link && safeLink(link[2])) {
      return <a key={key} href={link[2]} className="text-blue-700 underline" target="_blank" rel="noreferrer">{link[1]}</a>
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="rounded bg-gray-100 px-1">{part.slice(1, -1)}</code>
    return part
  })
}

function SafeMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let inCode = false
  let codeLines: string[] = []
  const flushList = () => {
    if (list.length) {
      blocks.push(<ul key={`list-${blocks.length}`} className="my-2 list-disc pl-5">{list.map((item, i) => <li key={i}>{renderInlineMarkdown(item, `li-${blocks.length}-${i}`)}</li>)}</ul>)
      list = []
    }
  }

  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) {
      flushList()
      if (inCode) {
        blocks.push(<pre key={`code-${index}`} className="my-2 overflow-x-auto rounded bg-gray-100 p-2 text-xs"><code>{codeLines.join('\n')}</code></pre>)
        codeLines = []
        inCode = false
      } else inCode = true
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    const item = line.match(/^\s*[-*]\s+(.+)/)
    if (item) {
      list.push(item[1])
      continue
    }
    flushList()
    if (!line.trim()) continue
    const heading = line.match(/^(#{1,3})\s+(.+)/)
    if (heading) {
      const Heading = heading[1].length === 1 ? 'h3' : 'h4'
      blocks.push(<Heading key={`heading-${index}`} className="my-2 font-semibold">{renderInlineMarkdown(heading[2], `heading-${index}`)}</Heading>)
    } else {
      blocks.push(<p key={`p-${index}`} className="my-1">{renderInlineMarkdown(line, `p-${index}`)}</p>)
    }
  }
  flushList()
  if (inCode) blocks.push(<pre key="code-unclosed" className="my-2 overflow-x-auto rounded bg-gray-100 p-2 text-xs"><code>{codeLines.join('\n')}</code></pre>)
  return <div className="text-sm">{blocks}</div>
}

export function SupportBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'bot',
    content: 'Hi! I can help with setup, features, or support questions. Non-private support submissions create a public GitHub issue; please do not share personal, organization, assessment, evidence, security, or conduct details here.',
  }])
  const [input, setInput] = useState('')
  const [disclosureAccepted, setDisclosureAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || !disclosureAccepted || isLoading) return

    setMessages((previous) => [...previous, { id: `${Date.now()}-user`, type: 'user', content: message }])
    setInput('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/support-bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, publicIssueDisclosure: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to submit your message')
      const content = [data.answer, data.message].filter(Boolean).join('\n\n')
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-bot`,
        type: 'bot',
        content: content || 'Thanks for your message.',
        issueUrl: data.issueUrl,
      }])
    } catch {
      setMessages((previous) => [...previous, {
        id: `${Date.now()}-error`,
        type: 'bot',
        content: 'Sorry, I could not submit that message. Please try again or contact craftframework@becomechange.institute.',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
        aria-expanded={isOpen}
        aria-controls="support-chat-dialog"
      >
        {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>

      {isOpen && (
        <section
          id="support-chat-dialog"
          role="dialog"
          aria-labelledby="support-chat-title"
          aria-modal="false"
          className="fixed bottom-24 right-4 z-50 flex h-[min(600px,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl sm:right-6"
        >
          <header className="bg-blue-600 p-4 text-white">
            <h2 id="support-chat-title" className="font-semibold">craftframework Support</h2>
            <p className="text-sm opacity-90">Ask a question or report an issue</p>
          </header>

          <div
            className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4"
            role="log"
            aria-label="Support chat messages"
            aria-live="polite"
            aria-relevant="additions text"
            tabIndex={0}
          >
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 ${message.type === 'user' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>
                  <SafeMarkdown content={message.content} />
                  {message.issueUrl && safeIssueLink(message.issueUrl) && (
                    <a href={message.issueUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-medium text-blue-700 underline">
                      View public GitHub issue
                    </a>
                  )}
                </div>
              </div>
            ))}
            {isLoading && <p role="status" className="text-sm text-gray-600">Sending…</p>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-200 bg-white p-4">
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={disclosureAccepted}
                onChange={(event) => setDisclosureAccepted(event.target.checked)}
                className="mt-0.5"
              />
              <span>I understand non-private support messages create a public GitHub issue. Conduct and security reports are not submitted publicly.</span>
            </label>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="support-chat-input">Your support message</label>
              <input
                id="support-chat-input"
                ref={inputRef}
                type="text"
                maxLength={5000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a question or describe an issue…"
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={isLoading || !input.trim() || !disclosureAccepted}
                className="rounded bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Conduct or security reports: <a href="mailto:craftframework@becomechange.institute" className="text-blue-700 underline">contact us privately</a>.
            </p>
          </form>
        </section>
      )}
    </>
  )
}
