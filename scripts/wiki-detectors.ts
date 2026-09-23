// Wikipedia scheduled-fight detectors for update-news.ts
// -------------------------------------------------------
// Self-contained (NO lib/wikipedia.ts import; that lib has drifted between the
// boxing and mma-rankings repos, and update-news.ts MUST stay byte-identical
// across repos — see the sync discipline in AGENTS.md). This module therefore
// only uses: fetch + setTimeout (Node 18+/22), a hardcoded Wikipedia API
// endpoint, and fighter records passed in from buildRoster(). It is byte-copied
// verbatim to the mma rank-rankings repo, so it must never reference
// repo-specific storage/ranking helpers.
//
// All detectors return entries in the EXACT ScheduledEntry shape that
// update-news.ts writes to upcoming-fights.json and emails, so the existing
// fightKey-dedupe/email pipeline treats them identically to Google-News rows.
// News rows are built first (see main()), and fightKey dedupe is first-wins, so
// a booking seen in BOTH news and Wikipedia keeps the news headline. That is
// the user-confirmed "News wins" rule.

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WIKI_UA =
  'FightNewsScanner/1.0 (wikipedia-scheduled-fight detector; contact fight-news@winstonmaccabe.dev)'
const WIKI_ATTEMPTS = 3
// Global minimum spacing between Wikipedia requests. update-news.ts runs
// CONCURRENCY=4 workers and the promo scan fans out multiple fetches per
// fighter, so without a module-wide gate en.wikipedia.org responds 429 and the
// scan (and nightly cron) dies. ~3 req/s sustained stays well under MediaWiki's
// anonymous burst limit.
const WIKI_MIN_GAP_MS = 350
const WIKI_HORIZON_MS = 180 * 24 * 60 * 60 * 1000

const MONTHS_FULL = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
]
const MONTHS_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => (parseInt(n, 10) >= 0 ? String.fromCharCode(parseInt(n, 10)) : ''))
}

function stripWikiMarkup(s: string): string {
  return s
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/'{2,}/g, '')
    .replace(/\{\{[^{}]*?\}\}/g, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim()
}

// ---------- low-level fetch (mirrors fetchFeed retry pattern) ----------
let wikiLastReq = 0
let wikiChain: Promise<void> = Promise.resolve()
function wikiGate<T>(fn: () => Promise<T>): Promise<T> {
  const p = wikiChain.then(async () => {
    const wait = wikiLastReq + WIKI_MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    wikiLastReq = Date.now()
    return fn()
  })
  wikiChain = p.then(() => {}, () => {})
  return p
}

async function requestWikitext(url: string): Promise<string | null> {
  return wikiGate(async () => {
    const res = await fetch(url, {
      headers: { 'user-agent': WIKI_UA, accept: 'application/json' },
    })
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      await new Promise(r => setTimeout(r, (retryAfter ? parseInt(retryAfter, 10) : 3) * 1000))
      throw new Error('wiki rate limit')
    }
    if (!res.ok) throw new Error(`wiki HTTP ${res.status}`)
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { revisions?: { slots?: { main?: { content?: string } } }[] }> }
    }
    const pages = data?.query?.pages ?? {}
    for (const p of Object.values(pages)) {
      const slot = p?.revisions?.[0]?.slots?.main as { content?: string } | undefined
      // MediaWiki returns the wikitext at slots.main["*"] for rvslots=main
      // (some APIs reply with .content instead); handle both.
      const content =
        slot && typeof (slot as { '*': string })['*'] === 'string'
          ? (slot as { '*': string })['*']
          : slot?.content
      if (typeof content === 'string') return content
    }
    return null
  })
}

async function fetchPageWikitext(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    origin: '*',
    titles: title,
  })
  const url = `${WIKI_API}?${params.toString()}`
  for (let attempt = 1; attempt <= WIKI_ATTEMPTS; attempt++) {
    try {
      return await requestWikitext(url)
    } catch {
      // 429/HTTP blips are transient; the gate keeps global request spacing.
    }
    await new Promise(r => setTimeout(r, 1000 * attempt))
  }
  return null
}

