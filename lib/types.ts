export type Gender = 'male' | 'female'

export interface BoxerRecord {
  name: string
  total: number
  wins: number
  kos: number
  losses: number
  draws: number
  nationality: string
  wikipediaUrl: string
  lastUpdated: string
  gender?: Gender
  weightClass?: string
  imageUrl?: string
  previousRank?: number
}

export interface RankingsData {
  lastUpdated: string
  fighters: BoxerRecord[]
  worst?: BoxerRecord[]
}

export interface WikipediaInfobox {
  total: number | null
  wins: number | null
  kos: number | null
  losses: number | null
  draws: number | null
  nationality: string
}

export interface UpcomingFightEntry {
  boxerName: string
  headline: string
  url: string
  source: string
  publishedAt: string
}

export interface UpcomingFightsData {
  lastUpdated: string
  fights: UpcomingFightEntry[]
}
