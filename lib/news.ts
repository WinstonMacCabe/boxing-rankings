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
