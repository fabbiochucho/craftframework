import { Link } from '@tanstack/react-router'
import { Compass } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <Compass className="mb-6 h-12 w-12 text-emerald-600" />
      <h1 className="font-display text-3xl font-bold text-emerald-900 sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 sm:text-base">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Back to home
      </Link>
    </div>
  )
}
