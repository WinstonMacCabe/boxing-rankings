import { readRankings } from '../lib/storage'
import { scanFighterFromWikipedia } from './wiki-detectors'
import * as fs from 'fs/promises'
import * as path from 'path'

const DATA_DIR = path.join(process.cwd(), 'public', 'data')
const OUTFILE = path.join(DATA_DIR, 'upcoming-fights.json')

const SENIOR_AGE = 53
// No horizon: scan every future scheduled fight, no matter how far out.
const NEWS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ITEMS_PER_FIGHTER = 25
const CONCURRENCY = 4
const FETCH_ATTEMPTS = 3

const SPORT_KEYWORDS: Record<string, string> = {
  kickboxing: 'kickboxing',
  muayThai: 'muay thai',
  karate: 'karate',
  freestyleWrestling: 'freestyle wrestling',
  ncaaWrestling: 'wrestling',
  brazilianJiuJitsu: 'brazilian jiu jitsu',
  sumo: 'sumo',
  mongolianWrestling: 'mongolian wrestling',
  lethwei: 'lethwei',
  kunKhmer: 'kun khmer',
  sambo: 'sambo',
  grecoRomanWrestling: 'greco roman wrestling',
  sanshou: 'sanshou',
  submissionWrestling: 'submission wrestling',
  bareKnuckle: 'bare knuckle',
}

interface ScheduledEntry {
  boxerName: string
  sport: string
  headline: string
  url: string
  source: string
  publishedAt: string
  date: string
  granularity: 'day' | 'month'
  matchup?: string
  opponent?: string
  confidence: 'high' | 'medium' | 'low'
  detectedAt: string
}

interface UpcomingFightsData {
  lastUpdated: string
  fights: ScheduledEntry[]
}