// Fighter record passed from buildRoster: { name, clean, keyword } (plus sport-grouping via rankings.sports for mma)
export interface WikiRosterFighter {
  name: string
  clean: string
  keyword: string
}

// Entry mirroring update-news.ts's ScheduledEntry shape for wiki-only rows.
export interface WikiScheduledEntry {
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

// ---------- shared mini-parsers (no lib imports) ----------
function monthIndex(tok: string): number | null {
  const t = tok.toLowerCase().replace(/\.$/, '')
  let i = MONTHS_ABBR.indexOf(t)
  if (i >= 0) return i
  i = MONTHS_FULL.indexOf(t)
  return i >= 0 ? i : null
}

function toInteger(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

interface DateCandidate {
  ts: Date
  granularity: 'day' | 'month'
  year: number
  month: number
  day?: number
}

// Parse "October 24, 2026", "24 October 2026", "2026-10-24",
// "Oct 24, 2026", "October 2026" (month granularity). Returns only FUTURE
// dates within WIKI_HORIZON of ref. Null when ambiguous/unparseable.
function extractWikiDate(text: string, ref: Date): DateCandidate | null {
  const t = text.trim()
  const horizon = new Date(ref.getTime() + WIKI_HORIZON_MS)
  let m: RegExpExecArray | null

  // Month-name first: "October 24, 2026" / "Oct 24 2026" / "October 24th, 2026"
  m = /^(?:[A-Za-z]{3,9}\.?) (.+)$/.exec(t)
  if (m) {
    const w = m[1].split(/[ ,]+/).filter(Boolean)
    const mon = monthIndex(/^[A-Za-z]+/.exec(m[1])?.[0] ?? '')
    // Approximate: handled below via re-scan of the whole candidate.
  }
  // day-first: "24 October 2026"
  m = /^(\d{1,2})\s+([A-Za-z]{3,9}\.?)\s+(20\d{2})$/.exec(t)
  if (m) {
    const mi = monthIndex(m[2])
    if (mi !== null) {
      const d = parseInt(m[1], 10)
      if (d >= 1 && d <= 31) {
        const ts = new Date(parseInt(m[3], 10), mi, d)
        if (ts > ref && ts <= horizon) {
          return { ts, granularity: 'day', year: ts.getFullYear(), month: mi, day: d }
        }
      }
    }
  }
  // month-first: "October 24, 2026" or "October 2026"
  m = /^([A-Za-z]{3,9}\.?)\s+(\d{1,2}(?:st|nd|rd|th)?)?,?\s*(20\d{2})$/.exec(t)
  if (m) {
    const mi = monthIndex(m[1])
    if (mi !== null) {
      const year = parseInt(m[3], 10)
      if (m[2]) {
        const d = parseInt(m[2], 10)
        if (d >= 1 && d <= 31) {
          const ts = new Date(year, mi, d)
          if (ts > ref && ts <= horizon) {
            return { ts, granularity: 'day', year, month: mi, day: d }
          }
        }
      } else {
        const ts = new Date(year, mi, 1)
        if (ts > ref) {
          return { ts, granularity: 'month', year, month: mi }
        }
      }
    }
  }
  // ISO: "2026-10-24" / "2026-10-24" (day), "2026-10" (month)
  m = /^(20\d{2})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(t)
  if (m) {
    const year = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    if (mo >= 1 && mo <= 12) {
      if (m[3]) {
        const d = parseInt(m[3], 10)
        if (d >= 1 && d <= 31) {
          const ts = new Date(year, mo - 1, d)
          if (ts > ref && ts <= horizon) {
            return { ts, granularity: 'day', year, month: mo - 1, day: d }
          }
        }
      } else {
        const ts = new Date(year, mo - 1, 1)
        if (ts > ref) {
          return { ts, granularity: 'month', year, month: mo - 1 }
        }
      }
    }
  }
  return null
}

// extractWikiDate is anchored (it expects a bare date). Callers scan sentences/rows,
// so first pull a date-like token out, then pass it through extractWikiDate.
function findDateToken(text: string): string | null {
  const plain = stripWikiMarkup(text).replace(/\s+/g, ' ')
  for (const re of [
    /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/,
    /\b(20\d{2})-(\d{1,2})\b/,
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/,
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/,
    /\b([A-Za-z]{3,9})\.?\s+(20\d{2})\b/,
  ]) {
    const m = re.exec(plain)
    if (m) {
      const token = m[0]
      if (extractWikiDate(token, new Date())) return token
    }
  }
  return null
}

function stripToProse(text: string): string {
  // Remove refs, templates, tables, HTML and attributes — but KEEP [[wikilinks]]
  // so the opponent can be read back out of the sentence. Mirrors stripWikiMarkup
  // except link markup is preserved.
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\{\{[^{}]*?\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\||\|\}|'''|''|&nbsp;/g, (tok: string) => (tok === '&nbsp;' ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function opponentFromSentence(sentence: string, clean: string): string | null {
  // Prefer a wikilink opponent. Skip title/venue links (Championship, UFC 333…):
  // take the LAST link in the sentence (opponents come right before the date),
  // and reject obvious non-person tokens.
  const links = Array.from(sentence.matchAll(/\[{2}([^\]|]+?)\]{2}/g), m => cleanName(stripTags(m[1])).trim())
  const nonPerson = /(championship|title|ufc|fight night|bellator|one|glory|pfl|rizin|k-1|arena|stadium|tournament|prelim|main event|promotion)/i
  for (let k = links.length - 1; k >= 0; k--) {
    const cand = links[k]
    if (!cand || !looksLikeOpponent(cand, clean)) continue
    // Two-word name runs are the strongest signal; whitespace alone is weak.
    if (/\s/.test(cand) || /^[A-Z][a-z]+ [A-Z][a-z]+/.test(cand)) return cand
  }
  // Fallback: named verb + capitalized name run, trimming title descriptors
  // ("two-time champion Alexander Volkanovski" → "Alexander Volkanovski").
  const re = /(?:challenge for|face|fight|meet|take on|against|defend against|rematch with)\s+([A-Z][A-Za-z.-]{0,3}(?:\s+[A-Z][A-Za-z'-]+)+)/
  const m = sentence.match(re)
  if (m) {
    const raw = cleanName(stripTags(m[1]))
    const tokens = raw.split(/\s+/).filter(Boolean)
    const drop = /^(two-?time|three-?time|four-?time|former|current|reigning|undefeated|defending|ex-)/i
    while (tokens.length > 1 && drop.test(tokens[0])) tokens.shift()
    const opp = tokens.join(' ')
    if (opp && opp.toLowerCase() !== clean.toLowerCase()) return opp
  }
  return null
}

function eventFromSentence(sentence: string): string | null {
  const re = /\bat\s+(?:the\s+)?((?:UFC|Bellator|ONE|PFL|RIZIN|K-1|GLORY|BKFC|MAX Muay Thai|Bare Knuckle|Fight Night)\s*[A-Za-z0-9 .-]{2,40}?)(?:\s+(?:on|in|and|,)|$)/i
  const m = sentence.match(re)
  return m ? stripTags(m[1]).trim() : null
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const NON_PERSON_OPPONENT = /(championship|title|ufc|fight night|bellator|one|glory|pfl|rizin|k-1|arena|stadium|tournament|prelim|main event|promotion|world|cup|record|event)/i
const LOCATION_OPPONENT = /(bangkok|jakarta|yokohama|tokyo|osaka|pattaya|phnom penh|antwerp|rotterdam|amsterdam|paris|london|las vegas|los angeles|new york|glendale|salt lake|abu dhabi|dubai|riyadh|singapore|hong kong|beijing|manila|seoul|melbourne|sydney|moscow|chicago|miami|houston|dallas|atlanta|toronto)/i

// An opponent string must look like a person's name: no digits (event numbers
// like "BKFC 94" / "RAF 14"), no commas ("Bangkok, Thailand"), and no obvious
// non-person/location tokens.
function looksLikeOpponent(candidate: string, clean: string): boolean {
  const c = candidate.trim()
  if (!c || c.length < 2 || c.length > 50) return false
  if (c.toLowerCase() === clean.toLowerCase()) return false
  if (/[0-9,]/.test(c)) return false
  if (NON_PERSON_OPPONENT.test(c)) return false
  if (LOCATION_OPPONENT.test(c)) return false
  // Single-word names (Muay Thai short names like "Buakaw", "Rodtang") are fine;
  // multi-word names just need a capitalized Leading word.
  return /^[A-Z][A-Za-z.' -]{1,49}$/.test(c)
}

// ---------- Detector 1: fighter-page prose ----------
// Look for sentences like:
//   "Evloev is scheduled to challenge Alexander Volkanovski on October 24, 2026 at UFC 333."
//   "Buakaw is scheduled to face Meng Gaofeng on 3 October 2026 at MAX Muay Thai."
// Working in the raw-fighter wikitext of the fighter's own page. Sentences are
// taken from a prose variant of the RAW text (refs/templates gone, [[wikilinks]]
// intact) so sentence indices line up AND opponentFromSentence can read links.
export function scheduledInProse(
  wikitext: string,
  fighter: WikiRosterFighter,
  ref: Date,
): WikiScheduledEntry | null {
  const clean = fighter.clean.toLowerCase()
  const surname = clean.split(/\s+/).slice(-1)[0] ?? clean
  const prose = stripToProse(wikitext)
  const plain = stripWikiMarkup(wikitext)
  const sentences = prose.split(/(?<=[.!?])\s+/)
  const plainSentences = plain.split(/(?<=[.!?])\s+/)
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    if (!sentence) continue
    const sLow = sentence.toLowerCase()
    // Accept the full name OR the surname — prose usually uses just the last name.
    if (!(sLow.includes(clean) || (surname && sLow.includes(surname)))) continue
    // Must assert the fighter + a scheduled/planned verb for an upcoming bout.
    if (!/\b(scheduled|planned|set|expected|booked|slated|schedule)\b/i.test(sentence)) continue
    if (!/\b(face|fight|challenge|vs\.?|versus|take on|defend|rematch|return)\b/i.test(sentence)) continue

      const lineEnd = sentence.indexOf('\n')
      // A "sentence" that still contains section/table remnants (==headers==, {|
      // wikitable opener, |- row separators, class=") is structural markup, not
      // a scheduled-fight prose sentence — skip it so the email never shows
      // "==Championships== {|" garbage.
      if (/==|\{\||\|-|class="?wikitable|!scope/.test(sentence)) continue
      // Extract a date from the whole sentence.
      const dateTok = findDateToken(sentence)
      if (!dateTok) continue
      const cand = extractWikiDate(dateTok, ref)
      if (!cand) continue

      const opponent = opponentFromSentence(sentence, fighter.clean)
      const matchup = opponent ? `${fighter.clean} vs ${opponent}` : undefined
      const dateStr = cand.granularity === 'day'
        ? `${cand.year}-${String(cand.month + 1).padStart(2, '0')}-${String(cand.day).padStart(2, '0')}`
        : `${cand.year}-${String(cand.month + 1).padStart(2, '0')}`
      const plainAt = plainSentences[i] ?? ''
      // The prose-array and plain-array split differently (prose drops headers/
      // tables/refs), so the index may land on a section header or table fragment
      // in the plain variant. Reject those so headlines never leak "==Champ...=="
      // or "{| class=wikitable" markup into the email.
      if (/\{\||class=|\|}|^-|==|\n\*/.test(plainAt)) continue
      const headline = stripWikiMarkup(sentence ?? plainAt).replace(/\s+/g, ' ').trim().slice(0, 200)
      if (!headline) continue

      return {
        boxerName: fighter.name,
        sport: fighter.keyword,
        headline,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(fighter.clean.replace(/ /g, '_'))}`,
      source: 'Wikipedia (fighter page prose)',
      publishedAt: new Date().toISOString(),
      date: dateStr,
      granularity: cand.granularity,
      matchup,
      opponent: opponent ?? undefined,
      confidence: opponent && cand.granularity === 'day' ? 'high' : opponent ? 'medium' : 'low',
      detectedAt: new Date().toISOString(),
    }
  }
  return null
}

// ---------- Detector 2: record-table future row ----------
// Records tables look like (BoxRec / sport-record template):
//   {{Fight record start|...}}
//   |-
//   | 2026-10-03 || || Meng Gaofeng || MAX Muay Thai || Pattaya
//   |-
//   | 2025-03-08 || {{yes2}}Win || X || Kickboxing || ...
// A FUTURE date with a BLANK result cell = scheduled (not yet fought).
function findRecordTables(wikitext: string): { start: string; endIndex: number }[] {
  const out: { start: string; endIndex: number }[] = []
  const endMarkers = ['{{Fight record end', '{{Boxing record end', '{{MMA record end', '{{Kickboxing record end', '{{Muay Thai record end', '{{end'] 
  for (const marker of ['{{Fight record start', '{{Boxing record start', '{{MMA record start', '{{Kickboxing record start', '{{Muay Thai record start']) {
    let from = 0
    let idx: number
    while ((idx = wikitext.indexOf(marker, from)) !== -1) {
      // Find the FIRST matching end marker that appears in the whole page.
      let end = -1
      for (const em of endMarkers) {
        const cand = wikitext.indexOf(em, idx)
        if (cand !== -1 && (end === -1 || cand < end)) end = cand
      }
      if (end === -1) break
      out.push({ start: wikitext.slice(idx, end), endIndex: end })
      from = idx + marker.length
    }
  }
  return out
}

export function scheduledInRecordTable(
  wikitext: string,
  fighter: WikiRosterFighter,
  ref: Date,
): WikiScheduledEntry | null {
  const tables = findRecordTables(wikitext)
  const horizon = new Date(ref.getTime() + WIKI_HORIZON_MS)
  for (const t of tables) {
    // Rows split by |-. Each chunk after the header starts with the date cell,
    // possibly preceded by a style attribute (e.g. "|- style=\"background:#alarm\"").
    const rows = t.start.split(/\n\|-/)
    for (const row of rows) {
      const rowText = stripWikiMarkup(row).trim()
      if (!rowText || /\b(legend|record start)\b/i.test(rowText)) continue

      // Slack first line: "2026-10-03 || ..." or "| 2026-10-03 || ...".
      const dateTok = findDateToken(rowText)
      if (!dateTok) continue
      const dateCand = extractWikiDate(dateTok, ref)
      if (!dateCand || dateCand.granularity !== 'day') continue

      // Blank result cell => not yet fought. A row with Win/Loss/Draw/NC is done.
      if (/\b(win|loss|draw|no contest|nc\b|drawn|won|lost)\b/i.test(rowText)) continue

      const cellsArr = row
        .split(/\|{1,2}/)
        .map(c => stripWikiMarkup(c).trim())
        .filter(Boolean)
        .filter(c => c.length > 1 && !/^style=/.test(c))
      const dateStr = `${dateCand.year}-${String(dateCand.month + 1).padStart(2, '0')}-${String(dateCand.day).padStart(2, '0')}`
      // Prefer the wikilink opponent that appears right after the date cell
      // (rows are: date | result | opponent || event || venue ...). Fall back to
      // the first capitalized multiword cell that isn't a flagicon/event token.
      const afterDate = row.slice(row.indexOf(dateTok))
      const linked = /\[\[([^\]|]*)\]\]/.exec(afterDate)
      let opponent: string | null = linked
        ? cleanName(stripWikiMarkup(linked[1]).trim())
        : null
      if (opponent && !looksLikeOpponent(opponent, fighter.clean)) opponent = null
      if (!opponent) {
        opponent =
          cellsArr
            .filter(c => c !== dateStr)
            .find(c => looksLikeOpponent(c, fighter.clean))
            ?? null
      }
      if (opponent && opponent.toLowerCase() === fighter.clean.toLowerCase()) opponent = null
      return {
        boxerName: fighter.name,
        sport: fighter.keyword,
        headline: `${fighter.name} — scheduled vs ${opponent ?? 'TBD'}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(fighter.clean.replace(/ /g, '_'))}`,
        source: 'Wikipedia (record table)',
        publishedAt: new Date().toISOString(),
        date: dateStr,
        granularity: 'day',
        matchup: opponent ? `${fighter.clean} vs ${opponent}` : undefined,
        opponent: opponent ?? undefined,
        confidence: opponent ? 'high' : 'medium',
        detectedAt: new Date().toISOString(),
      }
    }
  }
  return null
}

// ---------- Detector 3: promotion-event scan (MMA/fight-pages with promotions; MMA gated) ----------
// The fighter's page names the promotion(s) they fight under (e.g. "UFC 333",
// "UFC Fight Night 293", "Bellator 302"). We detect those promotion tokens from
// the fighter's own wikitext (prose "at UFC 333" + article categories +
// infobox organization), then fetch the promotion's current/upcoming season
// page (e.g. "2026 in UFC", "List of UFC events") and pull future event rows +
// the fighter's name-link on each upcoming event page.
async function promotionOf(wikitext: string): Promise<string[]> {
  const out = new Set<string>()
  // Prose + category detection of promotion names.
  const re = /(?:UFC|Bellator|ONE Championship|PFL|RIZIN|K-1|GLORY|BKFC|Bare Knuckle Fighting Championship|MAX Muay Thai)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(wikitext)) !== null) {
    if (/(?:Win|Won|Loss|Lose|Defeated|Beat|Knockout|results)\b/i.test(wikitext.slice(Math.max(0, m.index - 120), m.index))) continue
    out.add(m[0])
  }
  return Array.from(out)
}

const PROMO_LIST_PAGES: Record<string, string> = {
  'Ultimate Fighting Championship': 'List of UFC events',
  'UFC': 'List of UFC events',
  'Bellator': 'List of Bellator MMA events',
  'ONE Championship': 'List of ONE Championship events',
  'PFL': 'List of PFL events',
  'RIZIN': 'List of RIZIN events',
  'GLORY': 'List of GLORY events',
  'K-1': 'List of K-1 events',
  'BKFC': 'List of BKFC events',
}

function promoListsFor(tokens: string[], locales: Record<string, string>, mmaOnly: boolean): string[] {
  const out: string[] = []
  for (const t of tokens) {
    const map = mmaOnly ? { ...PROMO_LIST_PAGES } : {}
    const title = map[t]
    if (title) out.push(title)
  }
  return Array.from(new Set(out))
}

export interface PromotionScanResult {
  entries: WikiScheduledEntry[]
  promotionsSeen: string[]
}

export async function scheduledInPromotionEvents(
  wikitext: string,
  fighter: WikiRosterFighter,
  ref: Date,
  { mmaOnly }: { mmaOnly: boolean },
): Promise<PromotionScanResult> {
  const res: PromotionScanResult = { entries: [], promotionsSeen: [] }
  if (!mmaOnly) return res

  const tokens = (await promotionOf(wikitext)) as string[]
  res.promotionsSeen = tokens
  const listTitles = promoListsFor(tokens, {}, true)
  for (const listTitle of listTitles) {
    const listWiki = await fetchPageWikitext(listTitle)
    if (!listWiki) continue
    const clean = fighter.clean.toLowerCase()
    for (const row of listWiki.split(/\n\|-/)) {
      // Event row = a [[event-pipe|event display]] link + a date. Date appears as
      //   | {{dts|2026|Oct|24}} |  (after the event link)   OR
      //   | 2026-10-24 || [[Event Name]]  (before the event link)
      const link = /\[{2}([^\]|]+)\|([^\]|]*?)\]{2}/.exec(row)
      if (!link) continue
      const eventTitleRaw = stripWikiMarkup(link[1]).trim()
      const display = stripWikiMarkup(link[2]).trim() || eventTitleRaw
      const dts = /\{\{\s*dts\s*\|\s*(\d{4})\s*\|\s*([A-Za-z]{3,9})\s*\|\s*(\d{1,2})\s*\}\}/i.exec(row)
      const dateCand = dts
        ? (() => {
            const mi = monthIndex(dts[2]!)
            const y = parseInt(dts[1]!, 10)
            const d = parseInt(dts[3]!, 10)
            if (mi === null || y < 2000 || d < 1 || d > 31) return null
            const ts = new Date(y, mi, d)
            const horizonMs = ref.getTime() + WIKI_HORIZON_MS
            if (ts <= ref || ts.getTime() > horizonMs) return null
            return { ts, granularity: 'day', year: y, month: mi, day: d }
          })()
        : findDateToken(row) && extractWikiDate(findDateToken(row)!, ref)
      if (!dateCand || dateCand.granularity !== 'day') continue
      if (/win|lost|defeated|knockout|finished/i.test(row)) continue
      // Most main-event titles already name the fighter ("UFC 333: X vs Y"), so
      // we can accept the row without a second request. Only fetch the event page
      // for generically-named events (e.g. "UFC Fight Night 293") to confirm the
      // fighter is on the card. This keeps per-fighter requests near O(1).
      const rowHasFighter = stripTags(row).toLowerCase().includes(clean)
      if (rowHasFighter) {
        const dateStr = `${dateCand.year}-${String(dateCand.month + 1).padStart(2, '0')}-${String(dateCand.day).padStart(2, '0')}`
        res.entries.push({
          boxerName: fighter.name,
          sport: fighter.keyword,
          headline: `${fighter.name} on ${display} (${dateStr})`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(eventTitleRaw.replace(/ /g, '_'))}`,
          source: `Wikipedia (${listTitle})`,
          publishedAt: new Date().toISOString(),
          date: dateStr,
          granularity: 'day',
          confidence: 'high',
          detectedAt: new Date().toISOString(),
        })
        break
      }
      // Fetch the event page and look for the fighter (name-link or prose).
      const eventWiki = await fetchPageWikitext(eventTitleRaw)
      if (!eventWiki) continue
      if (!stripTags(eventWiki).toLowerCase().includes(clean)) continue
      const dateStr = `${dateCand.year}-${String(dateCand.month + 1).padStart(2, '0')}-${String(dateCand.day).padStart(2, '0')}`
      res.entries.push({
        boxerName: fighter.name,
        sport: fighter.keyword,
        headline: `${fighter.name} on ${display} (${dateStr})`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(eventTitleRaw.replace(/ /g, '_'))}`,
        source: `Wikipedia (${listTitle})`,
        publishedAt: new Date().toISOString(),
        date: dateStr,
        granularity: 'day',
        confidence: 'high',
        detectedAt: new Date().toISOString(),
      })
      break
    }
  }
  return res
}

// ---------- orchestrator: one fetch of the fighter's own page, run all three ----------
/**
 * Fetches the fighter's Wikipedia page ONCE and runs every detector that keys off
 * the fighter's own page wikitext: prose ("scheduled to challenge..."), record-table
 * future rows, and (MMA promotions only) the promotion-events scan.
 *
 * update-news.ts calls this exactly once per fighter, AFTER its Google-News rows for
 * that fighter are already in the entries array, so the existing first-wins fightKey
 * dedupe keeps news on top ("News wins", user-confirmed).
 */
export async function scanFighterFromWikipedia(
  fighter: WikiRosterFighter,
  ref: Date,
  { mmaOnly }: { mmaOnly: boolean },
): Promise<WikiScheduledEntry[]> {
  const title = fighter.clean ? fighter.clean.replace(/ /g, '_') : fighter.name.replace(/ /g, '_')
  const wikitext = await fetchPageWikitext(title)
  if (!wikitext) return []

  const out: WikiScheduledEntry[] = []

  const prose = scheduledInProse(wikitext, fighter, ref)
  if (prose) out.push(prose)

  const record = scheduledInRecordTable(wikitext, fighter, ref)
  if (record) out.push(record)

  if (mmaOnly) {
    const promo = await scheduledInPromotionEvents(wikitext, fighter, ref, { mmaOnly: true })
    out.push(...promo.entries)
  }

  // Dedupe wiki rows within a single fighter by date (prose/record win over the
  // promo event-list row for the same date). Keeps the email clean when the same
  // booking is detected both in the fighter prose and on the promotion event page.
  const seenDates = new Map<string, WikiScheduledEntry>()
  for (const e of out) {
    if (!seenDates.has(e.date)) seenDates.set(e.date, e)
  }
  return Array.from(seenDates.values())
}
