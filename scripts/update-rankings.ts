import { getAllBoxerPages } from '../lib/categories'
import { fetchBoxerRecords } from '../lib/wikipedia'
import type { BoxerStats } from '../lib/wikipedia'
import { readRankings, writeRankings } from '../lib/storage'
import type { BoxerRecord, Gender } from '../lib/types'

const BATCH_SIZE = 50
const BATCH_DELAY = 100
const MIN_LOSSES_FOR_WORST = 10

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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

  // Read previous rankings for rank-change tracking
  // Only count fighters that would appear in the current filtered view
  const previous = await readRankings()
  const prevBestRank = new Map<string, number>()
  const prevWorstRank = new Map<string, number>()
  previous.fighters
    .filter(f => f.imageUrl)
    .forEach((f, i) => prevBestRank.set(f.name, i + 1))
  ;(previous.worst ?? [])
    .forEach((f, i) => prevWorstRank.set(f.name, i + 1))

  console.log(`\nStep 2: Fetching records for all ${pageMap.size} boxers...`)

  const undefeated: BoxerRecord[] = []
  const winless: BoxerRecord[] = []
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

      // Best: undefeated, >= 10 wins
      if (record.losses === 0 && record.wins >= 10) {
        undefeated.push({
          name,
          total: record.total,
          wins: record.wins,
          kos: record.kos ?? 0,
          losses: record.losses,
          draws: record.draws,
          nationality: record.nationality,
          weightClass: record.weightClass || undefined,
          imageUrl: record.imageUrl || undefined,
          gender: pageMap.get(name),
          wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
          lastUpdated: new Date().toISOString(),
        })
      }

      // Worst: winless, >= threshold losses
      if (record.wins === 0 && record.losses >= MIN_LOSSES_FOR_WORST) {
        winless.push({
          name,
          total: record.total,
          wins: record.wins,
          kos: record.kos ?? 0,
          losses: record.losses,
          draws: record.draws,
          nationality: record.nationality,
          weightClass: record.weightClass || undefined,
          imageUrl: record.imageUrl || undefined,
          gender: pageMap.get(name),
          wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
          lastUpdated: new Date().toISOString(),
        })
      }
    }

    await delay(BATCH_DELAY)
  }

  const ranked = undefeated
    .filter(f => f.imageUrl)
    .sort((a, b) => b.wins - a.wins || a.draws - b.draws || b.kos - a.kos || a.name.localeCompare(b.name))
    .map((f, i) => ({ ...f, previousRank: prevBestRank.get(f.name) || undefined }))

  const worstRanked = winless
    .sort((a, b) => b.losses - a.losses || a.draws - b.draws || a.name.localeCompare(b.name))
    .map((f, i) => ({ ...f, previousRank: prevWorstRank.get(f.name) || undefined }))

  await writeRankings(ranked, worstRanked)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone! ${ranked.length} undefeated, ${worstRanked.length} winless boxers ranked.`)
  console.log(`Total time: ${elapsed}s`)
  if (ranked.length > 0) {
    console.log(`Top 10 best: ${ranked.slice(0, 10).map(f => `${f.name} (${f.wins}-${f.losses}-${f.draws})`).join(', ')}`)
  }
  if (worstRanked.length > 0) {
    console.log(`Top 10 worst: ${worstRanked.slice(0, 10).map(f => `${f.name} (${f.wins}-${f.losses}-${f.draws})`).join(', ')}`)
  }
}

main().catch(err => {
  console.error('Update failed:', err)
  process.exit(1)
})
