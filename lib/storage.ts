import * as fs from 'fs/promises'
import * as path from 'path'
import type { RankingsData, BoxerRecord, UpcomingFightsData } from './types'

const DATA_DIR = path.join(process.cwd(), 'public', 'data')
const DATA_FILE = path.join(DATA_DIR, 'rankings.json')
const NEWS_FILE = path.join(DATA_DIR, 'upcoming-fights.json')

export async function readRankings(): Promise<RankingsData> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as RankingsData
  } catch {
    return { lastUpdated: '', fighters: [] }
  }
}

export async function writeRankings(fighters: BoxerRecord[], worst: BoxerRecord[] = []): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const data: RankingsData = {
    lastUpdated: new Date().toISOString(),
    fighters,
    worst: worst.length > 0 ? worst : undefined,
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readUpcomingFights(): Promise<UpcomingFightsData> {
  try {
    const raw = await fs.readFile(NEWS_FILE, 'utf-8')
    return JSON.parse(raw) as UpcomingFightsData
  } catch {
    return { lastUpdated: '', fights: [] }
  }
}
