import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthCtx } from '../lib/context'
import {
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Database,
  ClipboardPaste,
  FileText,
  Info,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  FCR_TABS,
  EXPENDITURE,
  variancePct,
  CASH_RECON_ROWS,
  BANK_STATEMENT_BALANCE,
  fcrTotal,
  triangulate,
  OPEN_ADVANCES,
  advanceBucket,
  COMMITMENTS,
  SR_CASH,
  srClosing,
  TAX_ROWS,
  checkDataQuality,
  formatMoney,
  getFramework,
  type DataQualityResult,
} from '../lib/frameworks'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Stat,
  Table,
  Thead,
  Tbody,
  Th,
  Td,
} from '../components/ui'

type EntryMode = 'direct' | 'paste'

const FORECAST = [
  { quarter: 'Q+1', hr: 290_000, products: 540_000, sr: 320_000, other: 95_000 },
  { quarter: 'Q+2', hr: 295_000, products: 480_000, sr: 360_000, other: 88_000 },
  { quarter: 'Q+3', hr: 300_000, products: 610_000, sr: 340_000, other: 102_000 },
  { quarter: 'Q+4', hr: 305_000, products: 420_000, sr: 300_000, other: 90_000 },
]
const forecastRowTotal = (r: (typeof FORECAST)[number]) => r.hr + r.products + r.sr + r.other
const FORECAST_TOTAL = FORECAST.reduce((s, r) => s + forecastRowTotal(r), 0)

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>
  )
}

function PasteZone({ mode }: { mode: EntryMode }) {
  if (mode !== 'paste') return null
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-700">
        <ClipboardPaste className="h-4 w-4" />
        Data Import Wizard - paste rows from your spreadsheet to map them into this report.
      </div>
      <textarea
        rows={4}
        placeholder="Paste from spreadsheet (tab- or comma-separated)…"
        className="w-full rounded-b-lg border border-dashed border-emerald-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 placeholder-slate-400 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  )
}

function VarianceCell({ pct }: { pct: number }) {
  const over = pct > 0
  return (
    <span className={cn('font-mono font-semibold', over ? 'text-rose-600' : 'text-emerald-600')}>
      {over ? '+' : ''}
      {pct}%
    </span>
  )
}

