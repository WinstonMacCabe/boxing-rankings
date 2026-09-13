'use client'

import { useEffect, useState, useRef } from 'react'
import type { RankingsData, BoxerRecord, Gender, UpcomingFightsData, WbaChampion } from '@/lib/types'
import { getCountryFlag } from '@/lib/flags'

const WEIGHT_ORDER: Record<string, number> = {
  'minimumweight': 1, 'strawweight': 1, 'mini flyweight': 1,
  'light flyweight': 2, 'junior flyweight': 2,
  'flyweight': 3,
  'super flyweight': 4, 'junior bantamweight': 4,
  'bantamweight': 5,
  'super bantamweight': 6, 'junior featherweight': 6,
  'featherweight': 7,
  'super featherweight': 8, 'junior lightweight': 8,
  'lightweight': 9,
  'light welterweight': 10, 'junior welterweight': 10,
  'welterweight': 11,
  'light middleweight': 12, 'junior middleweight': 12,
  'middleweight': 13,
  'super middleweight': 14,
  'light heavyweight': 15,
  'cruiserweight': 16, 'junior heavyweight': 16, 'super cruiserweight': 16,
  'bridgerweight': 17,
  'heavyweight': 18,
}

function weightSortValue(wc?: string): number {
  if (!wc) return 999
  return WEIGHT_ORDER[wc.toLowerCase()] ?? 999
}

function cleanName(name: string): string {
  return name.replace(/\s*\(boxer\)$/, '')
}

function getInitials(name: string): string {
  return cleanName(name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[18px] font-semibold leading-none tabular-nums tracking-tight text-[#1d1d1f]">{value}</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#86868b]">{label}</span>
    </span>
  )
}

function StatDivider() {
  return <span className="h-8 w-px self-center bg-[#e8e8ed]" />
}

function SegmentBtn({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-full font-medium transition-all duration-200
        ${small ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px] leading-none'}
        ${active
          ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.16)]'
          : 'text-[#6e6e73] hover:text-[#1d1d1f]'}
      `}
    >
      {children}
    </button>
  )
}

function SegmentGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex flex-wrap items-center gap-1 rounded-full bg-[#f2f2f5] p-1 ${className ?? ''}`}>
      {children}
    </div>
  )
}

