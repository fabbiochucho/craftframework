import { cn } from '../lib/utils'

// Single source of truth for the CRAFT Prism shield mark. Renders the master
// SVG from /public so the favicon, app icons and in-app logo never drift.
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="CRAFT"
      width={36}
      height={36}
      className={cn('h-9 w-9 shrink-0 select-none', className)}
      draggable={false}
    />
  )
}