export function GfFcrEngine() {
  const { isDemo } = useAuthCtx()
  const framework = getFramework('gf-pr-fcr')
  const authority = framework?.authority ?? 'The Global Fund · PR Reporting Handbook'

  const [active, setActive] = useState('expenditure')
  const [mode, setMode] = useState<EntryMode>('direct')
  const [dq, setDq] = useState<DataQualityResult | null>(null)

  const tri = triangulate(CASH_RECON_ROWS, BANK_STATEMENT_BALANCE)
  const cashClosing = fcrTotal(CASH_RECON_ROWS.find(r => r.item === '5.1')!)
  const disbursementNeed = FORECAST_TOTAL - cashClosing
  if (!isDemo) return <Card className="space-y-3 p-6">
    <h1 className="font-display text-2xl font-bold">Financial Compliance Report</h1>
    <p className="text-sm text-slate-600">The illustrative FCR tables are available in demo mode only. Record and persist actual figures in Financial Triangulation; the legacy sample report does not import pasted spreadsheets.</p>
    <Link to="/finance-triangulation" className="font-semibold text-emerald-700 underline">Open Financial Triangulation</Link>
  </Card>

  const renderTab = () => {
    switch (active) {
      case 'expenditure':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Cost Category</Th>
                  <Th className="text-right">Budget</Th>
                  <Th className="text-right">Actual</Th>
                  <Th className="text-right">Variance %</Th>
                </tr>
              </Thead>
              <Tbody>
                {EXPENDITURE.map(r => (
                  <tr key={r.category}>
                    <Td className="font-medium text-slate-800">{r.category}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.budget)}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.actual)}</Td>
                    <Td className="text-right">
                      <VarianceCell pct={variancePct(r.budget, r.actual)} />
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </>
        )

      case 'cash-recon':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Item No.</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Regular Funds</Th>
                  <Th className="text-right">C19RM Funds</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </Thead>
              <Tbody>
                {CASH_RECON_ROWS.map(r => (
                  <tr key={r.item}>
                    <Td className="font-mono text-slate-500">{r.item}</Td>
                    <Td className="font-medium text-slate-800">{r.label}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.regular)}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.c19rm)}</Td>
                    <Td className="text-right font-mono font-semibold">{formatMoney(fcrTotal(r))}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label="Expected Closing" value={formatMoney(tri.expectedClosing)} accent="slate" />
              <Stat label="Actual (Bank Statement)" value={formatMoney(tri.actualBalance)} accent="slate" />
              <Stat
                label="Variance"
                value={formatMoney(tri.variance)}
                accent={tri.balanced ? 'emerald' : 'rose'}
              />
            </div>
            {tri.balanced ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Reconciled - closing cash triangulates to the bank statement balance.
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  ⚠️ Triangulation Variance Detected. PR must provide justification in Item 13.10.
                </span>
              </div>
            )}
          </>
        )

      case 'open-advances':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Party</Th>
                  <Th>Reference</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Age (days)</Th>
                  <Th>Aging Bucket</Th>
                </tr>
              </Thead>
              <Tbody>
                {OPEN_ADVANCES.map(r => (
                  <tr key={r.reference}>
                    <Td className="font-medium text-slate-800">{r.party}</Td>
                    <Td className="font-mono text-slate-500">{r.reference}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.amount)}</Td>
                    <Td className="text-right font-mono">{r.ageDays}</Td>
                    <Td>
                      {r.ageDays > 90 ? (
                        <Badge className="border border-rose-300 bg-rose-100 text-rose-700">
                          {advanceBucket(r.ageDays)}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600">{advanceBucket(r.ageDays)}</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </>
        )

      case 'commitments':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Cost Category</Th>
                  <Th className="text-right">Legal Commitment</Th>
                  <Th className="text-right">Cash Spent</Th>
                  <Th className="text-right">Uncommitted</Th>
                </tr>
              </Thead>
              <Tbody>
                {COMMITMENTS.map(r => {
                  const uncommitted = r.legalCommitment - r.cashSpent
                  return (
                    <tr key={r.category}>
                      <Td className="font-medium text-slate-800">{r.category}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.legalCommitment)}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.cashSpent)}</Td>
                      <Td className="text-right font-mono font-semibold text-slate-800">
                        {formatMoney(uncommitted)}
                      </Td>
                    </tr>
                  )
                })}
              </Tbody>
            </Table>
          </>
        )

      case 'sr-cash':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Sub-Recipient</Th>
                  <Th className="text-right">Opening</Th>
                  <Th className="text-right">Received</Th>
                  <Th className="text-right">Spent</Th>
                  <Th className="text-right">Closing</Th>
                </tr>
              </Thead>
              <Tbody>
                {SR_CASH.map(r => {
                  const closing = srClosing(r)
                  return (
                    <tr key={r.sr}>
                      <Td className="font-medium text-slate-800">{r.sr}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.opening)}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.received)}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.spent)}</Td>
                      <Td
                        className={cn(
                          'text-right font-mono font-semibold',
                          closing < 0 ? 'text-rose-600' : 'text-slate-800',
                        )}
                      >
                        {formatMoney(closing)}
                      </Td>
                    </tr>
                  )
                })}
              </Tbody>
            </Table>
          </>
        )

      case 'triangulation':
        return (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Cross-verification of the three financial streams. The expected closing cash position is
              derived from the cash reconciliation and matched against the independent bank statement
              balance.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Stream 1 - Cash Reconciliation"
                value={formatMoney(cashClosing)}
                hint="Item 5.1 Total Cash Balance In-Country"
                accent="slate"
              />
              <Stat
                label="Stream 2 - Bank Statement"
                value={formatMoney(tri.actualBalance)}
                hint="Independent confirmation"
                accent="slate"
              />
              <Stat
                label="Stream 3 - Expected (Recomputed)"
                value={formatMoney(tri.expectedClosing)}
                hint="Opening + Income − Outflows + Adj."
                accent="slate"
              />
            </div>
            <div className="mt-4">
              {tri.balanced ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  All three streams reconcile. Variance {formatMoney(tri.variance)}.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    ⚠️ Triangulation Variance Detected ({formatMoney(tri.variance)}). PR must provide
                    justification in Item 13.10.
                  </span>
                </div>
              )}
            </div>
          </>
        )

      case 'tax':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Tax Type</Th>
                  <Th className="text-right">Gross Paid</Th>
                  <Th className="text-right">Recoverable</Th>
                  <Th className="text-right">Recovered</Th>
                  <Th className="text-right">Outstanding</Th>
                </tr>
              </Thead>
              <Tbody>
                {TAX_ROWS.map(r => {
                  const outstanding = r.recoverable - r.recovered
                  return (
                    <tr key={r.type}>
                      <Td className="font-medium text-slate-800">{r.type}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.grossPaid)}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.recoverable)}</Td>
                      <Td className="text-right font-mono">{formatMoney(r.recovered)}</Td>
                      <Td
                        className={cn(
                          'text-right font-mono font-semibold',
                          outstanding > 0 ? 'text-amber-600' : 'text-emerald-600',
                        )}
                      >
                        {formatMoney(outstanding)}
                      </Td>
                    </tr>
                  )
                })}
              </Tbody>
            </Table>
          </>
        )

      case 'forecast':
        return (
          <>
            <PasteZone mode={mode} />
            <Table>
              <Thead>
                <tr>
                  <Th>Quarter</Th>
                  <Th className="text-right">Human Resources</Th>
                  <Th className="text-right">Health Products</Th>
                  <Th className="text-right">SR Grants</Th>
                  <Th className="text-right">Other</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </Thead>
              <Tbody>
                {FORECAST.map(r => (
                  <tr key={r.quarter}>
                    <Td className="font-mono font-medium text-slate-800">{r.quarter}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.hr)}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.products)}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.sr)}</Td>
                    <Td className="text-right font-mono">{formatMoney(r.other)}</Td>
                    <Td className="text-right font-mono font-semibold">{formatMoney(forecastRowTotal(r))}</Td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800" colSpan={5}>
                    Total Forecast Requirement
                  </td>
                  <Td className="text-right font-mono font-bold text-slate-900">
                    {formatMoney(FORECAST_TOTAL)}
                  </Td>
                </tr>
              </Tbody>
            </Table>
          </>
        )

      case 'disbursement':
        return (
          <Card>
            <CardContent className="pt-6">
              <SectionLabel>Disbursement Request Summary</SectionLabel>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-slate-600">Total forecast cash requirement (Q+1 … Q+4)</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatMoney(FORECAST_TOTAL)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-slate-600">Less: current cash closing balance (Item 5.1)</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ({formatMoney(cashClosing)})
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-slate-900">Net Disbursement Request</span>
                  <span className="font-mono text-lg font-bold text-emerald-700">
                    {formatMoney(disbursementNeed)}
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <Button>
                  <Banknote className="h-4 w-4" />
                  Generate Disbursement Request
                </Button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Info className="h-3.5 w-3.5" />
                Derived from the Forecast Report less cash on hand, per the PR Reporting Handbook.
              </p>
            </CardContent>
          </Card>
        )

      case 'data-quality':
        return (
          <div className="space-y-4">
            <Button onClick={() => setDq(checkDataQuality())}>
              <Database className="h-4 w-4" />
              Check Data Quality
            </Button>
            {dq && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="font-mono font-semibold text-rose-600">{dq.errors}</span> errors and{' '}
                  <span className="font-mono font-semibold text-amber-600">{dq.warnings}</span> warnings
                  found. View details.
                </div>
                <ul className="space-y-2">
                  {dq.issues.map(issue => (
                    <li
                      key={issue.code}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
                        issue.level === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800',
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-mono text-xs font-semibold uppercase tracking-wide">
                          {issue.code}
                        </span>
                        <p className="mt-0.5">{issue.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const activeTab = FCR_TABS.find(t => t.id === active)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-emerald-600">
          <Banknote className="h-5 w-5" />
          <SectionLabel>Financial Compliance Reporting</SectionLabel>
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
          Global Fund PR - Financial Compliance Reporting
        </h1>
        <p className="mt-1 text-sm text-slate-500">{authority}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel>Data Entry Mode</SectionLabel>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setMode('direct')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'direct' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            Direct Entry
          </button>
          <button
            onClick={() => setMode('paste')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'paste' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            Copy/Paste (Data Import Wizard)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <nav className="lg:col-span-1">
          <Card>
            <CardContent className="space-y-1 pt-6">
              {FCR_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    active === t.id
                      ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </CardContent>
          </Card>
        </nav>

        <section className="lg:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h2 className="font-display text-xl font-bold text-slate-900">{activeTab?.label}</h2>
                {activeTab?.blurb && <p className="mt-0.5 text-sm text-slate-500">{activeTab.blurb}</p>}
              </div>
              {renderTab()}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