function FighterCard({ fighter, rank, isWorst, isBest }: { fighter: BoxerRecord; rank: number; isWorst?: boolean; isBest?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -60px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const displayName = cleanName(fighter.name)
  const koPct = fighter.wins > 0 ? ((fighter.kos / fighter.wins) * 100).toFixed(0) : '0'
  const flag = getCountryFlag(fighter.nationality)
  const hasImage = Boolean(fighter.imageUrl && !imgError)
  const rankChange = fighter.previousRank ? fighter.previousRank - rank : 0

  return (
    <div
      ref={cardRef}
      className={`
        h-full
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
      style={{ transitionDelay: `${Math.min(rank * 20, 200)}ms` }}
    >
      <div
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white transition-all duration-500 hover:-translate-y-0.5 hover:border-[#d2d2d7] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        onClick={() => window.open(fighter.wikipediaUrl, '_blank')}
      >
        {/* Photo */}
        <div className="relative w-full" style={{ aspectRatio: '3 / 4' }}>
          {hasImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fighter.imageUrl!}
                alt={displayName}
                className={`h-full w-full transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                style={{ objectFit: 'cover', objectPosition: 'center 25%' }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f7]">
                  <span className="text-[26px] font-semibold tracking-tight text-[#c7c7cc]">{getInitials(fighter.name)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f7]">
              <span className="text-[26px] font-semibold tracking-tight text-[#c7c7cc]">{getInitials(fighter.name)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[26px] font-semibold leading-none tracking-tight text-[#1d1d1f]">
              {rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `#${rank}`}
            </span>
            {rankChange > 0 && (
              <span className="text-[13px] font-semibold text-[#1d7d33]">▲ {rankChange}</span>
            )}
            {rankChange < 0 && (
              <span className="text-[13px] font-semibold text-[#c22d2d]">▼ {-rankChange}</span>
            )}
          </div>

          <h2 className="mt-2 text-[16px] font-semibold leading-[1.25] text-[#1d1d1f]">{displayName}</h2>
          <p className="mt-0.5 min-h-[15px] text-[11px] font-medium uppercase tracking-[0.06em] text-[#86868b]">
            {fighter.weightClass || ''}
          </p>

          <div className="mt-3 flex items-center gap-4">
            {isWorst ? (
              <>
                <Stat value={String(fighter.losses)} label="Losses" />
                <StatDivider />
                <Stat value={String(fighter.total)} label="Fights" />
              </>
            ) : isBest ? (
              <>
                <Stat value={`${fighter.wins}-${fighter.losses}`} label="W-L" />
                <StatDivider />
                <Stat value={String(fighter.kos)} label="KO" />
              </>
            ) : (
              <>
                <Stat value={String(fighter.kos)} label="KO" />
                <StatDivider />
                <Stat value={`${koPct}%`} label="KO %" />
              </>
            )}
          </div>

          <div className="mt-auto flex min-h-[26px] items-center gap-2 pt-3">
            {flag && <span className="text-base leading-none">{flag}</span>}
            <span className="text-[12px] font-medium text-[#6e6e73]">{fighter.nationality || ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatReign(days: number): string {
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const rem = days % 30
  if (years > 0) return `${years} yr${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mo` : ''}`
  if (months > 0) return `${months} mo${months > 1 ? 's' : ''}${rem > 0 ? ` ${rem} d` : ''}`
  return `${days} d`
}

function ChampionCard({ champion, rank }: { champion: WbaChampion; rank: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -60px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const isSecondary = champion.lineage.startsWith('Secondary')

  return (
    <div
      ref={cardRef}
      className={`
        h-full
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
      style={{ transitionDelay: `${Math.min(rank * 20, 200)}ms` }}
    >
      <div
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white transition-all duration-500 hover:-translate-y-0.5 hover:border-[#d2d2d7] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        onClick={() => window.open(champion.wikipediaUrl, '_blank')}
      >
        <div className="relative flex flex-col items-center justify-center bg-[#f5f5f7] px-4 pb-4 pt-7 text-center">
          {champion.reigning && (
            <div className="absolute left-3 top-3 rounded-full bg-[#1d7d33] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
              Reigning
            </div>
          )}
          {isSecondary && (
            <div className="absolute right-3 top-3 rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73]">
              Secondary
            </div>
          )}
          <span className="text-[30px] font-semibold leading-none tracking-tight text-[#1d1d1f]">
            {formatReign(champion.reignDays)}
          </span>
          <span className="mt-1.5 text-[13px] font-medium text-[#6e6e73]">{champion.reignLabel}</span>
        </div>

        <div className="flex items-center justify-center gap-2 px-4 pt-3">
          <span className="text-[18px] font-semibold leading-none tracking-tight text-[#1d1d1f]">
            {rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `#${rank}`}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#86868b]">Longest Reign</span>
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-2 text-center">
          <h2 className="mt-1 text-[16px] font-semibold leading-[1.25] text-[#1d1d1f]">{champion.name}</h2>

          {champion.status && (
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#86868b]">{champion.status}</p>
          )}

          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="flex min-w-0 flex-col items-center">
              <span className="text-[15px] font-semibold leading-none tracking-tight text-[#1d1d1f]">{champion.weightClass}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#86868b]">{champion.lineage}</span>
            </span>
            <StatDivider />
            <Stat value={String(champion.defenses)} label="Defenses" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState<RankingsData | null>(null)
  const [upcomingFights, setUpcomingFights] = useState<UpcomingFightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'wins' | 'kos' | 'weight'>('wins')
  const [weightFilter, setWeightFilter] = useState<string | null>(null)
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all')
  const [viewMode, setViewMode] = useState<'best' | 'worst' | 'archivedBest' | 'archivedWorst' | 'champions'>('best')
  const [headerBlur, setHeaderBlur] = useState(false)
  const [newsExpanded, setNewsExpanded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/refresh').then(r => r.json()),
      fetch('/api/news').then(r => r.json()).catch(() => ({ fights: [] })),
    ]).then(([rankings, news]: [RankingsData, UpcomingFightsData]) => {
      setData(rankings)
      setUpcomingFights(news)
      setLoading(false)
    }).catch(() => {
      setError('Failed to load rankings')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const onScroll = () => setHeaderBlur(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const uniqueFights: { headline: string; url: string; source: string; publishedAt: string }[] = []
  const seen = new Set<string>()
  if (upcomingFights) {
    for (const f of upcomingFights.fights) {
      const key = f.headline + f.source
      if (!seen.has(key)) {
        seen.add(key)
        uniqueFights.push({ headline: f.headline, url: f.url, source: f.source, publishedAt: f.publishedAt })
      }
    }
  }

  const isArchived = viewMode === 'archivedBest' || viewMode === 'archivedWorst'
  const isChampions = viewMode === 'champions'

  function switchView(mode: typeof viewMode) {
    setViewMode(mode)
    setSortBy('wins')
    setWeightFilter(null)
    setGenderFilter('all')
  }

  const source = viewMode === 'best' ? (data?.thirdary ?? []) : viewMode === 'worst' ? (data?.thirdaryWorst ?? []) : viewMode === 'archivedBest' ? (data?.fighters ?? []) : (data?.worst ?? [])
  const preFiltered = source
    .filter(f => genderFilter === 'all' || f.gender === genderFilter)
    .filter(f => cleanName(f.name).toLowerCase().includes(search.toLowerCase()))
  const availableWeightClasses = [...new Set(preFiltered.map(f => f.weightClass).filter((wc): wc is string => !!wc))].sort((a, b) => weightSortValue(a) - weightSortValue(b))
  const filtered = preFiltered
    .filter(f => !weightFilter || f.weightClass === weightFilter)
    .sort((a, b) => {
      if (viewMode === 'best') {
        if (sortBy === 'weight') return (weightSortValue(a.weightClass) - weightSortValue(b.weightClass)) || (b.thirdaryScore ?? 0) - (a.thirdaryScore ?? 0)
        if (sortBy === 'kos') return (b.kos ?? 0) - (a.kos ?? 0) || (b.thirdaryScore ?? 0) - (a.thirdaryScore ?? 0)
        return (b.thirdaryScore ?? 0) - (a.thirdaryScore ?? 0) || a.losses - b.losses || (b.kos ?? 0) - (a.kos ?? 0)
      }
      if (viewMode === 'worst') return (a.thirdaryScore ?? 0) - (b.thirdaryScore ?? 0) || b.losses - a.losses || (a.kos ?? 0) - (b.kos ?? 0)
      if (viewMode === 'archivedWorst') return b.losses - a.losses || a.draws - b.draws || a.name.localeCompare(b.name)
      if (sortBy === 'weight') return (weightSortValue(a.weightClass) - weightSortValue(b.weightClass)) || b.wins - a.wins
      if (sortBy === 'kos') return b.kos - a.kos || b.wins - a.wins
      return b.wins - a.wins || a.draws - b.draws || b.kos - a.kos || a.name.localeCompare(b.name)
    })
  const filteredChampions = (data?.wbaChampions ?? [])
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e8e8ed] border-t-[#1d1d1f]" />
        <p className="mt-4 text-sm font-medium text-[#86868b]">Loading</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#6e6e73]">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
        style={{
          background: headerBlur ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.65)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <nav className="flex items-center gap-1">
            <a href="https://boxingpugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f]">Boxing</a>
            <a href="https://mmapugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]">MMA</a>
            <a href="https://generalspugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]">Generals</a>
          </nav>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-40 rounded-full bg-[#f2f2f5] px-4 text-sm text-[#1d1d1f] outline-none transition-shadow placeholder:text-[#86868b] focus:ring-2 focus:ring-black/10"
          />
        </div>
      </header>

      <main className="pb-12 pt-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 pt-6 text-center">
            <h1 className="text-[42px] font-semibold leading-[1.05] tracking-tight text-[#1d1d1f]">Boxing</h1>
            <p className="mt-2 text-lg font-medium text-[#6e6e73]">Ranked by wins, sourced from Wikipedia.</p>
          </div>

          {uniqueFights.length > 0 && (
            <div className="mb-6 rounded-2xl border border-[#e8e8ed] bg-white px-4 py-2">
              <button
                onClick={() => setNewsExpanded(!newsExpanded)}
                className="flex w-full cursor-pointer items-center gap-2.5 py-2 text-left"
              >
                <span className="text-sm leading-none">🔔</span>
                <span className="text-sm font-semibold text-[#1d1d1f]">Fight News</span>
                <span className="ml-auto text-[11px] font-medium text-[#86868b]">{uniqueFights.length}</span>
                <span className={`text-[11px] text-[#86868b] transition-transform duration-200 ${newsExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {newsExpanded && (
                <div className="flex flex-col gap-2.5 border-t border-[#f0f0f2] py-3">
                  {uniqueFights.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="group block text-sm leading-snug text-[#1d1d1f]">
                      {f.headline}
                      <span className="mt-0.5 block text-[11px] font-medium text-[#86868b]">
                        {f.publishedAt ? new Date(f.publishedAt).toLocaleDateString() + ' · ' : ''}
                        {f.source}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main tabs */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SegmentGroup>
              {(['best', 'worst', 'champions'] as const).map(m => (
                <SegmentBtn key={m} active={viewMode === m} onClick={() => switchView(m)}>
                  {m === 'best' ? 'Best' : m === 'worst' ? 'Worst' : 'Champions'}
                </SegmentBtn>
              ))}
              <SegmentBtn active={isArchived} onClick={() => switchView(isArchived ? 'best' : 'archivedBest')}>
                Archived
              </SegmentBtn>
            </SegmentGroup>

            {isArchived && (
              <SegmentGroup>
                {(['archivedBest', 'archivedWorst'] as const).map(m => (
                  <SegmentBtn key={m} active={viewMode === m} onClick={() => switchView(m)}>
                    {m === 'archivedBest' ? 'Undefeated' : 'Winless'}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            )}
          </div>

          {/* Sort options */}
          {(viewMode === 'best' || viewMode === 'archivedBest') && (
            <div className="mb-3">
              <SegmentGroup>
                {(['wins', 'kos', 'weight'] as const).map(s => (
                  <SegmentBtn
                    key={s}
                    active={sortBy === s}
                    onClick={() => { setSortBy(s); if (s !== 'weight') setWeightFilter(null) }}
                  >
                    {s === 'wins' ? 'Wins' : s === 'kos' ? 'KO' : 'Weight'}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            </div>
          )}

          {/* Gender filter */}
          {!isChampions && (
            <div className="mb-3">
              <SegmentGroup>
                {(['all', 'male', 'female'] as const).map(g => (
                  <SegmentBtn key={g} active={genderFilter === g} onClick={() => setGenderFilter(g)}>
                    {g === 'all' ? 'All' : g === 'male' ? 'Male' : 'Female'}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            </div>
          )}

          {/* Weight class sub-filter */}
          {!isChampions && sortBy === 'weight' && availableWeightClasses.length > 0 && (
            <div className="mb-5">
              <SegmentGroup>
                <SegmentBtn small active={!weightFilter} onClick={() => setWeightFilter(null)}>All</SegmentBtn>
                {availableWeightClasses.map(wc => (
                  <SegmentBtn small key={wc} active={weightFilter === wc} onClick={() => setWeightFilter(weightFilter === wc ? null : wc)}>
                    {wc}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            </div>
          )}

          {isChampions ? (
            <>
              <div className="mb-5 rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="text-[13px] font-medium text-[#6e6e73]">
                  WBA World Champions · all weight classes · ranked by longest reign
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f5f5f7] p-4 sm:p-6">
                <div className="grid items-stretch gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {filteredChampions.map((champion, i) => (
                    <ChampionCard key={champion.name + champion.reignStart} champion={champion} rank={i + 1} />
                  ))}
                </div>
                {filteredChampions.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-lg font-medium text-[#86868b]">No champions match your search.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-[28px] bg-[#f5f5f7] p-4 sm:p-6">
              <div className="grid items-stretch gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {filtered.map((fighter, i) => (
                  <FighterCard key={fighter.name} fighter={fighter} rank={i + 1} isWorst={viewMode === 'worst' || viewMode === 'archivedWorst'} isBest={viewMode === 'best' || viewMode === 'archivedBest'} />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-lg font-medium text-[#86868b]">No fighters match your search.</p>
                </div>
              )}
            </div>
          )}

          <footer className="mb-4 mt-12 text-center">
            <p className="text-xs font-medium text-[#86868b]">Wikipedia · Updated daily</p>
          </footer>
        </div>
      </main>
    </div>
  )
}