import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'
import nodemailer from 'nodemailer'

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'upcoming-fights.json')

interface UpcomingFightEntry {
  boxerName: string
  headline: string
  url: string
  source: string
  publishedAt: string
}

async function main() {
  let fights: UpcomingFightEntry[] = []
  try {
    const cur = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
    fights = cur.fights ?? []
  } catch {
    console.log('No upcoming-fights.json found. Skipping notification.')
    return
  }

  let previous: UpcomingFightEntry[] = []
  try {
    const prevRaw = execSync('git show HEAD:public/data/upcoming-fights.json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    previous = (JSON.parse(prevRaw).fights ?? []) as UpcomingFightEntry[]
  } catch {
    previous = []
  }

  const prevUrls = new Set(previous.map(f => f.url))
  const newFights = fights.filter(f => !prevUrls.has(f.url))

  if (newFights.length === 0) {
    console.log('No new fight news. Skipping notification.')
    return
  }

  const from = process.env.NOTIFY_EMAIL_FROM
  const pass = process.env.NOTIFY_EMAIL_PASS
  const to = process.env.NOTIFY_EMAIL_TO

  if (!from || !pass || !to) {
    console.log('Missing NOTIFY_EMAIL_* env vars. Skipping notification.')
    return
  }

  const lines = newFights.map(f => {
    const date = f.publishedAt ? new Date(f.publishedAt).toLocaleDateString() : '?'
    return `- ${f.headline} [${f.source}, ${date}] ${f.url}`
  })
  const text = `New fight news for ranked boxers:\n\n${lines.join('\n')}`

  const transporter = nodemailer.createTransport({
    host: process.env.NOTIFY_EMAIL_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: from, pass },
  })

  await transporter.sendMail({
    from,
    to,
    subject: `Fight news (${newFights.length})`,
    text,
  })

  console.log(`Sent notification for ${newFights.length} new article(s) to ${to}`)
}

main().catch(err => {
  console.error('Notification failed:', err)
  process.exit(1)
})
