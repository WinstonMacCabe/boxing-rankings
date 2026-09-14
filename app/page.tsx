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
    <span className="flex flex-col items-center">
      <span className="text-[24px] leading-none tracking-[0.04em] text-[#1d1d1f]">{value}</span>
      <span className="mt-1.5 text-[12px] tracking-[0.15em] text-[#86868b]">{label}</span>
    </span>
  )
}

function StatDivider() {
  return <span className="h-10 w-px self-center bg-black/15" />
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
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-md border border-black/80 bg-white transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
        onClick={() => window.open(fighter.wikipediaUrl, '_blank')}
      >
        {/* Photo — uniform 3:4, identical across all cards */}
        <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', background: '#ffffff' }}>
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
                <div className="flex h-full items-center justify-center bg-white">
                  <span className="text-[40px] tracking-[0.1em] text-black/20">{getInitials(fighter.name)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-white">
              <span className="text-[40px] tracking-[0.1em] text-black/20">{getInitials(fighter.name)}</span>
            </div>
          )}
        </div>

        {/* Info — centered */}
        <div className="flex w-full flex-1 flex-col items-center px-4 pb-5 pt-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[34px] leading-none tracking-[0.04em] text-[#1d1d1f]">
              {rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `#${rank}`}
            </span>
          </div>
          {rankChange > 0 && (
            <span className="mt-1.5 text-[16px] text-[#1d7d33]">▲ {rankChange}</span>
          )}
          {rankChange < 0 && (
            <span className="mt-1.5 text-[16px] text-[#c22d2d]">▼ {-rankChange}</span>
          )}

          <h2 className="mt-2.5 text-[22px] leading-snug tracking-[0.05em] text-[#1d1d1f]">{displayName}</h2>
          <p className="mt-1 min-h-[18px] text-[13px] tracking-[0.15em] text-[#86868b]">
            {fighter.weightClass || ''}
          </p>

          <div className="mt-4 flex items-center justify-center gap-5">
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

          <div className="mt-auto flex min-h-[48px] items-center justify-center gap-3 pt-4">
            {flag && <span className="text-[40px] leading-none">{flag}</span>}
            <span className="text-[15px] tracking-[0.05em] text-[#6e6e73]">{fighter.nationality || ''}</span>
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
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-md border border-black/80 bg-white transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
        onClick={() => window.open(champion.wikipediaUrl, '_blank')}
      >
        <div className="relative flex flex-col items-center justify-center px-4 pb-4 pt-8 text-center">
          {champion.reigning && (
            <div className="absolute left-3 top-3 bg-black px-3 py-1 text-[12px] tracking-[0.15em] text-white">
              Reigning
            </div>
          )}
          {isSecondary && (
            <div className="absolute right-3 top-3 border border-black bg-white px-3 py-1 text-[12px] tracking-[0.15em] text-black">
              Secondary
            </div>
          )}
          <span className="text-[38px] leading-none tracking-[0.04em] text-[#1d1d1f]">
            {formatReign(champion.reignDays)}
          </span>
          <span className="mt-2 text-[14px] tracking-[0.08em] text-[#6e6e73]">{champion.reignLabel}</span>
        </div>

        <div className="flex items-center justify-center gap-2.5 px-4 pt-4">
          <span className="text-[24px] leading-none tracking-[0.04em] text-[#1d1d1f]">
            {rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `#${rank}`}
          </span>
        </div>
        <div className="flex items-center justify-center px-4 pt-1.5">
          <span className="text-[13px] tracking-[0.15em] text-[#86868b]">Longest Reign</span>
        </div>

        <div className="flex w-full flex-1 flex-col items-center px-4 pb-5 pt-2 text-center">
          <h2 className="mt-1 text-[22px] leading-snug tracking-[0.05em] text-[#1d1d1f]">{champion.name}</h2>

          {champion.status && (
            <p className="mt-1 text-[13px] tracking-[0.15em] text-[#86868b]">{champion.status}</p>
          )}

          <div className="mt-4 flex items-center justify-center gap-5">
            <span className="flex min-w-0 flex-col items-center">
              <span className="text-[18px] leading-none tracking-[0.04em] text-[#1d1d1f]">{champion.weightClass}</span>
              <span className="mt-1.5 text-[12px] tracking-[0.15em] text-[#86868b]">{champion.lineage}</span>
            </span>
            <StatDivider />
            <Stat value={String(champion.defenses)} label="Defenses" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DropdownHeading({ children }: { children: React.ReactNode }) {
  return <p className="px-5 pb-1 pt-3 text-[13px] tracking-[0.22em] text-black/40">{children}</p>
}

function DropdownItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-5 py-[7px] text-left text-[17px] tracking-[0.04em] transition-colors hover:bg-black hover:text-white ${active ? 'underline decoration-2 underline-offset-4' : 'text-[#1d1d1f]'}`}
    >
      {children}
    </button>
  )
}

export default function Home() {
  const [data, setData] = useState<RankingsData | null>(null)
  const [upcomingFights, setUpcomingFights] = useState<UpcomingFightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'wins' | 'kos' | 'weight'>('wins')
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all')
  const [viewMode, setViewMode] = useState<'best' | 'worst' | 'archivedBest' | 'archivedWorst' | 'champions'>('best')
  const [headerBlur, setHeaderBlur] = useState(false)
  const [newsExpanded, setNewsExpanded] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
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
    setGenderFilter('all')
    setFilterOpen(false)
  }

  const source = viewMode === 'best' ? (data?.thirdary ?? []) : viewMode === 'worst' ? (data?.thirdaryWorst ?? []) : viewMode === 'archivedBest' ? (data?.fighters ?? []) : (data?.worst ?? [])
  const preFiltered = source
    .filter(f => genderFilter === 'all' || f.gender === genderFilter)
    .filter(f => cleanName(f.name).toLowerCase().includes(search.toLowerCase()))
  const filtered = preFiltered
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

  const rankLabel = isChampions
    ? 'Champions'
    : isArchived
      ? 'Archived'
      : viewMode === 'worst'
        ? 'Worst'
        : 'Best'

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-black/20 border-t-black" />
        <p className="mt-5 text-xl tracking-[0.1em] text-[#6e6e73]">Loading</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-xl tracking-[0.1em] text-[#6e6e73]">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
        style={{
          background: headerBlur ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <nav className="flex items-center gap-3">
            <a href="https://boxingpugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] tracking-[0.05em] text-[#1d1d1f] underline decoration-2 underline-offset-8">Boxing</a>
            <a href="https://mmapugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] tracking-[0.05em] text-black/40 transition-colors hover:text-[#1d1d1f]">MMA</a>
            <a href="https://generalspugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[17px] tracking-[0.05em] text-black/40 transition-colors hover:text-[#1d1d1f]">Generals</a>
          </nav>

          <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-[30px] tracking-[0.08em] text-[#1d1d1f] sm:block">
            Winston&apos;s Rankings
          </div>

          <div ref={controlsRef} className="relative flex items-center gap-2">
            <button
              onClick={() => { setFilterOpen(!filterOpen); setSearchOpen(false) }}
              className="flex items-center gap-2 rounded-sm border border-black/80 px-3.5 py-2 text-[17px] tracking-[0.05em] text-[#1d1d1f] transition-colors hover:bg-black hover:text-white"
            >
              {rankLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <button
              onClick={() => { setSearchOpen(!searchOpen); setFilterOpen(false) }}
              className="flex h-[37px] w-[37px] items-center justify-center rounded-sm border border-black/80 text-[#1d1d1f] transition-colors hover:bg-black hover:text-white"
              aria-label="Search"
              title="Search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5L21 21" />
              </svg>
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[230px] border border-black bg-white py-2 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
                <DropdownHeading>Rank</DropdownHeading>
                <DropdownItem active={viewMode === 'best'} onClick={() => switchView('best')}>Best</DropdownItem>
                <DropdownItem active={viewMode === 'worst'} onClick={() => switchView('worst')}>Worst</DropdownItem>
                <DropdownItem active={isChampions} onClick={() => switchView('champions')}>Champions</DropdownItem>
                <DropdownItem active={isArchived} onClick={() => switchView(isArchived ? 'best' : 'archivedBest')}>Archived</DropdownItem>

                <DropdownHeading>Sort</DropdownHeading>
                <DropdownItem active={sortBy === 'wins'} onClick={() => { setSortBy('wins'); setFilterOpen(false) }}>Wins</DropdownItem>
                <DropdownItem active={sortBy === 'kos'} onClick={() => { setSortBy('kos'); setFilterOpen(false) }}>KO</DropdownItem>
                <DropdownItem active={sortBy === 'weight'} onClick={() => { setSortBy('weight'); setFilterOpen(false) }}>Weight</DropdownItem>

                {!isChampions && (
                  <>
                    <DropdownHeading>Division</DropdownHeading>
                    <DropdownItem active={genderFilter === 'all'} onClick={() => { setGenderFilter('all'); setFilterOpen(false) }}>All</DropdownItem>
                    <DropdownItem active={genderFilter === 'male'} onClick={() => { setGenderFilter('male'); setFilterOpen(false) }}>Male</DropdownItem>
                    <DropdownItem active={genderFilter === 'female'} onClick={() => { setGenderFilter('female'); setFilterOpen(false) }}>Female</DropdownItem>
                  </>
                )}
              </div>
            )}

            {searchOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 border border-black bg-white px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search names..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent text-[26px] tracking-[0.06em] text-[#1d1d1f] outline-none placeholder:text-black/30"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="pb-12 pt-28">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 pt-6 text-center">
            <h1 className="text-[64px] leading-[1.02] tracking-[0.06em] text-[#1d1d1f]">Boxing</h1>
          </div>

          {uniqueFights.length > 0 && (
            <div className="mb-4 px-6">
              <button
                onClick={() => setNewsExpanded(!newsExpanded)}
                className="flex w-full cursor-pointer items-center justify-center gap-3 py-2 text-center"
              >
                <span className="text-[22px] tracking-[0.08em] text-[#1d1d1f]">Fight News</span>
                <span className="text-[16px] tracking-[0.1em] text-black/40">{uniqueFights.length}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className={`text-black/60 transition-transform duration-200 ${newsExpanded ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {newsExpanded && (
                <div className="mx-auto flex max-w-4xl flex-col gap-3 py-4 text-center">
                  {uniqueFights.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="group block text-[18px] leading-snug tracking-[0.04em] text-[#1d1d1f]">
                      {f.headline}
                      <span className="mt-0.5 block text-[13px] tracking-[0.1em] text-[#86868b]">
                        {f.publishedAt ? new Date(f.publishedAt).toLocaleDateString() + ' · ' : ''}
                        {f.source}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {isChampions ? (
            <>
              <p className="mb-6 text-center text-[16px] tracking-[0.1em] text-[#6e6e73]">
                WBA World Champions · all weight classes · ranked by longest reign
              </p>
              <div className="grid items-stretch gap-4 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {filteredChampions.map((champion, i) => (
                  <ChampionCard key={champion.name + champion.reignStart} champion={champion} rank={i + 1} />
                ))}
              </div>
              {filteredChampions.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-xl tracking-[0.1em] text-[#86868b]">No champions match your search.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid items-stretch gap-4 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {filtered.map((fighter, i) => (
                  <FighterCard key={fighter.name} fighter={fighter} rank={i + 1} isWorst={viewMode === 'worst' || viewMode === 'archivedWorst'} isBest={viewMode === 'best' || viewMode === 'archivedBest'} />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-xl tracking-[0.1em] text-[#86868b]">No fighters match your search.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}