import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  signup,
  login,
  oauthLogin,
  getSettings,
  AuthError,
  MissingIdentityError,
} from '@netlify/identity'
import { Lock, Shield, ArrowRight, MailCheck, Loader2, Eye, EyeOff, Github } from 'lucide-react'
import { Button, Input } from '../components/ui'
import { Footer } from '../components/Footer'
import { Logo } from '../components/Logo'
import { useApp } from '../lib/context'
import { BRAND, VIEW_LEVELS, type ViewLevel } from '../lib/data'

type Status = 'idle' | 'submitting'

// Categories a visitor may self-register as. Neither administrative tier is
// self-serve: the ordinary Administrator role is granted from the admin portal,
// and the platform Super Admin is reserved for an allowlisted operator email.
const REGISTRABLE_ROLES = VIEW_LEVELS.filter(v => v.id !== 'admin' && v.id !== 'super_admin')

// Maps a GoTrue OAuth error (returned in the redirect URL hash) to a message
// that tells the user what to do next. The most common GitHub failure is that
// no email could be read from the provider - almost always a private/unverified
// GitHub email or a provider that wasn't granted the email scope.
function describeOAuthError(description: string): string {
  if (/email/i.test(description) && /provider/i.test(description)) {
    return 'GitHub did not share an email address, so sign-in could not complete. Make sure your GitHub account has a verified email and that email is not set to private, then try again. If it keeps failing, sign in with your email and password instead.'
  }
  if (/access.?denied|denied/i.test(description)) {
    return 'The sign-in request was cancelled or access was denied. Please try again.'
  }
  return description
    ? `Sign-in with the external provider failed: ${description.replace(/\+/g, ' ')}`
    : 'Sign-in with the external provider failed. Please try again or use your email and password.'
}

