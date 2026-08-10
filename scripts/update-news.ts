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
  const limit = parseInt(process.env.FIGHTER_LIMIT || '', 10)
  const fighters = Number.isFinite(limit) && limit > 0 ? rankings.fighters.slice(0, limit) : rankings.fighters
  const rankedNames = new Set(fighters.map(f => f.name))
  console.log(`Checking news for ${rankedNames.size} ranked boxers...`)

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim()

  const queries: { q: string; fighter: string | null }[] = []
  if (fighters.length === rankings.fighters.length) queries.push({ q: 'boxing', fighter: null })
  for (const f of fighters) queries.push({ q: cleanName(f.name), fighter: f.name })

  const allArticles: { article: NewsArticle; fighter: string | null }[] = []
  let failures = 0
  for (const { q, fighter } of queries) {
    const params = new URLSearchParams({
      q,
      from,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '100',
      apiKey: NEWS_API_KEY,
    })
    try {
      const res = await fetch(`${API_URL}?${params}`)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 429) {
          console.warn('News API rate limited (429). Stopping early.')
          break
        }
        console.warn(`News API ${res.status} for query "${q}": ${body.slice(0, 120)}`)
        failures++
      } else {
        const data = await res.json() as { articles?: NewsArticle[] }
        for (const a of data.articles ?? []) {
          if (a.url) allArticles.push({ article: a, fighter })
        }
      }
    } catch (err) {
      console.warn(`News API request failed for "${q}": ${err}`)
      failures++
    }
    await new Promise(r => setTimeout(r, 1100))
  }

  if (allArticles.length === 0) {
    console.error('No articles fetched from News API. Leaving existing data untouched.')
    process.exit(1)
  }
  console.log(`Fetched ${allArticles.length} articles from ${queries.length} queries (${failures} failed)`)

  const fights: UpcomingFightEntry[] = []
  const seenArticle = new Set<string>()
  for (const { article, fighter } of allArticles) {
    const title = article.title || ''
    const desc = article.description || ''
    const haystack = `${title} ${desc}`.toLowerCase()
    let boxerName = fighter && haystack.includes(cleanName(fighter).toLowerCase()) ? fighter : ''
    if (!boxerName) {
      for (const name of rankedNames) {
        if (haystack.includes(cleanName(name).toLowerCase())) {
          boxerName = name
          break
        }
      }
    }
    if (!boxerName) continue
    if (seenArticle.has(article.url)) continue
    seenArticle.add(article.url)
    fights.push({
      boxerName,
      headline: title,
      url: article.url,
      source: article.source?.name || 'News',
      publishedAt: article.publishedAt,
    })
  }

  let existing: UpcomingFightEntry[] = []
  try {
    const old = JSON.parse(await fs.readFile(OUTFILE, 'utf8')) as { fights?: UpcomingFightEntry[] }
    existing = old.fights ?? []
  } catch {
    existing = []
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const seen = new Set<string>()
  const merged: UpcomingFightEntry[] = []
  for (const f of [...fights, ...existing]) {
    const key = f.url || (f.headline + f.source)
    if (seen.has(key)) continue
    if (f.publishedAt && f.publishedAt < cutoff) continue
    seen.add(key)
    merged.push(f)
  }
  merged.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))

  await fs.mkdir(DATA_DIR, { recursive: true })
  const out: UpcomingFightsData = {
    lastUpdated: new Date().toISOString(),
    fights: merged,
  }
  await fs.writeFile(OUTFILE, JSON.stringify(out, null, 2))

  console.log(`Found ${fights.length} new articles mentioning ranked boxers. Keeping ${merged.length} total (last 30 days).`)
  if (merged.length > 0) {
    const seenName = new Set<string>()
    for (const f of merged) {
      if (!seenName.has(f.boxerName)) {
        console.log(`  ${f.boxerName}: ${f.headline.slice(0, 80)}...`)
        seenName.add(f.boxerName)
      }
    }
  }
}

main().catch(err => {
  console.error('News update failed:', err)
  process.exit(1)
})
