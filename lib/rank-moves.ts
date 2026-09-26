/**
 * Rank movement between two runs of a ranked list, for the nightly email.
 *
 * The tricky part is that a ranking is relative. When a newcomer is inserted at
 * #1, every fighter below them is pushed down a place without having done
 * anything at all, so a naive position diff reports the entire list as having
 * dropped. To keep the email useful we only report a fighter who was already
 * ranked in both runs, whose own record changed, and whose position moved —
 * movement they earned rather than movement they absorbed.
 */

/** Structural subset of BoxerRecord, so this stays independent of the app types. */
export interface RankedRecord {
  name: string
  wins: number
  losses: number
  draws: number
}

export interface RankMove {
  name: string
  /** 1-based position in the previous run. */
  from: number
  /** 1-based position in the current run. */
  to: number
  /** Signed distance: negative moved up, positive moved down. */
  delta: number
  record: string
  /** Which ranked list this movement happened in. */
  list: string
}

export function recordOf(f: RankedRecord): string {
  return `${f.wins}-${f.losses}-${f.draws}`
}

export function rankMoves(current: RankedRecord[], previous: RankedRecord[], list: string): RankMove[] {
  const previousRankByName = new Map(previous.map((f, i) => [f.name, i + 1]))
  const moves: RankMove[] = []

  current.forEach((f, i) => {
    const from = previousRankByName.get(f.name)
    // Not ranked in this list before: that's a debut or a transfer, not a move.
    if (from === undefined) return

    const to = i + 1
    if (to === from) return // same position
    // Record untouched, so the shift came from other fighters entering or
    // leaving above them. Reporting it would bury the real movers.
    if (recordOf(f) === recordOf(previous[from - 1])) return

    moves.push({ name: f.name, from, to, delta: to - from, record: recordOf(f), list })
  })

  return moves
}

/** Promotions first (best new position), then drops (worst new position). */
export function orderMoves(moves: RankMove[]): RankMove[] {
  const promoted = moves.filter(m => m.delta < 0).sort((a, b) => a.to - b.to)
  const dropped = moves.filter(m => m.delta > 0).sort((a, b) => b.to - a.to)
  return [...promoted, ...dropped]
}
