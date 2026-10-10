import React from 'react'
import { cn } from '../lib/utils'

// Badge
interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'outline'
}
export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      variant === 'outline' ? 'border border-current bg-transparent' : '',
      className
    )}>
      {children}
    </span>
  )
}

// Card
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  )
}
export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-6 pb-3', className)}>{children}</div>
}
export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-base font-semibold text-slate-800 leading-tight', className)}>{children}</h3>
}
export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
export function Button({ variant = 'primary', size = 'md', children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 focus:ring-emerald-500',
        variant === 'outline' && 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
        variant === 'ghost' && 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
        variant === 'destructive' && 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
export function Input({ label, error, className, ...props }: InputProps) {
  const autoId = React.useId()
  const id = props.id ?? autoId
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <input
        id={id}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
          error && 'border-rose-400',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

// Select
interface SelectOption { value: string; label: string }
interface SelectProps {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}
export function Select({ label, options, value, onChange, placeholder, className }: SelectProps) {
  const id = React.useId()
  return (
    <div className={cn('w-full', className)}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// Progress bar
export function ProgressBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className={cn('w-full bg-slate-100 rounded-full h-2 overflow-hidden', className)}>
      <div
        className={cn('h-2 rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// Accordion
export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span>{title}</span>
        <svg className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-slate-600 bg-white border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  )
}

// Table
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-slate-200', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>
}
export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}
export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide', className)}>{children}</th>
}
export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-slate-700', className)}>{children}</td>
}

// ============================================================================
// CRAFT additions
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { STATUS_STYLES, RiskStatus } from '../lib/data'

// Status badge using the strict CRAFT legend
export function StatusBadge({ status, className }: { status: RiskStatus; className?: string }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        s.bg, s.text, s.border, className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

// Scroll-reveal wrapper (IntersectionObserver-driven entrance animation)
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisible(true)
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Toast (success notification)
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
        {message}
      </div>
    </div>
  )
}

// Tabs (simple controlled)
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            active === t.id
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Horizontal stepper
export function Stepper({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done && 'bg-emerald-500 text-white',
                  active && 'bg-emerald-600 text-white ring-4 ring-emerald-100',
                  !done && !active && 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  active ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-3 h-0.5 flex-1 rounded', done ? 'bg-emerald-400' : 'bg-slate-200')} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Toggle switch (accessible). Locked switches render fixed-on and non-interactive.
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

// KPI stat tile
export function Stat({  label,
  value,
  hint,
  accent = 'emerald',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  accent?: 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const accents: Record<string, string> = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    slate: 'text-slate-700',
  }
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold', accents[accent])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  )
}