const MONTHS: [string, number][] = [
  ['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['may', 4], ['jun', 5],
  ['jul', 6], ['aug', 7], ['sep', 8], ['oct', 9], ['nov', 10], ['dec', 11],
]
const MONTH_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_ABBR_RE = MONTHS.map(([a]) => a).join('|')
// Day capture must not run into a 4-digit year ("September 2026" is a month,
// not September 20 — "20" followed by "26" would otherwise parse as a day).
const DAY_CAP = '(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)'
const MONTH_FULL_RE = MONTH_FULL.join('|')

const FIGHT_WORD_RE = /(?:vs\.?|v\.|fight(?:s|ing)?|bout|return|defend(?:s|ing|er)?|showdown|rematch|title|match(?:up)?|scheduled|announced|unification|preview|faces?|titles?|card|battle|official)/i

const RESULT_WORD_RE = /(?:results?|recap|wins?\b|beats?\b|defeats?\b|loses?\b|knockout|knocked|ko\b|tko\b|scorecard|highlights?|reactions?|breaks?\s+down|upset|finish(?:es|ed)?|dominates?|cruises?|stops?\b|drops?\b|rankings?\b)/i

const NAME_STOP_WORDS = new Set([
  'live', 'stream', 'fight', 'fights', 'official', 'preview', 'watch', 'title',
  'world', 'scheduled', 'announced', 'set', 'boxing', 'results', 'analysis',
  'returns', 'next', 'defends', 'defend', 'showdown', 'rematch', 'card', 'battle',
  'night', 'card', 'news', 'report', 'signs', 'fac', 'bir', 'super', 'new',
])

interface DateCandidate {
  ts: Date
  granularity: 'day' | 'month'
  year: number
  month: number
  day?: number
}

function now(): Date {
  return new Date()
}

function computeAge(birthDate: string | undefined, ref: Date): number | null {
  if (!birthDate) return null
  const parts = birthDate.split('-')
  const birthYear = parseInt(parts[0], 10)
  if (isNaN(birthYear)) return null
  if (parts.length === 3) {
    const birthMonth = parseInt(parts[1], 10)
    const birthDay = parseInt(parts[2], 10)
    const birthdayThisYear = new Date(ref.getFullYear(), birthMonth - 1, birthDay)
    return ref >= birthdayThisYear ? ref.getFullYear() - birthYear : ref.getFullYear() - birthYear - 1
  }
  return ref.getFullYear() - birthYear
}

function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function nameInTitle(title: string, clean: string): boolean {
  const t = title.toLowerCase()
  if (t.includes(clean.toLowerCase())) return true
  const surname = clean.split(/\s+/).pop()
  if (!surname || surname.length < 8) return false
  return t.includes(surname.toLowerCase()) && FIGHT_WORD_RE.test(title)
}

function monthIndex(token: string): number | null {
  const t = token.toLowerCase().replace(/\.$/, '')
  if (MONTH_FULL.includes(t)) return MONTH_FULL.indexOf(t)
  const abbr = MONTHS.find(([a]) => a === t)
  return abbr ? abbr[1] : null
}

function toInteger(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function extractDate(title: string, ref: Date): DateCandidate | null {
  const text = title.toLowerCase()

  const dayMatches: { month: number; day: number; year?: number }[] = []
  const pushDay = (m: RegExpExecArray, month: number, day: number, year?: number | null) => {
    if (day >= 1 && day <= 31) dayMatches.push({ month, day, year: year ?? undefined })
  }

  // Full month + day: "October 17, 2026", "October 17th"
  let re = new RegExp(`(${MONTH_FULL_RE})\\s+${DAY_CAP}(?:\\s*,?\\s*(20\\d{2}))?`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const month = monthIndex(m[1])
    if (month !== null) pushDay(m, month, parseInt(m[2], 10), toInteger(m[3]))
  }

  // Abbreviated month + day: "Oct 17", "Oct. 17, 2026"
  re = new RegExp(`(${MONTH_ABBR_RE})\\.?\\s+${DAY_CAP}(?:\\s*,?\\s*(20\\d{2}))?`, 'g')
  while ((m = re.exec(text)) !== null) {
    const month = monthIndex(m[1])
    if (month !== null) pushDay(m, month, parseInt(m[2], 10), toInteger(m[3]))
  }

  // Day before month name: "17 October 2026"
  re = new RegExp(`\\b${DAY_CAP}\\s+(${MONTH_FULL_RE})\\.?(?:\\s*,?\\s*(20\\d{2}))?`, 'g')
  while ((m = re.exec(text)) !== null) {
    const month = monthIndex(m[2])
    if (month !== null) pushDay(m, month, parseInt(m[1], 10), toInteger(m[3]))
  }

  // Numeric US requires a year: "10/17/2026". Bare "9/18" style dates are
  // anniversary/recap noise and never treated as a booking.
  re = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g
  while ((m = re.exec(text)) !== null) {
    const month = parseInt(m[1], 10)
    const day = parseInt(m[2], 10)
    if (month >= 1 && month <= 12) pushDay(m, month, day, toInteger(m[3]))
  }

  // ISO: "2026-10-17"
  re = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g
  while ((m = re.exec(text)) !== null) {
    const month = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    if (month >= 1 && month <= 12) pushDay(m, month, day, parseInt(m[1], 10))
  }

  // Month-level: "in October", "for October", "by October 2026"
  const monthYear: { month: number; year?: number }[] = []
  re = new RegExp(`\\b(?:in|during|this|for|around|by)\\s+(${MONTH_ABBR_RE})\\.?(?:\\s*(20\\d{2}))?`, 'g')
  while ((m = re.exec(text)) !== null) {
    const month = monthIndex(m[1])
    if (month !== null) monthYear.push({ month, year: toInteger(m[2]) ?? undefined })
  }

  const tryDay = (cand: { month: number; day: number; year?: number }): DateCandidate | null => {
    const yearBase = cand.year ?? ref.getFullYear()
    for (const year of [yearBase, yearBase + 1]) {
      const d = new Date(year, cand.month, cand.day)
      if (d.getMonth() !== cand.month || d.getDate() !== cand.day) continue
      if (d > ref) {
        return { ts: d, granularity: 'day', year, month: cand.month, day: cand.day }
      }
    }
    return null
  }

  for (const cand of dayMatches) {
    const r = tryDay(cand)
    if (r) return r
  }

  for (const cand of monthYear) {
    const year = cand.year ?? (cand.month < ref.getMonth() ? ref.getFullYear() + 1 : ref.getFullYear())
    const d = new Date(year, cand.month, 1)
    const monthFuture = year > ref.getFullYear() || (year === ref.getFullYear() && cand.month >= ref.getMonth())
    if (monthFuture) {
      return { ts: d, granularity: 'month', year, month: cand.month }
    }
  }

  return null
}

function extractMatchup(title: string, fighterClean: string): { matchup: string; opponent: string } | null {
  const tokens = title.split(/\s+/)
  let vsIdx = -1
  for (let i = 0; i < tokens.length; i++) {
    if (/^vs\.?$/i.test(tokens[i]) || /^v\.$/i.test(tokens[i])) { vsIdx = i; break }
  }
  if (vsIdx === -1) return null

  const isNameToken = (t: string): boolean => {
    if (!t) return false
    if (NAME_STOP_WORDS.has(t.toLowerCase().replace(/[^a-z]/g, ''))) return false
    return /^[A-ZÀ-ÿ]/.test(t)
  }

  const leftTokens: string[] = []
  for (let i = vsIdx - 1; i >= 0 && leftTokens.length < 3; i--) {
    if (isNameToken(tokens[i])) leftTokens.unshift(tokens[i])
    else break
  }
  const rightTokens: string[] = []
  for (let i = vsIdx + 1; i < tokens.length && rightTokens.length < 3; i++) {
    if (isNameToken(tokens[i])) rightTokens.push(tokens[i])
    else break
  }

  if (leftTokens.length === 0 || rightTokens.length === 0) return null
  const left = leftTokens.join(' ')
  const right = rightTokens.join(' ')
  const fighterLower = fighterClean.toLowerCase()
  const matches = (side: string): boolean => {
    const s = side.toLowerCase()
    return s === fighterLower || s.includes(fighterLower) || fighterLower.includes(s)
  }
  if (matches(left) && matches(right)) return null
  if (matches(left)) {
    return { matchup: `${left} vs ${right}`, opponent: right }
  }
  if (matches(right)) {
    return { matchup: `${left} vs ${right}`, opponent: left }
  }
  return null
}

function confidenceFor(granularity: 'day' | 'month', hasMatchup: boolean): ScheduledEntry['confidence'] {
  if (granularity === 'month') return 'low'
  return hasMatchup ? 'high' : 'medium'
}

function decodeEntities(s: string): string {
  return s
    .split('<![CDATA[').join('')
    .split(']]>').join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface RssItem {
  title: string
  link: string
  source: string
  publishedAt: string
}

function parseFeed(xml: string): RssItem[] {
  const items: RssItem[] = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(block)
    const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(block)
    const guidMatch = /<guid[^>]*>([\s\S]*?)<\/guid>/.exec(block)
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)
    const pubMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)
    const title = titleMatch ? stripTags(decodeEntities(titleMatch[1])).trim() : ''
    const url = (linkMatch ? stripTags(linkMatch[1]).trim() : (guidMatch ? stripTags(guidMatch[1]).trim() : ''))
    if (!title || !url) continue
    items.push({
      title,
      link: url,
      source: sourceMatch ? stripTags(decodeEntities(sourceMatch[1])).trim() : 'Google News',
      publishedAt: pubMatch ? new Date(pubMatch[1]).toISOString() : new Date().toISOString(),
    })
  }
  return items
}

