import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureRenderError } from '../lib/monitoring'

/** What visitors see when a page crashes. Plain markup and inline-safe classes: it must not depend on anything that may have failed. */
export function CrashFallback() {
  return (
    <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="max-w-md rounded-xl border border-emerald-900/10 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-bold text-emerald-950">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600">Something went wrong — the CRAFT team has been notified.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Reload the page
        </button>
      </div>
    </div>
  )
}

/** Catches render errors anywhere below it, reports them (scrubbed, see lib/errorScrub.ts) and shows a friendly fallback. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    void captureRenderError(error)
  }

  render() {
    return this.state.failed ? <CrashFallback /> : this.props.children
  }
}
