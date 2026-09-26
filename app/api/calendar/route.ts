import * as fs from 'fs/promises'
import * as path from 'path'
import { NextResponse } from 'next/server'
import { buildEvents, summariseMonths, type RawFightEntry, type Confidence } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

const NEWS_FILE = path.join(process.cwd(), 'public', 'data', 'upcoming-fights.json')

// The sibling site's live feed. Both sites serve the same route, so the calendar
// shows an identical combined view no matter which one you land on.
const PEERS = ['https://boxingpugilism.vercel.app/api/news', 'https://mmapugilism.vercel.app/api/news']

async function loadLocal(): Promise<RawFightEntry[]> {
  try {
    const raw = await fs.readFile(NEWS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as { fights?: RawFightEntry[] }
    return parsed.fights ?? []
  } catch {
    return []
  }
}

async function loadRemote(url: string): Promise<{ rows: RawFightEntry[]; ok: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PugilismCalendar/1.0' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return { rows: [], ok: false }
    const parsed = (await res.json()) as { fights?: RawFightEntry[] }
    return { rows: parsed.fights ?? [], ok: true }
  } catch {
    return { rows: [], ok: false }
  }
}

export async function GET() {
  const [local, ...remotes] = await Promise.all([loadLocal(), ...PEERS.map(loadRemote)])

  const raw = [...local, ...remotes.flatMap(r => r.rows)]
  const events = buildEvents(raw)
  const months = summariseMonths(events)

  const byConfidence: Record<Confidence, number> = { high: 0, medium: 0, low: 0 }
  for (const e of events) byConfidence[e.confidence]++

  return NextResponse.json({
    events,
    months,
    stats: {
      rawRows: raw.length,
      events: events.length,
      collapsed: raw.length - events.length,
      byConfidence,
      undated: events.filter(e => !e.dayKnown).length,
      sourcesOnline: remotes.filter(r => r.ok).length,
      sourcesTotal: PEERS.length,
    },
  })
}
