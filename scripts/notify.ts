import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import nodemailer from 'nodemailer'
import type { BoxerRecord } from '../lib/types'
import { renderEmailHtml, type EmailSection } from './email-html'
import { orderMoves, rankMoves, type RankMove } from '../lib/rank-moves'

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'upcoming-fights.json')
const RANKINGS_FILE = path.join(process.cwd(), 'public', 'data', 'rankings.json')

interface ScheduledEntry {
  boxerName: string
  sport?: string
  headline: string
  url: string
  source: string
  publishedAt: string
  date: string
  granularity?: 'day' | 'month'
  matchup?: string
  opponent?: string
  confidence?: string
}

interface UpcomingLike {
  fights?: ScheduledEntry[]
}

interface RankingsLike {
  fighters?: BoxerRecord[]
  worst?: BoxerRecord[]
  thirdary?: BoxerRecord[]
}

function loadJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function gitShowHead<T>(filePath: string): T | null {
  try {
    const raw = execSync(`git show HEAD:${filePath}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function diffRankings(current: BoxerRecord[], previous: BoxerRecord[]): { added: BoxerRecord[]; removed: BoxerRecord[] } {
  const prevNames = new Set(previous.map(f => f.name))
  const curNames = new Set(current.map(f => f.name))
  const added = current.filter(f => !prevNames.has(f.name))
  const removed = previous.filter(f => !curNames.has(f.name))
  return { added, removed }
}


function fightKey(f: ScheduledEntry): string {
  return f.url || `${f.boxerName}|${f.date}|${(f.matchup || '').toLowerCase()}`
}

function dateText(date: string, granularity?: 'day' | 'month'): string {
  if (!date) return ''
  if (granularity === 'month' || /^\d{4}-\d{2}$/.test(date)) {
    const [y, m] = date.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return label
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00Z`)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }
  return date
}

async function main() {
  const from = process.env.NOTIFY_EMAIL_FROM
  const pass = process.env.NOTIFY_EMAIL_PASS
  const to = process.env.NOTIFY_EMAIL_TO

  if (!from || !pass || !to) {
    console.log('Missing NOTIFY_EMAIL_* env vars. Skipping notification.')
    return
  }

  const sections: EmailSection[] = []

  // 1. New scheduled fights only (day AND month) — bookings not present at git HEAD.
  const fights = (loadJsonSafe<UpcomingLike>(DATA_FILE)?.fights ?? []) as ScheduledEntry[]
  const previousFights = (gitShowHead<UpcomingLike>('public/data/upcoming-fights.json')?.fights ?? []) as ScheduledEntry[]
  const prevKeys = new Set(previousFights.map(fightKey))
  const newScheduled = [...fights.filter(f => !prevKeys.has(fightKey(f)))].sort((a, b) => a.date.localeCompare(b.date))

  if (newScheduled.length > 0) {
    const rows = newScheduled.map(f => {
      const label = f.opponent ? `${f.boxerName} vs ${f.opponent}` : f.boxerName
      const subtitle = f.matchup && label.includes(f.matchup) ? undefined : f.matchup
      return {
        label,
        text: (subtitle ? `${subtitle} · ` : '') + dateText(f.date, f.granularity),
        url: f.url,
        sub: f.source,
      }
    })

    // Dedupe: same booking announced in multiple articles (e.g. "vs Fundora" / "vs Sebastian Fundora").
    const seenRows = new Set<string>()
    const uniqueRows = rows.filter(r => {
      const opp = r.label.split(' vs ').pop()?.trim().toLowerCase().split(/\s+/).pop() || ''
      const key = `${r.label.split(' vs ')[0]}|${r.text}|${opp}`
      if (seenRows.has(key)) return false
      seenRows.add(key)
      return true
    })

    sections.push({
      heading: `New Scheduled Fights (${uniqueRows.length})`,
      rows: uniqueRows,
    })
  }

  // 2. Ranking changes — promotions and drops, then new and departed fighters
  const curRankings = loadJsonSafe<RankingsLike>(RANKINGS_FILE)
  const prevRankings = gitShowHead<RankingsLike>('public/data/rankings.json')
  let addedNames: BoxerRecord[] = []
  let removedNames: BoxerRecord[] = []
  const moves: RankMove[] = []

  if (curRankings && prevRankings) {
    const bestDiff = diffRankings(curRankings.fighters ?? [], prevRankings.fighters ?? [])
    const worstDiff = diffRankings(curRankings.worst ?? [], prevRankings.worst ?? [])
    const thirdDiff = diffRankings(curRankings.thirdary ?? [], prevRankings.thirdary ?? [])

    const allAdded = [...bestDiff.added, ...worstDiff.added, ...thirdDiff.added]
    const allRemoved = [...bestDiff.removed, ...worstDiff.removed, ...thirdDiff.removed]

    addedNames = [...new Map(allAdded.map(f => [f.name, f])).values()]
    removedNames = [...new Map(allRemoved.map(f => [f.name, f])).values()]

    // Boxing has no per-sport lists, so the three featured lists are the scope.
    const rankedLists: { key: 'fighters' | 'worst' | 'thirdary'; label: string }[] = [
      { key: 'fighters', label: 'Best' },
      { key: 'worst', label: 'Worst' },
      { key: 'thirdary', label: 'Thirdary' },
    ]
    for (const { key, label } of rankedLists) {
      moves.push(...rankMoves(curRankings[key] ?? [], prevRankings[key] ?? [], label))
    }

    if (moves.length > 0) {
      sections.push({
        heading: `Rank Changes (${moves.length})`,
        rows: orderMoves(moves).map(m => ({
          label: m.name,
          text: `${m.record} · ${m.delta < 0 ? 'up' : 'down'} ${Math.abs(m.delta)} to #${m.to}`,
          sub: m.list,
        })),
      })
    }

    if (addedNames.length > 0) {
      sections.push({
        heading: `New Fighters (${addedNames.length})`,
        rows: addedNames.map(f => ({
          label: f.name,
          text: `${f.wins}-${f.losses}-${f.draws}`,
        })),
      })
    }

    if (removedNames.length > 0) {
      sections.push({
        heading: `Gone but Not Forgotten (${removedNames.length})`,
        rows: removedNames.map(f => ({
          label: f.name,
          text: `${f.wins}-${f.losses}-${f.draws}`,
        })),
      })
    }
  }

  if (sections.length === 0) {
    console.log('No new scheduled fights or ranking changes. Skipping notification.')
    return
  }

  const subject = [
    newScheduled.length > 0 ? `${newScheduled.length} new scheduled fight${newScheduled.length === 1 ? '' : 's'}` : null,
    moves.length > 0 ? `${moves.length} rank change${moves.length === 1 ? '' : 's'}` : null,
    (curRankings && prevRankings && addedNames.length + removedNames.length > 0) ? 'rankings updated' : null,
  ].filter(Boolean).join(', ')

  const text = `Fight rankings update\n\n${sections
    .map(section => `${section.heading.toUpperCase()}\n${section.rows
      .map(row => `- ${row.label ? `${row.label}: ` : ''}${row.text}${row.url ? ` ${row.url}` : ''}`)
      .join('\n')}`)
    .join('\n\n')}`

  const html = renderEmailHtml('Boxing', sections)

  const transporter = nodemailer.createTransport({
    host: process.env.NOTIFY_EMAIL_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: from, pass },
  })

  await transporter.sendMail({ from, to, subject, text, html })
  console.log(`Sent notification to ${to}: ${subject}`)
}

main().catch(err => {
  console.error('Notification failed:', err)
  process.exit(1)
})