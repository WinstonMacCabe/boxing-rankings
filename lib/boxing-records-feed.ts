import type { Gender } from './types'

// Boxing records for fighters discovered via the MMA/sport crawl (mma-rankings).
// Falls back to the committed GitHub copy if the deployed site is stale/unavailable.
export const MMA_BOXING_RECORDS_SOURCES = [
  'https://mmapugilism.vercel.app/data/boxing-records.json',
  'https://raw.githubusercontent.com/WinstonMacCabe/mma-rankings/main/public/data/boxing-records.json',
]

export interface MmaBoxingRecord {
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

// Read the boxing records the mma-rankings crawl publishes for fighters this
// site's own boxing-category crawl cannot reach.
//
// Every source is queried rather than stopping at the first success: one of
// them can answer 200 with a shrunken record set (a partial MMA crawl used to
// publish 268 records instead of 531, which dropped 20 fighters from the
// rankings outright). Taking the largest feed means a truncated response is
// ignored whenever any other source still has the full set.
export async function fetchMmaBoxingRecords(
  sources: string[] = MMA_BOXING_RECORDS_SOURCES,
): Promise<Map<string, MmaBoxingRecord>> {
  const fetched: { url: string; map: Map<string, MmaBoxingRecord> }[] = []

  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) {
        console.warn(`Boxing records source ${url} returned ${res.status}`)
        continue
      }
      const data = (await res.json()) as { records?: Record<string, MmaBoxingRecord> }
      if (!data?.records) {
        console.warn(`Boxing records source ${url} had no records field`)
        continue
      }
      const map = new Map<string, MmaBoxingRecord>()
      for (const [name, rec] of Object.entries(data.records)) {
        if (rec && typeof rec.wins === 'number' && typeof rec.losses === 'number') map.set(name, rec)
      }
      console.log(`Fetched ${map.size} MMA/sport boxing records from ${url}`)
      fetched.push({ url, map })
    } catch (err) {
      console.warn(`Failed to fetch boxing records from ${url}:`, err)
    }
  }

  if (fetched.length === 0) {
    console.warn('No MMA boxing-records source available; continuing without MMA/sport boxers.')
    return new Map()
  }

  fetched.sort((a, b) => b.map.size - a.map.size)
  const best = fetched[0]

  if (fetched.length > 1 && fetched[fetched.length - 1].map.size < best.map.size) {
    const smaller = fetched[fetched.length - 1]
    console.warn(
      `Boxing records sources disagree: ${best.url} has ${best.map.size} records but ` +
        `${smaller.url} has ${smaller.map.size}. Using the larger feed.`,
    )
  }

  return best.map
}
