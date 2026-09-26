'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  buildMonthGrid,
  undatedForMonth,
  monthLabel,
  type CalendarDay,
  type CalendarEvent,
  type Confidence,
  type MonthSummary,
} from '@/lib/calendar'

interface CalendarPayload {
  events: CalendarEvent[]
  months: MonthSummary[]
  stats: {
    rawRows: number
    events: number
    collapsed: number
    byConfidence: Record<Confidence, number>
    undated: number
    sourcesOnline: number
    sourcesTotal: number
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'border-black/70 bg-black/70 text-white',
  medium: 'border-black/40 bg-black/10 text-black/60',
  low: 'border-black/25 bg-transparent text-black/40',
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function SportTag({ sport }: { sport: string }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.1em] text-black/50">{sport}</span>
  )
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span
      title={`${level} confidence`}
      className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none ${CONFIDENCE_STYLE[level]}`}
    >
      {level[0].toUpperCase()}
    </span>
  )
}

export default function CalendarView() {
  const [data, setData] = useState<CalendarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  // Which day cell is open, as a 'YYYY-MM-DD' key. Stored as the key rather than
  // the cell so it stays correct when the grid is rebuilt for another month.
  const [openDayKey, setOpenDayKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then((payload: CalendarPayload) => {
        setData(payload)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load the calendar')
        setLoading(false)
      })
  }, [])

  // Open on the first month that actually has events, not the empty current
  // month. Derived rather than stored, so no effect has to set it after fetch.
  const active = useMemo(() => {
    if (cursor) return cursor
    const first = data?.months[0]?.key
    if (first) {
      const [y, m] = first.split('-').map(Number)
      return { year: y, month: m }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }, [cursor, data])

  const grid = useMemo(
    () => (data ? buildMonthGrid(data.events, active.year, active.month) : []),
    [data, active]
  )
  const undated = useMemo(
    () => (data ? undatedForMonth(data.events, monthKey(active.year, active.month)) : []),
    [data, active]
  )
  const inMonth = useMemo(() => grid.filter(c => c.inMonth), [grid])
  const monthCount = useMemo(() => inMonth.reduce((n, c) => n + c.events.length, 0), [inMonth])
  // Derived, so paging to a month that does not contain the open day closes it
  // instead of leaving a panel for a date that is no longer on screen.
  const openDay: CalendarDay | null = useMemo(
    () => (openDayKey ? grid.find(c => c.date === openDayKey) ?? null : null),
    [grid, openDayKey]
  )
  const key = monthKey(active.year, active.month)

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <nav className="flex items-center gap-3">
            <a href="https://boxingpugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] uppercase tracking-[0.05em] text-[#1d1d1f] underline decoration-2 underline-offset-8">Boxing</a>
            <a href="https://mmapugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] uppercase tracking-[0.05em] text-black/40 transition-colors hover:text-[#1d1d1f]">MMA</a>
            <a href="https://generalspugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] uppercase tracking-[0.05em] text-black/40 transition-colors hover:text-[#1d1d1f]">Generals</a>
            <Link href="/calendar" className="text-[17px] uppercase tracking-[0.05em] text-[#1d1d1f] underline decoration-2 underline-offset-8">Calendar</Link>
          </nav>
          <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-[30px] font-bold uppercase tracking-[0.08em] text-[#1d1d1f] sm:block">
            Winston&apos;s Rankings
          </div>
          <Link href="/" className="rounded-sm border border-black/80 px-3.5 py-2 text-[17px] uppercase tracking-[0.05em] transition-colors hover:bg-black hover:text-white">
            Rankings
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold uppercase leading-none tracking-[0.04em]">Fight Calendar</h1>
            <p className="mt-2 text-[13px] text-black/50">
              Scheduled bouts across boxing and every MMA sport.
              {data && (
                <>
                  {' '}
                  <span className="text-black/70">
                    {data.stats.events} events from {data.stats.rawRows} reports
                  </span>
                  {data.stats.collapsed > 0 && ` (${data.stats.collapsed} duplicate reports merged)`}.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(shiftMonth(active.year, active.month, -1))}
              aria-label="Previous month"
              className="flex h-10 w-10 items-center justify-center rounded-sm border border-black/80 transition-colors hover:bg-black hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="min-w-[190px] text-center text-[20px] font-bold uppercase tracking-[0.06em]">
              {data ? monthLabel(key) : '—'}
            </div>
            <button
              onClick={() => setCursor(shiftMonth(active.year, active.month, 1))}
              aria-label="Next month"
              className="flex h-10 w-10 items-center justify-center rounded-sm border border-black/80 transition-colors hover:bg-black hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button
              onClick={() => {
                const now = new Date()
                setCursor({ year: now.getFullYear(), month: now.getMonth() + 1 })
                setSelected(null)
              }}
              className="rounded-sm border border-black/40 px-3 py-2 text-[13px] uppercase tracking-[0.08em] text-black/60 transition-colors hover:border-black hover:text-black"
            >
              Today
            </button>
          </div>
        </div>

        {data && data.months.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {data.months.map(m => {
              const [y, mo] = m.key.split('-').map(Number)
              const active = m.key === key
              return (
                <button
                  key={m.key}
                  onClick={() => { setCursor({ year: y, month: mo }); setSelected(null) }}
                  className={`rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] transition-colors ${
                    active ? 'border-black bg-black text-white' : 'border-black/20 text-black/55 hover:border-black hover:text-black'
                  }`}
                >
                  {m.label} <span className="opacity-60">{m.count}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading && <p className="mt-10 text-[13px] uppercase tracking-[0.1em] text-black/40">Loading calendar…</p>}
        {error && <p className="mt-10 text-[13px] text-red-700">{error}</p>}

        {!loading && !error && data && (
          <>
            <div className="mt-5 border border-black/15">
              <div className="grid grid-cols-7 border-b border-black/15 bg-black/[0.03]">
                {WEEKDAYS.map(d => (
                  <div key={d} className="px-2 py-2 text-center text-[11px] uppercase tracking-[0.12em] text-black/45">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map(cell => (
                  <div
                    key={cell.date}
                    role="button"
                    tabIndex={0}
                    aria-expanded={openDayKey === cell.date}
                    aria-label={`${dayLabel(cell.date)}, ${cell.events.length} event${cell.events.length === 1 ? '' : 's'}`}
                    onClick={() => setOpenDayKey(cell.date)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      setOpenDayKey(cell.date)
                    }}
                    className={`min-h-[104px] cursor-pointer border-b border-r border-black/10 p-1.5 transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/50 ${
                      cell.inMonth ? 'bg-white' : 'bg-black/[0.02]'
                    } ${openDayKey === cell.date ? 'bg-black/[0.05] ring-1 ring-inset ring-black/40' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[12px] tabular-nums ${
                          cell.isToday
                            ? 'flex h-[21px] w-[21px] items-center justify-center rounded-full bg-black font-semibold text-white'
                            : cell.inMonth
                              ? 'text-black/70'
                              : 'text-black/25'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {cell.events.length > 0 && (
                        <span className="text-[10px] tabular-nums text-black/30">{cell.events.length}</span>
                      )}
                    </div>
                    {/* Every event is listed, not a capped preview: a truncated
                        day used to hide fights behind a dead "+N more" label. */}
                    <div className="mt-1 space-y-1">
                      {cell.events.map(e => (
                        <button
                          key={e.id}
                          onClick={ev => {
                            ev.stopPropagation()
                            setSelected(e)
                          }}
                          className="block w-full rounded-sm border border-black/15 bg-white px-1.5 py-1 text-left transition-colors hover:border-black"
                        >
                          <div className="flex items-start gap-1">
                            <ConfidenceBadge level={e.confidence} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold leading-tight">
                                {e.matchup ?? e.boxerName}
                              </div>
                              <SportTag sport={e.sport} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {openDay && (
              <div className="mt-4 border border-black/25 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/50">
                    {dayLabel(openDay.date)} — {openDay.events.length} event
                    {openDay.events.length === 1 ? '' : 's'}
                  </h2>
                  <button
                    onClick={() => setOpenDayKey(null)}
                    className="ml-auto text-[11px] uppercase tracking-[0.12em] text-black/40 hover:text-black"
                  >
                    Close day
                  </button>
                </div>
                {openDay.events.length === 0 ? (
                  <p className="mt-3 text-[13px] text-black/45">Nothing scheduled on this day.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {openDay.events.map(e => (
                      <li key={e.id}>
                        <button
                          onClick={() => setSelected(e)}
                          className="flex w-full items-start gap-2 rounded-sm border border-black/10 px-2.5 py-2 text-left transition-colors hover:border-black"
                        >
                          <ConfidenceBadge level={e.confidence} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">{e.matchup ?? e.boxerName}</span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-black/55">
                              {e.headline}
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <SportTag sport={e.sport} />
                              {e.sources.length > 1 && (
                                <span className="text-[10px] uppercase tracking-[0.08em] text-black/35">
                                  {e.sources.length} sources
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {undated.length > 0 && (
              <div className="mt-4 border border-dashed border-black/25 p-4">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/50">
                  Date to be announced — {monthLabel(key)}
                </h2>
                <div className="mt-3 space-y-1.5">
                  {undated.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="flex w-full items-center gap-2 rounded-sm border border-black/10 px-2.5 py-2 text-left transition-colors hover:border-black"
                    >
                      <ConfidenceBadge level={e.confidence} />
                      <span className="text-[13px] font-semibold">{e.matchup ?? e.boxerName}</span>
                      <SportTag sport={e.sport} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected && (
              <div className="mt-4 border border-black/80 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ConfidenceBadge level={selected.confidence} />
                  <span className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                    {selected.confidence} confidence
                  </span>
                  <span className="text-black/20">·</span>
                  <SportTag sport={selected.sport} />
                  {!selected.dayKnown && (
                    <>
                      <span className="text-black/20">·</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-black/50">No exact date</span>
                    </>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="ml-auto text-[11px] uppercase tracking-[0.12em] text-black/40 hover:text-black"
                  >
                    Close
                  </button>
                </div>
                <h3 className="mt-2 text-[22px] font-bold leading-tight">{selected.matchup ?? selected.boxerName}</h3>
                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-black/70">{selected.headline}</p>
                {selected.sources.length > 0 && (
                  <div className="mt-4 border-t border-black/10 pt-3">
                    <h4 className="text-[11px] uppercase tracking-[0.12em] text-black/45">
                      {selected.sources.length === 1 ? 'Source' : `Sources (${selected.sources.length})`}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {selected.sources.map((s, i) => (
                        <li key={`${s.url}-${i}`} className="text-[13px]">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-black/25 underline-offset-4 transition-colors hover:decoration-black"
                          >
                            {s.source}
                          </a>
                          {s.publishedAt && (
                            <span className="ml-2 text-[11px] text-black/35">
                              {new Date(s.publishedAt).toISOString().slice(0, 10)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.1em] text-black/45">
              <span className="text-black/60">{monthCount} in {monthLabel(key)}</span>
              <span className="flex items-center gap-1.5"><ConfidenceBadge level="high" /> Reported directly</span>
              <span className="flex items-center gap-1.5"><ConfidenceBadge level="medium" /> Inferred</span>
              <span className="flex items-center gap-1.5"><ConfidenceBadge level="low" /> Unconfirmed</span>
              <span className="ml-auto">
                Feeds {data.stats.sourcesOnline}/{data.stats.sourcesTotal} online
                {data.stats.sourcesOnline < data.stats.sourcesTotal && ' — some events may be missing'}
              </span>
            </div>
          </>
        )}

        {!loading && !error && data && data.events.length === 0 && (
          <p className="mt-10 text-[13px] text-black/50">No scheduled events found.</p>
        )}
      </main>
    </div>
  )
}