export function AuthPage() {
  const navigate = useNavigate()
  // The app session, hydrated by IdentityBridge from the Identity auth events.
  // Navigation into the vault is driven off THIS (see the effect below) rather
  // than fired the instant login() resolves — otherwise the redirect can race
  // ahead of session hydration and the route guard bounces straight back here.
  const { currentUser } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('admin@workspace.org')
  const [password, setPassword] = useState('')
  // Lets the visitor reveal the password they are typing by clicking the eye
  // icon (or the field's reveal control), toggling the input between masked and
  // plain text so they can confirm what they entered before signing in.
  const [showPassword, setShowPassword] = useState(false)
  const [orgName, setOrgName] = useState('')
  // The category the visitor is registering as. Super Admin is deliberately not
  // offered here (see REGISTRABLE_ROLES); everyone else self-selects their role.
  const [role, setRole] = useState<ViewLevel>('assessor')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  // After a successful registration we hold here until the user confirms by email.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  // Which external OAuth providers are actually enabled on this site's Identity
  // config. `null` = not yet loaded (or settings unreadable). A provider button
  // is only rendered once we KNOW it is enabled — showing a button for a
  // provider that isn't configured is exactly what makes "GitHub sign-in" dead:
  // the click redirects to /.netlify/identity/authorize?provider=github, which
  // bounces straight back with an error. See getSettings() below.
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null)

  // A failed OAuth sign-in comes back as a URL hash the token flow can't use
  // (e.g. #error=server_error&error_description=Error+getting+user+email...),
  // so IdentityBridge.handleAuthCallback() ignores it. Surface it here instead
  // of leaving the user on a blank-looking login form with no explanation.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const params = new URLSearchParams(hash)
    const oauthError = params.get('error')
    if (!oauthError) return
    const description = params.get('error_description') || ''
    setError(describeOAuthError(description))
    // Clear the hash so a refresh doesn't re-show the error.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  // Ask Identity which external providers are switched on for this site and only
  // offer those. This is the fix for "I can't sign in with GitHub": a provider
  // that isn't enabled in Identity → External providers has no working authorize
  // endpoint, so its button could only ever fail. We hide any provider that is
  // off rather than presenting a button that leads nowhere.
  useEffect(() => {
    let active = true
    getSettings()
      .then(settings => {
        if (!active) return
        setProviders({
          google: Boolean(settings.providers?.google),
          github: Boolean(settings.providers?.github),
        })
      })
      .catch(() => {
        // Settings couldn't be read (e.g. Identity not available locally). Leave
        // `providers` as null so the buttons stay hidden rather than dangling.
        if (active) setProviders({ google: false, github: false })
      })
    return () => {
      active = false
    }
  }, [])

  // Once a real session exists (login, or an autoconfirmed registration), move
  // into the secure vault. Waiting for currentUser guarantees the session is
  // hydrated before we leave /auth, so the destination never bounces back.
  useEffect(() => {
    if (currentUser && !currentUser.isDemo) {
      navigate({ to: '/dashboard' })
    }
  }, [currentUser, navigate])

  function switchMode(m: 'login' | 'register') {
    setMode(m)
    setError(null)
    setPendingEmail(null)
  }

  function describeError(err: unknown): string {
    if (err instanceof MissingIdentityError) {
      return 'Authentication is not available in this environment yet. It activates on the deployed site.'
    }
    // Read status and message defensively: depending on the failure, GoTrue's
    // raw "invalid_grant: No user found..." can arrive without an AuthError
    // wrapper, so we also match on the message text, not just err.status.
    const status = err instanceof AuthError ? err.status : undefined
    const message = err instanceof Error ? err.message : ''
    if (status === 403) {
      return 'Sign-ups are currently disabled for this site.'
    }
    if (status === 422) {
      return 'Please enter a valid email and a password of at least 6 characters.'
    }
    // GoTrue returns this for an unconfirmed account: they registered but have
    // not clicked the confirmation link yet, so sign-in cannot complete.
    if (/confirm/i.test(message)) {
      return 'Please confirm your email first. Check your inbox for the confirmation link.'
    }
    // Bad credentials OR no such account. GoTrue phrases this as invalid_grant /
    // "No user found with that email, or password invalid". Tell the visitor the
    // two things that actually resolve it: register first, or fix their details.
    if (
      status === 400 ||
      status === 401 ||
      /invalid_grant|no user found|password invalid|invalid password/i.test(message)
    ) {
      return 'We could not sign you in. Check that your email and password are correct. If you have not registered yet, use the Register tab to create your account first; if you just signed up, confirm your email before signing in.'
    }
    return message || 'Something went wrong. Please try again.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Email and password are required.')
      return
    }

    setStatus('submitting')
    try {
      if (mode === 'register') {
        const user = await signup(trimmedEmail, password, {
          full_name: orgName.trim() || 'New Institution',
          // Carry the self-selected category into Identity metadata. IdentityBridge
          // reads it when a brand-new registrant first signs in and provisions
          // their session at this view level (never Super Admin).
          requested_role: role,
        })
        if (user.confirmedAt) {
          // Autoconfirm is on - the user is already signed in. IdentityBridge
          // hydrates the session and the effect above navigates to the vault.
        } else {
          // Confirmation required: do NOT sign in until the email link is clicked.
          setPendingEmail(trimmedEmail)
        }
      } else {
        await login(trimmedEmail, password)
        // IdentityBridge hydrates the app session from the login event; the
        // effect above navigates once currentUser is populated.
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setStatus('idle')
    }
  }

  const submitting = status === 'submitting'

  // Social sign-in. oauthLogin() redirects the browser to the provider and
  // never returns; IdentityBridge.handleAuthCallback() completes the login when
  // the provider redirects back. (Netlify Identity supports Google and GitHub -
  // there is no Microsoft/Azure AD provider, so Google is offered for users and
  // GitHub for repository-linked admins.)
  function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    try {
      oauthLogin(provider)
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-900 to-slate-900">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl lg:grid-cols-2">
          {/* Brand panel */}
          <div className="relative hidden flex-col justify-between bg-gradient-to-br from-emerald-900 to-slate-900 p-10 text-white lg:flex">
            <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />
            <Link to="/" className="relative flex items-center gap-2.5">
              <Logo className="h-10 w-10" />
              <div>
                <p className="font-display text-lg font-bold">{BRAND.product}</p>
                <p className="-mt-0.5 text-[10px] text-slate-400">{BRAND.framework}</p>
              </div>
            </Link>
            <div className="relative">
              <h2 className="font-display text-4xl font-bold leading-tight">CRAFT</h2>
              <p className="mt-1 font-display text-base font-semibold text-slate-200">
                Capacity Readiness &amp; Fiduciary Assurance Toolkit
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{BRAND.tagline}</p>
            </div>
            <div className="relative flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 font-medium text-emerald-800">
                <Lock className="h-3.5 w-3.5 text-emerald-600" /> 🔒 End-to-End Encrypted
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 font-medium text-emerald-800">
                <Shield className="h-3.5 w-3.5 text-emerald-600" /> 🛡️ Multi-Tenant Data Isolation
              </span>
            </div>
          </div>

          {/* Form panel */}
          <div className="bg-white p-8 sm:p-10">
            {pendingEmail ? (
              <ConfirmEmailNotice email={pendingEmail} onBack={() => switchMode('login')} />
            ) : (
              <>
                <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1">
                  {(['login', 'register'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-all ${
                        mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {m === 'login' ? 'Sign In' : 'Register'}
                    </button>
                  ))}
                </div>

                <h1 className="font-display text-2xl font-bold text-emerald-900">
                  {mode === 'login' ? 'Welcome back' : 'Register your institution'}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'login'
                    ? 'Access your secure organization vault.'
                    : 'Create a workspace and confirm your email to begin.'}
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {mode === 'register' && (
                    <Input
                      label="Institution Name"
                      placeholder="e.g. National Public Health Agency"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                    />
                  )}
                  {mode === 'register' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        I am registering as
                      </label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {REGISTRABLE_ROLES.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRole(r.id)}
                            aria-pressed={role === r.id}
                            className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all ${
                              role === r.id
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {r.short}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        {REGISTRABLE_ROLES.find(r => r.id === role)?.description}
                      </p>
                    </div>
                  )}
                  <Input
                    label="Work Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                  <div className="w-full">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-11 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        title={showPassword ? 'Hide password' : 'Reveal password'}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-emerald-600 focus:text-emerald-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full justify-center" size="lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === 'login' ? 'Signing in…' : 'Creating workspace…'}
                      </>
                    ) : (
                      <>
                        {mode === 'login' ? 'Enter Secure Vault' : 'Create Workspace'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {(providers?.google || providers?.github) && (
                  <>
                    <div className="mt-6 flex items-center gap-3">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or continue with</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className={`mt-4 grid gap-3 ${providers.google && providers.github ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {providers.google && (
                        <button
                          type="button"
                          onClick={() => handleOAuth('google')}
                          disabled={submitting}
                          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <GoogleIcon className="h-4 w-4" /> Google
                        </button>
                      )}
                      {providers.github && (
                        <button
                          type="button"
                          onClick={() => handleOAuth('github')}
                          disabled={submitting}
                          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Github className="h-4 w-4" /> GitHub
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> 🔒 Encrypted</span>
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> 🛡️ Isolated</span>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <p className="text-center text-xs text-slate-500">
                    Just looking around? Explore the live demos. No sign-up required.
                  </p>
                  <Link to="/demo" className="mt-3 block">
                    <Button type="button" variant="outline" className="w-full justify-center">
                      <Eye className="h-4 w-4" /> View Live Demo
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// Google's multicolor "G" mark - lucide ships no brand glyph, so it's inlined.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75Z" />
    </svg>
  )
}

function ConfirmEmailNotice({ email, onBack }: { email: string; onBack: () => void }) {  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <MailCheck className="h-7 w-7 text-emerald-600" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-emerald-900">Confirm your email</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        A confirmation link was sent to{' '}
        <span className="font-semibold text-slate-700">{email}</span>. Click the link in that email
        to activate your account. You can sign in once it&apos;s confirmed.
      </p>
      <div className="mt-6 w-full max-w-xs rounded-lg bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">
        <p className="font-semibold">Didn&apos;t get it?</p>
        <p className="mt-1">Check your spam folder, or register again to resend the confirmation link.</p>
      </div>
      <Button type="button" variant="outline" className="mt-6 justify-center" onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  )
}
