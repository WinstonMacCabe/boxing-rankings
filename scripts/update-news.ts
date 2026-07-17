import { readRankings } from '../lib/storage'
import * as fs from 'fs/promises'
import * as path from 'path'

const NEWS_API_KEY = process.env.NEWS_API_KEY
const API_URL = 'https://newsapi.org/v2/everything'
const DATA_DIR = path.join(process.cwd(), 'public', 'data')
const OUTFILE = path.join(DATA_DIR, 'upcoming-fights.json')

interface NewsArticle {
  title: string
  description: string | null
  url: string
  source: { name: string }
  publishedAt: string
}

interface UpcomingFightsData {
  lastUpdated: string
  fights: UpcomingFightEntry[]
}

export interface UpcomingFightEntry {
  boxerName: string
  headline: string
  url: string
  source: string
  publishedAt: string
}

async function main() {
  if (!NEWS_API_KEY) {
    console.log('No NEWS_API_KEY set. Writing empty upcoming-fights.json.')
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(OUTFILE, JSON.stringify({ lastUpdated: new Date().toISOString(), fights: [] }, null, 2))
    return
  }

  const rankings = await readRankings()
  const rankedNames = new Set<string>()
  for (const f of rankings.fighters) {
    if (f.imageUrl) rankedNames.add(f.name)
  }
  console.log(`Checking news for ${rankedNames.size} ranked boxers...`)

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const params = new URLSearchParams({
    q: 'boxing',
    from,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '100',
    apiKey: NEWS_API_KEY,
  })

  const res = await fetch(`${API_URL}?${params}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`News API error ${res.status}: ${body.slice(0, 200)}`)
    console.log('Writing empty upcoming-fights.json due to error.')
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(OUTFILE, JSON.stringify({ lastUpdated: new Date().toISOString(), fights: [] }, null, 2))
    return
  }

  const data = await res.json() as { articles?: NewsArticle[] }
  const articles = data.articles ?? []
  console.log(`Fetched ${articles.length} recent boxing articles from News API`)

  const fights: UpcomingFightEntry[] = []
  for (const article of articles) {
    const title = article.title || ''
    const desc = article.description || ''
    for (const name of rankedNames) {
      if (title.includes(name) || desc.includes(name)) {
        fights.push({
          boxerName: name,
          headline: title,
          url: article.url,
          source: article.source?.name || 'News',
          publishedAt: article.publishedAt,
        })
        break
      }
    }
  }

  await fs.mkdir(DATA_DIR, { recursive: true })
  const out: UpcomingFightsData = {
    lastUpdated: new Date().toISOString(),
    fights,
  }
  await fs.writeFile(OUTFILE, JSON.stringify(out, null, 2))

  console.log(`Found ${fights.length} articles mentioning ranked boxers.`)
  if (fights.length > 0) {
    const seen = new Set<string>()
    for (const f of fights) {
      if (!seen.has(f.boxerName)) {
        console.log(`  ${f.boxerName}: ${f.headline.slice(0, 80)}...`)
        seen.add(f.boxerName)
      }
    }
  }
}

main().catch(err => {
  console.error('News update failed:', err)
  process.exit(1)
})
