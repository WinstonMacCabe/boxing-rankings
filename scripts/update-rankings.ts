import { getAllBoxerPages } from '../lib/categories'
import { fetchBoxerRecords } from '../lib/wikipedia'
import type { BoxerStats } from '../lib/wikipedia'
import { readRankings, writeRankings } from '../lib/storage'
import type { BoxerRecord, Gender } from '../lib/types'

const BATCH_SIZE = 50
const BATCH_DELAY = 100

// Minimum thirdary score (wins/losses, or wins if undefeated) for inclusion.
const BOXING_MIN_SCORE = 19.05

// Boxing records for fighters discovered via the MMA/sport crawl (mma-rankings).
// Falls back to the committed GitHub copy if the deployed site is stale/unavailable.
const MMA_BOXING_RECORDS_SOURCES = [
  'https://mmapugilism.vercel.app/data/boxing-records.json',
  'https://raw.githubusercontent.com/WinstonMacCabe/mma-rankings/main/public/data/boxing-records.json',
]

interface MmaBoxingRecord {
  wins: number
  kos: number
  losses: number
  draws: number
  noContests: number
  total: number
  nationality?: string
  weightClass?: string
  imageUrl?: string
  birthDate?: string
  gender?: Gender
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMmaBoxingRecords(): Promise<Map<string, MmaBoxingRecord>> {
  for (const url of MMA_BOXING_RECORDS_SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) {
        console.warn(`Boxing records source ${url} returned ${res.status}`)
        continue
      }
      const data = await res.json() as { records?: Record<string, MmaBoxingRecord> }
      if (!data?.records) {
        console.warn(`Boxing records source ${url} had no records field`)
        continue
      }
      const map = new Map<string, MmaBoxingRecord>()
      for (const [name, rec] of Object.entries(data.records)) {
        if (rec && typeof rec.wins === 'number' && typeof rec.losses === 'number') map.set(name, rec)
      }
      console.log(`Fetched ${map.size} MMA/sport boxing records from ${url}`)
      return map
    } catch (err) {
      console.warn(`Failed to fetch boxing records from ${url}:`, err)
    }
  }
  console.warn('No MMA boxing-records source available; continuing without MMA/sport boxers.')
  return new Map()
}

