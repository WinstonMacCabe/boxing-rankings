// Shared calendar logic for the combined boxing + MMA fight calendar.
//
// Both sites ship an identical copy of this file. The two `upcoming-fights.json`
// feeds have the same shape, so merging is mostly normalisation: the raw `sport`
// values are free text ("muay thai", "wrestling") and need mapping onto the
// SportKey vocabulary the rankings already use, and the headline scrapers emit
// several rows per real fight, so entries have to be deduplicated.

export type Confidence = 'high' | 'medium' | 'low'

export const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

/** Raw shape of an entry in upcoming-fights.json. Every field is optional: the
 *  two repos' TypeScript interfaces under-declare the data their own JSON emits. */
export interface RawFightEntry {
  boxerName?: string
  sport?: string
  headline?: string
  url?: string
  source?: string
  publishedAt?: string
  date?: string
  granularity?: string
  matchup?: string
  opponent?: string
  confidence?: string
  detectedAt?: string
}

export interface EventSource {
  source: string
  url: string
  publishedAt: string
}

export interface CalendarEvent {
  id: string
  /** 'YYYY-MM-DD' when the day is known, otherwise the first of the month. */
  date: string
  /** 'YYYY-MM' */
  month: string
  dayKnown: boolean
  sport: string
  sportKey: string | null
  matchup: string | null
  boxerName: string
  headline: string
  confidence: Confidence
  sources: EventSource[]
  /** How many raw rows were merged into this event. */
  mergedCount: number
}