async function fetchFeed(fighterClean: string, keyword: string): Promise<RssItem[]> {
  const q = encodeURIComponent(`"${fighterClean}" ${keyword}`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
  let lastErr: unknown
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
          'accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
      } else {
        const xml = await res.text()
        if (!xml.includes('<item>')) {
          lastErr = new Error('no items in feed')
          continue
        }
        return parseFeed(xml)
      }
    } catch (err) {
      lastErr = err
    }
    await new Promise(r => setTimeout(r, 1000 * attempt))
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++
      if (i >= items.length) return
      results[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return results
}

function buildRoster(rankings: { thirdary?: unknown; sports?: Record<string, unknown> }, ref: Date): { name: string; clean: string; keyword: string }[] {
  const seen = new Map<string, { name: string; clean: string; keyword: string }>()
  const site: 'mma' | 'boxing' = rankings.sports ? 'mma' : 'boxing'

  const add = (f: unknown, keyword: string) => {
    const rec = f as { name?: string; birthDate?: string }
    if (!rec || typeof rec.name !== 'string') return
    const clean = cleanName(rec.name)
    if (seen.has(clean)) return
    const age = computeAge(rec.birthDate, ref)
    if (age === null || age >= SENIOR_AGE) return
    seen.set(clean, { name: rec.name, clean, keyword })
  }

  if (Array.isArray(rankings.thirdary)) {
    for (const f of rankings.thirdary as unknown[]) add(f, site === 'mma' ? 'mma' : 'boxing')
  }

  if (rankings.sports && typeof rankings.sports === 'object') {
    for (const [sportKey, list] of Object.entries(rankings.sports)) {
      const keyword = SPORT_KEYWORDS[sportKey] || sportKey
      if (Array.isArray(list)) {
        for (const f of list as unknown[]) add(f, keyword)
      } else if (list && typeof list === 'object') {
        const rec = list as Record<string, unknown>
        for (const k of ['fighters', 'thirdary', 'worst']) {
          const arr = rec[k]
          if (Array.isArray(arr)) {
            for (const f of arr as unknown[]) add(f, keyword)
          }
        }
      }
    }
  }

  return Array.from(seen.values())
}

