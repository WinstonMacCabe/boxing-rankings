import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'
import nodemailer from 'nodemailer'
import type { BoxerRecord } from '../lib/types'

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'upcoming-fights.json')
const RANKINGS_FILE = path.join(process.cwd(), 'public', 'data', 'rankings.json')

interface UpcomingFightEntry {
  boxerName: string
  headline: string
  url: string
  source: string
  publishedAt: string
}

function loadJsonSafe(filePath: string): any {
  try {
    return JSON.parse(require('fs').readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function gitShowHead(filePath: string): any {
  try {
    const raw = execSync(`git show HEAD:${filePath}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw)
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

async function main() {
  const from = process.env.NOTIFY_EMAIL_FROM
  const pass = process.env.NOTIFY_EMAIL_PASS
  const to = process.env.NOTIFY_EMAIL_TO

  if (!from || !pass || !to) {
    console.log('Missing NOTIFY_EMAIL_* env vars. Skipping notification.')
    return
  }

  const sections: string[] = []

  // 1. Fight news
  const fights = (loadJsonSafe(DATA_FILE)?.fights ?? []) as UpcomingFightEntry[]
  const previousFights = (gitShowHead('public/data/upcoming-fights.json')?.fights ?? []) as UpcomingFightEntry[]

  const prevUrls = new Set(previousFights.map(f => f.url))
  const newFights = fights.filter(f => !prevUrls.has(f.url))

  if (newFights.length > 0) {
    const lines = newFights.map(f => {
      const date = f.publishedAt ? new Date(f.publishedAt).toLocaleDateString() : '?'
      return `  - ${f.boxerName}: ${f.headline} [${f.source}, ${date}] ${f.url}`
    })
    sections.push(`New fight news (${newFights.length}):\n${lines.join('\n')}`)
  }

  // 2. Ranking changes — new and departed fighters
  const curRankings = loadJsonSafe(RANKINGS_FILE)
  const prevRankings = gitShowHead('public/data/rankings.json')

  if (curRankings && prevRankings) {
    const bestDiff = diffRankings(curRankings.fighters ?? [], prevRankings.fighters ?? [])
    const worstDiff = diffRankings(curRankings.worst ?? [], prevRankings.worst ?? [])
    const thirdDiff = diffRankings(curRankings.thirdary ?? [], prevRankings.thirdary ?? [])

    const allAdded = [...bestDiff.added, ...worstDiff.added, ...thirdDiff.added]
    const allRemoved = [...bestDiff.removed, ...worstDiff.removed, ...thirdDiff.removed]

    const addedNames = [...new Map(allAdded.map(f => [f.name, f])).values()]
    const removedNames = [...new Map(allRemoved.map(f => [f.name, f])).values()]

    if (addedNames.length > 0) {
      const lines = addedNames.map(f => `  - ${f.name} (${f.wins}-${f.losses}-${f.draws})`)
      sections.push(`New fighters (${addedNames.length}):\n${lines.join('\n')}`)
    }

    if (removedNames.length > 0) {
      const lines = removedNames.map(f => `  - ${f.name} (${f.wins}-${f.losses}-${f.draws})`)
      sections.push(`Gone but not forgotten (${removedNames.length}):\n${lines.join('\n')}`)
    }
  }

  if (sections.length === 0) {
    console.log('No new fights or ranking changes. Skipping notification.')
    return
  }

  const subject = [
    newFights.length > 0 ? `${newFights.length} new fight` : null,
    (curRankings && prevRankings) ? 'rankings updated' : null,
  ].filter(Boolean).join(', ')

  const text = `Fight rankings update\n\n${sections.join('\n\n')}`

  const transporter = nodemailer.createTransport({
    host: process.env.NOTIFY_EMAIL_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: from, pass },
  })

  await transporter.sendMail({ from, to, subject, text })
  console.log(`Sent notification to ${to}: ${subject}`)
}

main().catch(err => {
  console.error('Notification failed:', err)
  process.exit(1)
})