export interface CalendarDay {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

export interface MonthSummary {
  key: string
  label: string
  count: number
}

/** free-text sport -> [SportKey, display label] */
const SPORT_MAP: Record<string, [string, string]> = {
  mma: ['mma', 'MMA'],
  boxing: ['boxing', 'Boxing'],
  kickboxing: ['kickboxing', 'Kickboxing'],
  'muay thai': ['muayThai', 'Muay Thai'],
  muaythai: ['muayThai', 'Muay Thai'],
  karate: ['karate', 'Karate'],
  taekwondo: ['taekwondo', 'Taekwondo'],
  'kick boxing': ['kickboxing', 'Kickboxing'],
  'kun khmer': ['kunKhmer', 'Kun Khmer'],
  khmer: ['kunKhmer', 'Kun Khmer'],
  'bare knuckle': ['bareKnuckle', 'Bare Knuckle'],
  bareknuckle: ['bareKnuckle', 'Bare Knuckle'],
  'freestyle wrestling': ['freestyleWrestling', 'Freestyle Wrestling'],
  freestyle: ['freestyleWrestling', 'Freestyle Wrestling'],
  // Deliberately kept distinct from freestyleWrestling: the detector emits a bare
  // "wrestling" for MMA bouts, and folding it into freestyle would mislabel them.
  wrestling: ['wrestling', 'Wrestling'],
  'ncaa wrestling': ['ncaaWrestling', 'NCAA Wrestling'],
  ncaa: ['ncaaWrestling', 'NCAA Wrestling'],
  'brazilian jiu jitsu': ['brazilianJiuJitsu', 'BJJ'],
  'brazilian jiu-jitsu': ['brazilianJiuJitsu', 'BJJ'],
  bjj: ['brazilianJiuJitsu', 'BJJ'],
  'jiu jitsu': ['brazilianJiuJitsu', 'BJJ'],
  sumo: ['sumo', 'Sumo'],
  'mongolian wrestling': ['mongolianWrestling', 'Mongolian Wrestling'],
  lethwei: ['lethwei', 'Lethwei'],
  savate: ['savate', 'Savate'],
  sambo: ['sambo', 'Sambo'],
  judo: ['judo', 'Judo'],
  capoeira: ['capoeira', 'Capoeira'],
  sanda: ['sanshou', 'Sanshou'],
  sanshou: ['sanshou', 'Sanshou'],
  wushu: ['sanshou', 'Sanshou'],
  'submission wrestling': ['submissionWrestling', 'Submission Wrestling'],
  'catch wrestling': ['catchWrestling', 'Catch Wrestling'],
  'greco roman': ['grecoRomanWrestling', 'Greco-Roman'],
  'greco-roman': ['grecoRomanWrestling', 'Greco-Roman'],
  'luta livre': ['lutaLivre', 'Luta Livre'],
}

export function normalizeSport(raw: string | undefined): { key: string | null; label: string } {
  const value = (raw ?? '').trim()
  if (!value) return { key: null, label: 'Unspecified' }
  const hit = SPORT_MAP[value.toLowerCase()]
  if (hit) return { key: hit[0], label: hit[1] }
  // Unknown sport: title-case it so it still renders sensibly.
  return { key: null, label: value.replace(/\b\w/g, c => c.toUpperCase()) }
}

export function normalizeConfidence(raw: string | undefined): Confidence {
  const value = (raw ?? '').toLowerCase()
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low'
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Last name token of one side of a matchup, e.g. "Sebastian Fundora" -> "fundora". */
function surnameOf(name: string): string {
  const tokens = name
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map(t => t.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(Boolean)
  return tokens[tokens.length - 1] ?? ''
}

/** Surnames of everyone named in a row, from `matchup` when present else `boxerName`. */
function surnamesOf(entry: RawFightEntry): Set<string> {
  const matchup = entry.matchup?.trim()
  const sides = matchup ? matchup.split(/\s+vs\.?\s+/i) : [entry.boxerName ?? '']
  const out = new Set<string>()
  for (const side of sides) {
    const s = surnameOf(side)
    if (s.length > 2) out.add(s)
  }
  return out
}

function sharesSurname(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  for (const s of a) if (b.has(s)) return true
  return false
}

function cleanHeadline(raw: string | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Merge raw rows from both feeds into one deduplicated, sorted event list.
 *
 * The scrapers emit a row per source article, so one real fight arrives many
 * times over, and the rows disagree on how much they name: some carry a full
 * matchup ("Sebastian Fundora vs Ermal Hadribeaj"), others only a surname
 * ("Fundora vs Hadribeaj"), others only one fighter ("Ermal Hadribeaj").
 *
 * So this runs three passes: exact grouping on month + day + identity, then a
 * union-find fold over each day that merges any two groups naming a common
 * surname, then a sweep that drops month-only groups superseded by a day-precise
 * one. A fighter cannot fight twice on one card, so same-day plus shared surname
 * is a strong enough signal. Surviving rows are ranked by confidence, the most
 * complete matchup phrasing wins, and the rest become the event's sources.
 */
export function buildEvents(raw: RawFightEntry[]): CalendarEvent[] {
  interface Bucket {
    rows: RawFightEntry[]
    month: string
    day: string | null
    surnames: Set<string>
  }

  const buckets = new Map<string, Bucket>()
  for (const entry of raw) {
    const date = (entry.date ?? '').trim()
    // Accept 'YYYY-MM' and 'YYYY-MM-DD'; drop anything else.
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date)
    if (!m) continue
    const month = `${m[1]}-${m[2]}`
    const day = m[3] && entry.granularity !== 'month' ? m[3] : null
    const identity = (entry.matchup ?? entry.boxerName ?? '').trim().toLowerCase()
    if (!identity) continue
    const surnames = surnamesOf(entry)

    const key = `${month}|${day ?? 'tba'}|${identity}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.rows.push(entry)
      for (const s of surnames) bucket.surnames.add(s)
    } else {
      buckets.set(key, { rows: [entry], month, day, surnames })
    }
  }

  // Fold same-day buckets that name a common surname.
  const list = [...buckets.values()]
  const byDay = new Map<string, number[]>()
  list.forEach((b, i) => {
    const k = `${b.month}|${b.day ?? 'tba'}`
    const group = byDay.get(k)
    if (group) group.push(i)
    else byDay.set(k, [i])
  })

  const parent = list.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const [, idxs] of byDay) {
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        if (!sharesSurname(list[idxs[i]].surnames, list[idxs[j]].surnames)) continue
        const a = find(idxs[i])
        const b = find(idxs[j])
        if (a !== b) parent[b] = a
      }
    }
  }

  const collapsed = new Map<number, Bucket>()
  for (let i = 0; i < list.length; i++) {
    const target = collapsed.get(find(i))
    if (target) {
      target.rows.push(...list[i].rows)
      for (const s of list[i].surnames) target.surnames.add(s)
    } else {
      collapsed.set(find(i), { rows: [...list[i].rows], month: list[i].month, day: list[i].day, surnames: new Set(list[i].surnames) })
    }
  }

  const built: { event: CalendarEvent; surnames: Set<string> }[] = []
  for (const bucket of collapsed.values()) {
    const sorted = [...bucket.rows].sort(
      (a, b) => CONFIDENCE_RANK[normalizeConfidence(b.confidence)] - CONFIDENCE_RANK[normalizeConfidence(a.confidence)]
    )
    const best = sorted[0]
    // Prefer the most complete matchup phrasing; ties keep confidence order.
    const matchup =
      sorted
        .map(r => r.matchup?.trim() || '')
        .filter(Boolean)
        .sort((a, b) => b.split(/\s+vs\.?\s+/i).length - a.split(/\s+vs\.?\s+/i).length)[0] || null
    const rawName = best.boxerName?.trim() || (matchup ? matchup.split(/\s+vs\.?\s+/i)[0].trim() : 'Unknown')
    // Wikipedia titles carry disambiguators, e.g. "Mike Perry (fighter)".
    const boxerName = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim() || rawName
    const headline = cleanHeadline(best.headline)
    const { key: sportKey, label: sportLabel } = normalizeSport(best.sport)

    // The same article can reach us twice (local file plus the live feed).
    const sources: EventSource[] = []
    const seenUrls = new Set<string>()
    for (const r of sorted) {
      const url = r.url?.trim()
      if (!url || seenUrls.has(url)) continue
      seenUrls.add(url)
      sources.push({ source: r.source?.trim() || 'Source', url, publishedAt: r.publishedAt ?? '' })
    }

    built.push({
      surnames: bucket.surnames,
      event: {
        id: `${bucket.month}-${bucket.day ?? 'tba'}-${[...bucket.surnames].sort().join('-') || 'unknown'}`,
        date: bucket.day ? `${bucket.month}-${bucket.day}` : `${bucket.month}-01`,
        month: bucket.month,
        dayKnown: bucket.day !== null,
        sport: sportLabel,
        sportKey,
        matchup,
        boxerName,
        headline: headline || matchup || boxerName,
        confidence: normalizeConfidence(best.confidence),
        sources,
        mergedCount: sorted.length,
      },
    })
  }

  // A month-only row is redundant once the same fight has an exact date.
  const events = built
    .filter(({ event, surnames }) =>
      event.dayKnown || !built.some(other => other.event.dayKnown && other.event.month === event.month && sharesSurname(other.surnames, surnames))
    )
    .map(({ event }) => event)

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.sport.localeCompare(b.sport))
}

export function summariseMonths(events: CalendarEvent[]): MonthSummary[] {
  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.month, (counts.get(e.month) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: monthLabel(key), count }))
}

/** Build a 6x7 grid of day cells covering the given month. */
export function buildMonthGrid(events: CalendarEvent[], year: number, month: number): CalendarDay[] {
  const byDate = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!e.dayKnown) continue
    const list = byDate.get(e.date)
    if (list) list.push(e)
    else byDate.set(e.date, [e])
  }

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  const today = new Date().toISOString().slice(0, 10)

  const cells: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    let y = year
    let m = month
    let d = i - firstWeekday + 1
    if (d < 1) {
      m = month - 1
      if (m < 1) { m = 12; y-- }
      d = daysInPrevMonth + d
    } else if (d > daysInMonth) {
      m = month + 1
      if (m > 12) { m = 1; y++ }
      d = d - daysInMonth
    }
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date, day: d, inMonth: m === month && y === year, isToday: date === today, events: byDate.get(date) ?? [] })
  }
  return cells
}

export function undatedForMonth(events: CalendarEvent[], monthKey: string): CalendarEvent[] {
  return events.filter(e => !e.dayKnown && e.month === monthKey)
}