function fightKey(f: ScheduledEntry): string {
  return f.url || `${f.boxerName}|${f.date}|${(f.matchup || '').toLowerCase()}|${f.headline}`
}

async function main() {
  const ref = now()
  const rankings = await readRankings()
  const roster = buildRoster(rankings, ref)

  const limitEnv = process.env.FIGHTER_LIMIT
  const fightLimit = limitEnv ? parseInt(limitEnv, 10) : NaN
  let scanList = isNaN(fightLimit) || fightLimit <= 0 ? roster : roster.slice(0, fightLimit)
  const namesEnv = process.env.FIGHTER_NAMES
  if (namesEnv) {
    const wanted = namesEnv.split(',').map(s => s.trim().toLowerCase())
    scanList = scanList.filter(f => wanted.some(w => f.clean.toLowerCase().includes(w)))
  }

  console.log(`[schedule-scan] scanning ${scanList.length} fighters (${namesEnv ? 'filtered by FIGHTER_NAMES' : isNaN(fightLimit) ? 'full roster' : `limited to ${fightLimit}`})`)
  const cutoff = new Date(ref.getTime() - NEWS_WINDOW_MS).toISOString()

  let fetched = 0
  let totalItems = 0
  const entries: ScheduledEntry[] = []
  const failures: string[] = []

  await mapPool(scanList, CONCURRENCY, async (fighter) => {
    let items: RssItem[] = []
    try {
      items = await fetchFeed(fighter.clean, fighter.keyword)
      fetched++
      totalItems += items.length
    } catch {
      failures.push(fighter.clean)
      return
    }
    const seenUrl = new Set<string>()
    for (const item of items.slice(0, MAX_ITEMS_PER_FIGHTER)) {
      if (item.publishedAt < cutoff) continue
      if (RESULT_WORD_RE.test(item.title)) continue
      if (seenUrl.has(item.link)) continue
      seenUrl.add(item.link)

      const dateCand = extractDate(item.title, ref)
      if (!dateCand) continue

      const titleHasName = nameInTitle(item.title, fighter.clean)
      if (!titleHasName) continue

      const matchup = extractMatchup(item.title, fighter.clean)
      const confidence = confidenceFor(dateCand.granularity, matchup !== null)
      const dateStr = dateCand.granularity === 'day'
        ? `${dateCand.year}-${String(dateCand.month + 1).padStart(2, '0')}-${String(dateCand.day).padStart(2, '0')}`
        : `${dateCand.year}-${String(dateCand.month + 1).padStart(2, '0')}`

      entries.push({
        boxerName: fighter.name,
        sport: fighter.keyword,
        headline: item.title,
        url: item.link,
        source: item.source,
        publishedAt: item.publishedAt,
        date: dateStr,
        granularity: dateCand.granularity,
        matchup: matchup?.matchup,
        opponent: matchup?.opponent,
        confidence,
        detectedAt: new Date().toISOString(),
      })
    }

    const mmaRankings = rankings as { sports?: unknown }
    const isMma = typeof mmaRankings.sports === 'object' && mmaRankings.sports !== null
    try {
      const wikiRows = await scanFighterFromWikipedia(fighter, ref, { mmaOnly: isMma })
      entries.push(...wikiRows)
    } catch (err) {
      // A Wikipedia outage/rate limit must never sink the whole update; news
      // rows for this fighter (and all others) still flow.
      console.error(`[schedule-scan] wiki scan failed for ${fighter.clean}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  if (fetched === 0) {
    console.error(`[schedule-scan] all ${scanList.length} feeds failed. Leaving existing data untouched.`)
    process.exit(1)
  }

  let existing: ScheduledEntry[] = []
  try {
    const old = JSON.parse(await fs.readFile(OUTFILE, 'utf8')) as UpcomingFightsData
    existing = Array.isArray(old.fights) ? old.fights : []
  } catch {
    existing = []
  }

  const seen = new Set<string>()
  const merged: ScheduledEntry[] = []
  for (const f of [...entries, ...existing]) {
    if (seen.has(fightKey(f))) continue
    const ts = new Date(f.granularity === 'day' ? f.date : `${f.date}-01`)
    if (isNaN(ts.getTime()) || ts <= ref) continue
    seen.add(fightKey(f))
    merged.push(f)
  }

  // Keep existing far-future bookings even if they exceed the fresh horizon.
  merged.sort((a, b) => a.date.localeCompare(b.date))

  await fs.mkdir(DATA_DIR, { recursive: true })
  const out: UpcomingFightsData = {
    lastUpdated: ref.toISOString(),
    fights: merged,
  }
  await fs.writeFile(OUTFILE, JSON.stringify(out, null, 2))

  const dayCount = merged.filter(f => f.granularity === 'day').length
  const monthCount = merged.filter(f => f.granularity === 'month').length
  console.log(`[schedule-scan] fetched ${fetched}/${scanList.length} fighters, ${totalItems} items, ${failures.length} failures`)
  console.log(`[schedule-scan] entries: ${entries.length} new, kept ${merged.length} total (${dayCount} day-level, ${monthCount} month-level)`)
  if (failures.length > 0) {
    console.log(`[schedule-scan] failed (${failures.length}): ${failures.slice(0, 15).join(', ')}${failures.length > 15 ? ', ...' : ''}`)
  }
  for (const f of entries.slice(0, 15)) {
    console.log(`  [${f.granularity}/${f.confidence}] ${f.boxerName} (${f.sport}) -> ${f.date}${f.matchup ? ' | ' + f.matchup : ''} | ${f.headline.slice(0, 90)}`)
  }
  if (entries.length > 15) console.log(`  ... and ${entries.length - 15} more`)
}

main().catch(err => {
  console.error('News update failed:', err)
  process.exit(1)
})