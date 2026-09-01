import type { WbaChampion } from './types'

const USER_AGENT = 'BoxingRankings/1.0 (https://github.com/user/boxing; boxing-app@example.com)'
const API_URL = 'https://en.wikipedia.org/w/api.php'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const MONTH_PAT = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/i

interface ParsedDate {
  y: number
  m: number
  d: number
  explicitDay: boolean
}

function monthNameToIndex(s: string): number | undefined {
  const key = s.toLowerCase().slice(0, 3)
  return MONTHS[key]
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

// Parse one side of a reign column, e.g. "13 Feb 1982", "Dec 1988", "25 Mar" (year inferred), or "present".
function parseReignSide(raw: string, otherYear?: number): ParsedDate | 'present' | null {
  const s = raw.trim()
  if (!s) return null
  if (/^present$/i.test(s)) return 'present'

  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const mi = monthNameToIndex(m[2])
    if (mi === undefined) return null
    return { y: parseInt(m[3], 10), m: mi, d: parseInt(m[1], 10), explicitDay: true }
  }

  m = s.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const mi = monthNameToIndex(m[1])
    if (mi === undefined) return null
    return { y: parseInt(m[2], 10), m: mi, d: 1, explicitDay: false }
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)$/)
  if (m) {
    const mi = monthNameToIndex(m[2])
    if (mi === undefined) return null
    if (otherYear === undefined) return null
    return { y: otherYear, m: mi, d: parseInt(m[1], 10), explicitDay: true }
  }

  return null
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function stripCellStyle(cell: string): string {
  return cell.replace(/^style="[^"]*"\s*\|?\s*/, '')
}

function cleanWikiName(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedRow {
  name: string
  status?: string
  reign: string
  defenses: number
  skip: boolean
}

function parseRow(cells: string[]): ParsedRow {
  const row: ParsedRow = { name: '', reign: '', defenses: 0, skip: false }

  let nameCell = ''
  let reignCell = ''
  let defenseCell = ''

  for (const raw of cells) {
    if (raw.includes('colspan')) { row.skip = true; break }
    const cell = raw.startsWith('|') ? raw.slice(1) : raw
    const stripped = stripCellStyle(cell)
    if (/^align=left/.test(cell)) {
      nameCell = cell
    } else if (/present/i.test(stripped) && /[0-9]/.test(stripped)) {
      reignCell = stripped
    } else if (MONTH_PAT.test(stripped) && /[0-9]/.test(stripped) && stripped.includes('–')) {
      reignCell = stripped
    } else if (/^\d/.test(stripped)) {
      defenseCell = stripped
    }
  }

  if (row.skip || !nameCell || !reignCell) {
    row.skip = true
    return row
  }

  const nameContent = nameCell.replace(/^align=left\s*\|\s*/, '')
  const statusMatch = nameContent.match(/&ndash;\s*(.+)$/)
  const baseNameRaw = statusMatch ? nameContent.slice(0, statusMatch.index) : nameContent
  row.name = cleanWikiName(baseNameRaw.split('<br')[0])
  if (statusMatch) {
    const statusRaw = statusMatch[1].split('<br')[0].replace(/^\{\{small\|/, '').replace(/\}\}$/, '')
    row.status = cleanWikiName(statusRaw).replace(/^def\.\s*/i, '') || undefined
  }

  row.reign = stripCellStyle(reignCell).trim()
  const defMatch = stripCellStyle(defenseCell).match(/^(\d+)/)
  row.defenses = defMatch ? parseInt(defMatch[1], 10) : 0

  return row
}

// Weight-class sections (==...==) that hold champion lineage tables.
const WEIGHT_SECTIONS = [
  'Heavyweight', 'Bridgerweight', 'Cruiserweight', 'Light heavyweight',
  'Super middleweight', 'Middleweight', 'Super welterweight', 'Welterweight',
  'Super lightweight', 'Lightweight', 'Super featherweight', 'Featherweight',
  'Super bantamweight', 'Bantamweight', 'Super flyweight', 'Flyweight',
  'Light flyweight', 'Minimumweight',
]

export function parseWbaChampions(wikitext: string, now: Date = new Date()): WbaChampion[] {
  const champions: WbaChampion[] = []

  for (const weightClass of WEIGHT_SECTIONS) {
    const start = wikitext.indexOf(`==${weightClass}==`)
    if (start < 0) continue
    const after = wikitext.slice(start + `==${weightClass}==`.length)
    const nextSection = after.search(/\n==[^=]/)
    const section = nextSection >= 0 ? after.slice(0, nextSection) : after

    const tableRegex = /\{\|[^]*?\|}/g
    let m: RegExpExecArray | null

    while ((m = tableRegex.exec(section)) !== null) {
      const table = m[0]
      const before = section.slice(0, m.index)
      const lineageMatch = before.match(/=== ([^=]+?) ===/g)
      const lineage = lineageMatch && lineageMatch.length > 0
        ? lineageMatch[lineageMatch.length - 1].replace(/===\s*|\s*===/g, '')
        : 'Primary champion lineage'

      const rows = table.split(/\n\|-/).slice(1)
      for (const rowBlock of rows) {
        const cells = rowBlock.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') || l.startsWith('!'))
        const parsed = parseRow(cells)
        if (parsed.skip || !parsed.name) continue

        const parts = parsed.reign.split(/\s*[–-]\s*/)
        if (parts.length < 1) continue

        const isPresent = /present/i.test(parts[parts.length - 1])
        const endSide = isPresent ? undefined : parts[parts.length - 1]
        const endRaw = parseReignSide(endSide || 'present')
        const endParsed = endRaw === 'present' ? 'present' : endRaw

        const startYear = endRaw && endRaw !== 'present' ? endRaw.y : now.getUTCFullYear()
        const startRaw = parseReignSide(parts[0], startYear)
        if (!startRaw || startRaw === 'present') continue

        let endDate: Date | null = null
        if (endParsed && endParsed !== 'present') {
          const lastDay = daysInMonth(endParsed.y, endParsed.m)
          endDate = new Date(Date.UTC(endParsed.y, endParsed.m, endParsed.explicitDay ? endParsed.d : lastDay))
        } else if (endParsed === 'present') {
          endDate = null
        }

        const startDate = new Date(Date.UTC(startRaw.y, startRaw.m, startRaw.explicitDay ? startRaw.d : 1))
        if (endDate !== null && endDate.getTime() <= startDate.getTime()) continue

        const reignDays = endDate
          ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
          : Math.max(0, Math.round((now.getTime() - startDate.getTime()) / 86400000))

        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(parsed.name.replace(/ \(2\)| \(3\)/g, '').replace(/ /g, '_'))}`

        champions.push({
          name: parsed.name,
          weightClass,
          status: parsed.status,
          lineage: lineage.replace(/ Lineage/i, ''),
          reignStart: toIso(startDate),
          reignEnd: endDate ? toIso(endDate) : undefined,
          reigning: endDate === null,
          reignDays,
          reignLabel: parsed.reign,
          defenses: parsed.defenses,
          wikipediaUrl: url,
        })
      }
    }
  }

  return champions.sort((a, b) => b.reignDays - a.reignDays || a.name.localeCompare(b.name))
}

export async function fetchWbaChampions(): Promise<WbaChampion[]> {
  const params = new URLSearchParams({
    action: 'parse',
    page: 'List_of_WBA_world_champions',
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })

  const url = `${API_URL}?${params.toString()}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return []

  const data = await res.json() as { parse?: { wikitext?: unknown } }
  const wikitext = data?.parse?.wikitext
  if (typeof wikitext !== 'string') return []

  return parseWbaChampions(wikitext)
}