async function main() {
  console.log('Starting boxer rankings update...')
  console.log('Step 1: Discovering boxers from Wikipedia categories...')

  const startTime = Date.now()
  const pageMap = await getAllBoxerPages()
  const pageNames = Array.from(pageMap.keys())
  console.log(`Found ${pageMap.size} boxer pages in ${(Date.now() - startTime) / 1000}s`)

  if (pageMap.size === 0) {
    console.log('No boxers found. Exiting.')
    return
  }

  // Read previous rankings for frozen (archived + WBA champions) lists
  const previous = await readRankings()

  console.log(`\nStep 2: Fetching records for all ${pageMap.size} boxers...`)

  const allRecords = new Map<string, BoxerStats>()
  let processed = 0
  const total = pageNames.length

  for (let i = 0; i < pageNames.length; i += BATCH_SIZE) {
    const batch = pageNames.slice(i, i + BATCH_SIZE)
    const results = await fetchBoxerRecords(batch)

    for (const [name, record] of results) {
      processed++
      if (processed % 200 === 0 || processed === total) {
        process.stdout.write(`\r  Progress: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`)
      }

      if (!record) continue
      if (record.total === null || record.wins === null) continue

      allRecords.set(name, record)
    }

    await delay(BATCH_DELAY)
  }

  // Merge boxing records from the MMA/sport crawl for fighters not discovered via
  // boxing categories. Skipped names keep the boxing site's own parse, so existing
  // boxing rankings are unchanged. Merged fighters follow the same rules as everyone
  // else (Best requires the win/loss ratio threshold, Worst requires losses).
  const mmaBoxingRecords = await fetchMmaBoxingRecords()
  let injectedBoxers = 0
  for (const [name, rec] of mmaBoxingRecords) {
    if (allRecords.has(name)) continue
    allRecords.set(name, {
      total: rec.total ?? rec.wins + rec.losses + (rec.draws ?? 0) + (rec.noContests ?? 0),
      wins: rec.wins,
      kos: rec.kos ?? 0,
      losses: rec.losses,
      draws: rec.draws ?? 0,
      nationality: rec.nationality || '',
      weightClass: rec.weightClass || '',
      imageUrl: rec.imageUrl || '',
      birthDate: rec.birthDate || '',
      qualityWins: 0,
    })
    pageMap.set(name, rec.gender ?? 'male')
    injectedBoxers++
  }
  if (injectedBoxers > 0) {
    console.log(`Merged ${injectedBoxers} MMA/sport fighters with boxing records.`)
  }

  const now = new Date()

  // Thirdary ranking: score = wins / max(losses, 1). Undefeated = wins.
  // Exclude fighters with >384 wins. Tiebreaker: most KOs.
  // 50 non-seniors + all seniors above 50th non-senior
  const allThirdary: BoxerRecord[] = []
  for (const [name, record] of allRecords) {
    if (record.wins === 0 || (record.wins ?? 0) > 384) continue

    const wins = record.wins!
    const losses = record.losses ?? 0
    const total = record.total!
    const thirdaryScore = losses === 0 ? wins : wins / losses

    let age: number | null = null
    if (record.birthDate) {
      const parts = record.birthDate.split('-')
      const birthYear = parseInt(parts[0], 10)
      if (parts.length === 3) {
        const birthMonth = parseInt(parts[1], 10)
        const birthDay = parseInt(parts[2], 10)
        const birthdayThisYear = new Date(now.getFullYear(), birthMonth - 1, birthDay)
        age = now >= birthdayThisYear ? now.getFullYear() - birthYear : now.getFullYear() - birthYear - 1
      } else {
        age = now.getFullYear() - birthYear
      }
    }
    const isSenior = age !== null && age >= 50

    allThirdary.push({
      name,
      total,
      wins,
      kos: record.kos ?? 0,
      losses,
      draws: record.draws,
      nationality: record.nationality,
      weightClass: record.weightClass || undefined,
      imageUrl: record.imageUrl || undefined,
      gender: pageMap.get(name),
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
      lastUpdated: new Date().toISOString(),
      thirdaryScore,
      birthDate: record.birthDate || undefined,
      isSenior,
    })
  }

  const allThirdaryScored = allThirdary
    .filter(f => f.imageUrl && (f.thirdaryScore ?? 0) >= BOXING_MIN_SCORE)
    .sort((a, b) =>
      (b.thirdaryScore ?? 0) - (a.thirdaryScore ?? 0) ||
      a.losses - b.losses ||
      (b.kos ?? 0) - (a.kos ?? 0)
    )
  // No fighter cap — BOXING_MIN_SCORE filter determines inclusion
  const thirdaryRanked: BoxerRecord[] = allThirdaryScored

  const thirdEligibleWorst = allThirdary
    .filter(f => f.imageUrl && (f.thirdaryScore ?? 0) > 0 && !f.isSenior)
    .sort((a, b) => (a.thirdaryScore ?? 0) - (b.thirdaryScore ?? 0) || b.losses - a.losses || (a.kos ?? 0) - (b.kos ?? 0))
  const thirdSeniorsWorst = allThirdary
    .filter(f => f.imageUrl && (f.thirdaryScore ?? 0) > 0 && f.isSenior)
    .sort((a, b) => (a.thirdaryScore ?? 0) - (b.thirdaryScore ?? 0) || b.losses - a.losses || (a.kos ?? 0) - (b.kos ?? 0))
  const thirdaryWorstRanked = [...thirdEligibleWorst.slice(0, 50), ...thirdSeniorsWorst]

  // Archived rankings (best + worst) are frozen — preserved from previous run
  const archivedBest = previous.fighters
  const archivedWorst = previous.worst ?? []
  // WBA champions view is static — preserved from previous run
  const wbaChampions = previous.wbaChampions ?? []

  await writeRankings(archivedBest, archivedWorst, thirdaryRanked, thirdaryWorstRanked, wbaChampions)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone! ${archivedBest.length} archived best, ${archivedWorst.length} archived worst, ${thirdaryRanked.length} thirdary, ${thirdaryWorstRanked.length} thirdary worst boxers ranked.`)
  console.log(`Total time: ${elapsed}s`)
  if (thirdaryRanked.length > 0) {
    console.log(`Top 10 thirdary: ${thirdaryRanked.slice(0, 10).map(f => `${f.name} (${f.wins}-${f.losses}-${f.draws}) [${(f.thirdaryScore ?? 0).toFixed(2)}]`).join(', ')}`)
  }
}

main().catch(err => {
  console.error('Update failed:', err)
  process.exit(1)
})
