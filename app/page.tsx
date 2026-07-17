'use client'

import { useEffect, useState, useRef } from 'react'
import type { RankingsData, BoxerRecord, Gender, UpcomingFightsData } from '@/lib/types'
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

const NOISE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.04"/>
  </svg>`
)}`

function FighterCard({ fighter, rank, isWorst }: { fighter: BoxerRecord; rank: number; isWorst?: boolean }) {
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
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        `}
        style={{ transitionDelay: `${Math.min(rank * 20, 200)}ms` }}
      >
      <div
        className="relative cursor-pointer hover:scale-[1.02] transition-transform duration-500 h-full flex flex-col"
        style={{
          background: '#ddd0b8',
          border: '1px solid #b8a890',
          boxShadow: '0 3px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
        }}
        onClick={() => window.open(fighter.wikipediaUrl, '_blank')}
      >
        {/* Noise texture */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          backgroundImage: `url('${NOISE}')`,
          backgroundRepeat: 'repeat',
          mixBlendMode: 'multiply',
        }} />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.06) 100%)',
        }} />

        {/* Photo */}
        <div style={{ background: '#c4b49a' }}>
          <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', background: '#d0c0a8' }}>
            {hasImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fighter.imageUrl!}
                  alt={displayName}
                  className={`w-full h-full transition-all duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    filter: 'sepia(0.5) contrast(1.05)',
                    objectFit: 'cover',
                    objectPosition: 'center 25%',
                  }}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                />
                {!imgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#d0c0a8' }}>
                    <span className="text-[#a09078] text-xl font-bold font-mono tracking-widest">{getInitials(fighter.name)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#d0c0a8' }}>
                <span className="text-[#a09078] text-2xl font-bold font-mono tracking-widest">{getInitials(fighter.name)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rank - just below photo, black, bold */}
        <div className="pt-3 pb-1 text-center">
          <span className="font-bold font-mono tracking-tight leading-none" style={{ fontSize: '1.75rem', color: '#1a0f0a' }}>
            {rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `#${rank}`}
          </span>
          {rankChange > 0 && (
            <span className="ml-1.5 text-sm font-bold" style={{ color: '#2a7a2a' }}>▲{rankChange}</span>
          )}
          {rankChange < 0 && (
            <span className="ml-1.5 text-sm font-bold" style={{ color: '#a03030' }}>▼{-rankChange}</span>
          )}
        </div>

        {/* Info section - fills remaining height */}
        <div className="px-5 pb-4 pt-2 text-center flex-1 flex flex-col justify-between">
          <div className="space-y-1.5">
            {/* Name */}
            <h2 className="text-sm font-bold uppercase tracking-[0.04em] leading-tight" style={{ color: '#2a1f15', fontFamily: "'Times New Roman', Times, serif" }}>
              {displayName}
            </h2>

            {/* Weight class - bold, always takes space */}
            <p className="text-[11px] uppercase tracking-[0.1em] min-h-[16px] font-bold" style={{ color: '#1a0f0a', fontFamily: "'Times New Roman', Times, serif" }}>
              {fighter.weightClass || ''}
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-4 font-mono" style={{ color: '#5a4a3a' }}>
              {isWorst ? (
                <>
                  <span className="flex flex-col items-center">
                    <span className="text-base font-bold leading-none" style={{ color: '#3a2a1a' }}>{fighter.losses}</span>
                    <span className="text-[10px] uppercase tracking-[0.08em] mt-0.5" style={{ color: '#8a7a6a', fontFamily: "'Times New Roman', Times, serif" }}>LOSSES</span>
                  </span>
                  <span className="text-lg leading-none" style={{ color: '#c4b49a' }}>|</span>
                  <span className="flex flex-col items-center">
                    <span className="text-base font-bold leading-none" style={{ color: '#3a2a1a' }}>{fighter.total}</span>
                    <span className="text-[10px] uppercase tracking-[0.08em] mt-0.5" style={{ color: '#8a7a6a', fontFamily: "'Times New Roman', Times, serif" }}>FTS</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex flex-col items-center">
                    <span className="text-base font-bold leading-none" style={{ color: '#3a2a1a' }}>{fighter.kos}</span>
                    <span className="text-[10px] uppercase tracking-[0.08em] mt-0.5" style={{ color: '#8a7a6a', fontFamily: "'Times New Roman', Times, serif" }}>KO</span>
                  </span>
                  <span className="text-lg leading-none" style={{ color: '#c4b49a' }}>|</span>
                  <span className="flex flex-col items-center">
                    <span className="text-base font-bold leading-none" style={{ color: '#3a2a1a' }}>{koPct}%</span>
                    <span className="text-[10px] uppercase tracking-[0.08em] mt-0.5" style={{ color: '#8a7a6a', fontFamily: "'Times New Roman', Times, serif" }}>KO%</span>
                  </span>
                </>
              )}
            </div>

            {/* Nationality - bold, tighter tracking */}
            <div className="flex items-center justify-center gap-1.5 min-h-[28px]">
              {flag && <span className="text-3xl leading-none">{flag}</span>}
              <span className="text-[11px] font-bold uppercase tracking-[0.02em]" style={{ color: '#5a4a3a', fontFamily: "'Times New Roman', Times, serif" }}>
                {fighter.nationality || ''}
              </span>
            </div>
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
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all')
  const [viewMode, setViewMode] = useState<'best' | 'worst'>('best')
  const [headerBlur, setHeaderBlur] = useState(false)

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

  const uniqueFights: { headline: string; url: string; source: string }[] = []
  const seen = new Set<string>()
  if (upcomingFights) {
    for (const f of upcomingFights.fights) {
      const key = f.headline + f.source
      if (!seen.has(key)) {
        seen.add(key)
        uniqueFights.push({ headline: f.headline, url: f.url, source: f.source })
      }
    }
  }

  const source = viewMode === 'best' ? (data?.fighters ?? []) : (data?.worst ?? [])
  const filtered = source
    .filter(f => genderFilter === 'all' || f.gender === genderFilter)
    .filter(f => cleanName(f.name).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (viewMode === 'worst') return b.losses - a.losses || a.draws - b.draws || a.name.localeCompare(b.name)
      if (sortBy === 'wins') return b.wins - a.wins || a.draws - b.draws || b.kos - a.kos || a.name.localeCompare(b.name)
      if (sortBy === 'kos') return b.kos - a.kos
      return (weightSortValue(a.weightClass) - weightSortValue(b.weightClass)) || b.wins - a.wins
    })

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#1a1510' }}>
        <div className="w-12 h-12 border border-[#4a3a2a] flex items-center justify-center">
          <span className="text-base animate-pulse" style={{ color: '#5a4a3a' }}>&#9916;</span>
        </div>
        <p className="mt-3 text-[10px] tracking-[0.3em] uppercase animate-pulse" style={{ color: '#5a4a3a', fontFamily: "'Times New Roman', serif" }}>
          Loading
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1510' }}>
        <p style={{ color: '#8a6a4a', fontFamily: "'Times New Roman', serif" }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1510' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: headerBlur ? 'rgba(26,21,16,0.95)' : 'rgba(26,21,16,0.7)',
          borderBottom: headerBlur ? '1px solid #3a2a1a' : '1px solid transparent',
        }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <nav className="flex items-center gap-2">
              <a href="https://boxingpugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-1" style={{ color: '#b8a890', border: '1px solid #3a2a1a', fontFamily: "'Times New Roman', serif" }}>Boxing</a>
              <a href="https://mmapugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-1" style={{ color: '#5a4a3a', border: '1px solid #3a2a1a', fontFamily: "'Times New Roman', serif" }}>MMA</a>
              <a href="https://generalspugilism.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-1" style={{ color: '#5a4a3a', border: '1px solid #3a2a1a', fontFamily: "'Times New Roman', serif" }}>Generals</a>
            </nav>
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-24 text-[10px] px-2 py-1 font-mono transition-colors"
                style={{
                  background: 'transparent',
                  border: '1px solid #3a2a1a',
                  color: '#b8a890',
                  outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = '#6a5a4a' }}
                onBlur={e => { e.target.style.borderColor = '#3a2a1a' }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-12">
        <div className="max-w-6xl mx-auto px-4">

          {uniqueFights.length > 0 && (
            <div className="mb-4 p-3 border flex flex-col gap-1.5" style={{ background: '#2a1f15', borderColor: '#5a4a3a' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs leading-none">🔔</span>
                <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: '#b8a890', fontFamily: "'Times New Roman', serif" }}>Fight News</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {uniqueFights.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="text-[10px] leading-tight hover:underline" style={{ color: '#d4c4a8', fontFamily: "'Times New Roman', Times, serif" }}>
                    {f.headline}
                    <span className="text-[8px] ml-1 uppercase tracking-wider" style={{ color: '#7a6a5a' }}>({f.source})</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 flex gap-1.5 flex-wrap items-center">
            <span className="w-px h-5 mx-1" style={{ background: '#3a2a1a' }} />
            {(['best', 'worst'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] uppercase transition-all"
                style={{
                  fontFamily: "'Times New Roman', serif",
                  background: viewMode === m ? '#3a2a1a' : 'transparent',
                  color: viewMode === m ? '#ddd0b8' : '#5a4a3a',
                  border: `1px solid ${viewMode === m ? '#5a4a3a' : '#3a2a1a'}`,
                }}
              >
                {m === 'best' ? 'Best' : 'Worst'}
              </button>
            ))}
            <span className="w-px h-5 mx-1" style={{ background: '#3a2a1a' }} />
            {(['wins', 'kos', 'weight'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] uppercase transition-all"
                style={{
                  fontFamily: "'Times New Roman', serif",
                  background: sortBy === s ? '#3a2a1a' : 'transparent',
                  color: sortBy === s ? '#ddd0b8' : '#5a4a3a',
                  border: `1px solid ${sortBy === s ? '#5a4a3a' : '#3a2a1a'}`,
                }}
              >
                {s === 'wins' ? 'Wins' : s === 'kos' ? 'KO' : 'Weight'}
              </button>
            ))}
            <span className="w-px mx-1 self-stretch" style={{ background: '#3a2a1a' }} />
            {(['all', 'male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className="px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] uppercase transition-all"
                style={{
                  fontFamily: "'Times New Roman', serif",
                  background: genderFilter === g ? '#3a2a1a' : 'transparent',
                  color: genderFilter === g ? '#ddd0b8' : '#5a4a3a',
                  border: `1px solid ${genderFilter === g ? '#5a4a3a' : '#3a2a1a'}`,
                }}
              >
                {g === 'all' ? 'All' : g === 'male' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {filtered.map((fighter, i) => (
              <FighterCard key={fighter.name} fighter={fighter} rank={i + 1} isWorst={viewMode === 'worst'} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xs tracking-widest uppercase" style={{ color: '#5a4a3a', fontFamily: "'Times New Roman', serif" }}>
                No fighters match your search.
              </p>
            </div>
          )}

          <footer className="mt-10 text-center">
            <p className="text-[8px] tracking-widest uppercase" style={{ color: '#3a2a1a', fontFamily: "'Times New Roman', serif" }}>
              Wikipedia &middot; Updated daily
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
