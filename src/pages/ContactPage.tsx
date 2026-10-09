import { useState } from 'react'
import { Mail, Linkedin, Facebook, Instagram, Send, CheckCircle2, Globe2, Building2 } from 'lucide-react'
import { Button, Input, Reveal } from '../components/ui'
import { BRAND } from '../lib/data'

const socials = [
  { name: 'LinkedIn', href: BRAND.socials.linkedin, Icon: Linkedin },
  { name: 'Facebook', href: BRAND.socials.facebook, Icon: Facebook },
  { name: 'Instagram', href: BRAND.socials.instagram, Icon: Instagram },
  { name: 'X (Twitter)', href: BRAND.socials.x, Icon: Globe2 },
]

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    try {
      // POST to the static skeleton path so Netlify's form handler processes it (not the SSR catch-all).
      const res = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData as any).toString(),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong sending your message. Please email us directly instead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 to-slate-900 py-20 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Contact Us</p>
          <h1 className="mt-3 font-display text-5xl font-bold">Let's build fiduciary trust together.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Whether you're exploring direct G2G, DFI and donor partnerships, an institutional assessment, or a
            collaboration with the {BRAND.institute}, the CRAFT team would be glad to hear from you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Contact details */}
          <Reveal className="lg:col-span-2">
            <h2 className="font-display text-2xl font-bold text-emerald-900">Reach the Institute</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The {BRAND.institute} is a Pan-African institution. The fastest way to reach the
              partnerships team is by email.
            </p>

            <div className="mt-6 space-y-4">
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-900 to-slate-900 text-amber-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p>
                  <p className="truncate font-medium text-slate-800">{BRAND.contactEmail}</p>
                </div>
              </a>

              <a
                href={BRAND.instituteUrl}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-900 to-slate-900 text-amber-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Institute</p>
                  <p className="font-medium text-slate-800">{BRAND.institute}</p>
                  <p className="text-sm text-slate-500">Pan-African · becomechange.institute</p>
                </div>
              </a>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-400">Follow along</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socials.map(({ name, href, Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
                >
                  <Icon className="h-4 w-4" /> {name}
                </a>
              ))}
            </div>
          </Reveal>

          {/* Contact form */}
          <Reveal delay={120} className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              {submitted ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <h3 className="mt-4 font-display text-2xl font-bold text-emerald-900">Message sent</h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-600">
                    Thank you for reaching out. The CRAFT team will respond to your message shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold text-emerald-900">Send us a message</h2>
                  <p className="mt-1 text-sm text-slate-500">We typically reply within a few business days.</p>

                  <form
                    name="contact"
                    method="POST"
                    data-netlify="true"
                    netlify-honeypot="bot-field"
                    onSubmit={handleSubmit}
                    className="mt-6 space-y-4"
                  >
                    <input type="hidden" name="form-name" value="contact" />
                    <p className="hidden">
                      <label>
                        Don't fill this out: <input name="bot-field" />
                      </label>
                    </p>

                    <Input label="Full Name" name="name" placeholder="Jane Doe" required />
                    <Input label="Organization" name="organization" placeholder="Your institution (optional)" />
                    <Input label="Email" name="email" type="email" placeholder="you@institution.org" required />

                    <div className="w-full">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                      <textarea
                        name="message"
                        required
                        rows={5}
                        placeholder="How can the CRAFT team help?"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {error && <p className="text-sm text-rose-600">{error}</p>}

                    <Button type="submit" size="lg" className="w-full justify-center" disabled={submitting}>
                      {submitting ? 'Sending…' : (<><Send className="h-4 w-4" /> Send Message</>)}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
