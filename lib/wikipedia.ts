const USER_AGENT = 'BoxingRankings/1.0 (https://github.com/user/boxing; boxing-app@example.com)'
const API_URL = 'https://en.wikipedia.org/w/api.php'

function extractInfobox(wikitext: string, prefixFilter?: string[]): string | null {
  const prefixes = prefixFilter || ['{{Infobox boxer', '{{Infobox martial artist', '{{Infobox person']
  for (const prefix of prefixes) {
    const start = wikitext.indexOf(prefix)
    if (start < 0) continue

    let depth = 0
    for (let i = start; i < wikitext.length; i++) {
      if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
      else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
        depth--
        i++
        if (depth === 0) return wikitext.slice(start, i + 1)
      }
    }
  }
  return null
}

function stripWikiMarkup(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedInfobox {
  total: number | null
  wins: number | null
  kos: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  nationality: string
  weightClass: string
  image: string
}

function extractWeightClass(raw: string): string {
  let text = raw
  // Handle {{plainlist|...}} multi-line
  if (text.includes('{{plainlist')) {
    const inner = text.replace(/^\{\{plainlist\s*\|?/, '').replace(/\}\}$/, '')
    const items = inner.split('*').map(s => s.trim()).filter(Boolean)
    if (items.length > 0) text = items[0]
    else text = ''
  }
  // Remove HTML tags like <br/>, <hr/>, etc.
  text = text.replace(/<[^>]+>/g, ' ')
  // Remove {{...}} templates (simple, non-nested)
  text = text.replace(/\{\{[^}]*\}\}/g, ' ')
  // Remove [[...]] wikilinks, keeping the display text
  text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  text = text.replace(/'''/g, '').replace(/''/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  // Common weight class names sorted by length desc so longer matches take priority
  const weightClasses: [string, string][] = [
    ['Super cruiserweight', 'super cruiserweight'],
    ['Light heavyweight', 'light heavyweight'],
    ['Super middleweight', 'super middleweight'],
    ['Super featherweight', 'super featherweight'],
    ['Light welterweight', 'light welterweight'],
    ['Light middleweight', 'light middleweight'],
    ['Junior welterweight', 'junior welterweight'],
    ['Junior middleweight', 'junior middleweight'],
    ['Junior featherweight', 'junior featherweight'],
    ['Junior lightweight', 'junior lightweight'],
    ['Super bantamweight', 'super bantamweight'],
    ['Junior bantamweight', 'junior bantamweight'],
    ['Junior flyweight', 'junior flyweight'],
    ['Super flyweight', 'super flyweight'],
    ['Mini flyweight', 'mini flyweight'],
    ['Minimumweight', 'minimumweight'],
    ['Bridgerweight', 'bridgerweight'],
    ['Cruiserweight', 'cruiserweight'],
    ['Middleweight', 'middleweight'],
    ['Lightweight', 'lightweight'],
    ['Welterweight', 'welterweight'],
    ['Featherweight', 'featherweight'],
    ['Heavyweight', 'heavyweight'],
    ['Bantamweight', 'bantamweight'],
    ['Strawweight', 'strawweight'],
    ['Flyweight', 'flyweight'],
  ]
  // Normalize hyphens/dashes to spaces for matching
  const normalized = text.toLowerCase().replace(/[-–]/g, ' ')
  for (const [display, lowerWc] of weightClasses) {
    const idx = normalized.indexOf(lowerWc)
    if (idx !== -1) {
      const before = idx === 0 || normalized[idx - 1] === ' '
      const after = idx + lowerWc.length >= normalized.length || normalized[idx + lowerWc.length] === ' '
      if (before && after) return display
    }
  }
  // Fallback: if text starts with a weight measurement (digits + kg/lbs), return empty
  if (/^\d+(\.\d+)?\s*(kg|lbs?)\s/i.test(text) || /^\d+(\.\d+)?\s*(kg|lbs?)\.?\s*$/i.test(text)) return ''
  // Return first word or pair
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0]
  if (words.length > 1) return words[0] + ' ' + words[1]
  return ''
}

function parseParamLine(line: string): Map<string, string> {
  const params = new Map<string, string>()
  const rest = line.startsWith('|') ? line.slice(1) : line
  const paramRegex = /([\w ]+)\s*=\s*/g
  let m: RegExpExecArray | null

  while ((m = paramRegex.exec(rest)) !== null) {
    const key = m[1].trim().toLowerCase().replace(/ /g, '_')
    const valStart = m.index + m[0].length
    let valEnd = rest.length
    let braceDepth = 0
    for (let j = valStart; j < rest.length; j++) {
      if (rest[j] === '{' && rest[j + 1] === '{') { braceDepth++; j++ }
      else if (rest[j] === '}' && rest[j + 1] === '}') { braceDepth--; j++ }
      else if (rest[j] === '|' && braceDepth === 0) {
        const afterPipe = rest.slice(j + 1)
        if (/^[\w ]+=(?:.|$)/.test(afterPipe)) { valEnd = j; break }
      }
    }
    let value = rest.slice(valStart, valEnd).trim()
    if (value.endsWith('|') && !value.includes('{{')) value = value.slice(0, -1).trim()
    if (key && value) params.set(key, value)
  }

  return params
}

function parseImageUrl(rawImage: string): string {
  if (!rawImage) return ''
  let cleaned = rawImage
  const fileMatch = cleaned.match(/\[\[(?:File|Image):([^\]|]+)/i)
  if (fileMatch) {
    cleaned = fileMatch[1]
  } else {
    cleaned = cleaned.replace(/^(?:File|Image):/i, '').replace(/\|.*$/, '').trim()
  }
  const extMatch = cleaned.match(/(.+\.(?:jpg|jpeg|png|gif|svg|webp|tiff?))/i)
  if (extMatch) cleaned = extMatch[1]
  if (!cleaned) return ''
  // Reject HTML comments or placeholder text that isn't a real filename
  if (cleaned.startsWith('<!--') || cleaned.includes('Insert image') || cleaned.includes('only free-content')) return ''
  // Reject if no recognizable image extension
  if (!/\.(jpg|jpeg|png|gif|svg|webp|tiff?)$/i.test(cleaned)) return ''
  return `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(cleaned.replace(/ /g, '_'))}`
}

function parseWikitextInfobox(wikitext: string): ParsedInfobox {
  const result: ParsedInfobox = {
    total: null,
    wins: null,
    kos: null,
    losses: null,
    draws: null,
    no_contests: null,
    nationality: '',
    weightClass: '',
    image: '',
  }

  // First extract stats from boxing-specific infobox
  const boxerInfobox = extractInfobox(wikitext, ['{{Infobox boxer', '{{Infobox martial artist'])
  // Then extract image/nationality from person infobox (wraps boxer infobox)
  const personInfobox = extractInfobox(wikitext, ['{{Infobox person'])

  let rawWeight = ''

  // Parse boxing infobox for stats
  if (boxerInfobox) {
    const lines = boxerInfobox.split('\n')
    let multiLineKey = ''
    let multiLineValue = ''
    let templateDepth = 0
    let skipMultiLine = false

    for (const line of lines) {
      const rest = line.startsWith('|') ? line.slice(1) : line
      const paramRegex = /([\w ]+)\s*=\s*/g
      let m: RegExpExecArray | null
      skipMultiLine = false

      while ((m = paramRegex.exec(rest)) !== null) {
        const key = m[1].trim().toLowerCase().replace(/ /g, '_')
        const valStart = m.index + m[0].length
        let valEnd = rest.length
        let braceDepth = 0
        for (let j = valStart; j < rest.length; j++) {
          if (rest[j] === '{' && rest[j + 1] === '{') { braceDepth++; j++ }
          else if (rest[j] === '}' && rest[j + 1] === '}') { braceDepth--; j++ }
          else if (rest[j] === '|' && braceDepth === 0) {
            const afterPipe = rest.slice(j + 1)
            if (/^[\w ]+=(?:.|$)/.test(afterPipe)) { valEnd = j; break }
          }
        }
        let value = rest.slice(valStart, valEnd).trim()
        if (value.endsWith('|') && !value.includes('{{')) value = value.slice(0, -1).trim()
        if (key === 'weight' || key === 'weight_class') {
          if (key === 'weight_class' || !rawWeight) rawWeight = value
          if (value.includes('{{') || value.includes('}}')) {
            templateDepth = (value.match(/\{\{/g) || []).length - (value.match(/\}\}/g) || []).length
            if (templateDepth > 0) {
              multiLineKey = key
              multiLineValue = value
              skipMultiLine = true
              continue
            }
          }
        } else {
          value = stripWikiMarkup(value)
        }
        if (key && value) {
          const existing = result.wins === null ? null : true
          if (key === 'total' || key === 'total_fights') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.total = n
          } else if (key === 'wins' || key === 'box_win') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.wins = n
          } else if (key === 'ko' || key === 'win_by_ko' || key === 'box_kowin') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.kos = n
          } else if (key === 'losses' || key === 'box_loss') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.losses = n
          } else if (key === 'draws' || key === 'box_draw') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.draws = n
          } else if (key === 'no_contests' || key === 'nc') {
            const n = parseInt(value, 10)
            if (!isNaN(n)) result.no_contests = n
          } else if (key === 'nationality') {
            if (!result.nationality) result.nationality = value
          } else if (key === 'birth_place') {
            // handled below
          } else if (key === 'image') {
            // handled from person infobox
          }
        }
      }

      if (templateDepth > 0 && (multiLineKey === 'weight' || multiLineKey === 'weight_class') && !skipMultiLine) {
        multiLineValue += '\n' + line
        const opens = (line.match(/\{\{/g) || []).length
        const closes = (line.match(/\}\}/g) || []).length
        templateDepth += opens - closes
        if (templateDepth <= 0) {
          if (multiLineKey === 'weight' || multiLineKey === 'weight_class') {
            rawWeight = multiLineValue
          }
          templateDepth = 0
          multiLineKey = ''
        }
      }
    }
  }

  // Parse person infobox for image and nationality
  if (personInfobox) {
    const lines = personInfobox.split('\n')
    for (const line of lines) {
      const params = parseParamLine(line)
      const image = params.get('image')
      const nat = params.get('nationality')
      const birthPlace = params.get('birth_place')

      if (image && !result.image) {
        const url = parseImageUrl(image)
        if (url) result.image = url
      }

      if (nat && !result.nationality) {
        result.nationality = stripWikiMarkup(nat)
      } else if (birthPlace && !result.nationality) {
        const cleaned = stripWikiMarkup(birthPlace)
        const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean)
        result.nationality = parts[parts.length - 1] || ''
      }
    }
  }

  // Fallback: also check boxing infobox for nationality and image if person infobox wasn't present
  if (boxerInfobox && (!result.nationality || !result.image)) {
    const lines = boxerInfobox.split('\n')
    for (const line of lines) {
      const params = parseParamLine(line)
      if (!result.nationality) {
        const nat = params.get('nationality')
        const birthPlace = params.get('birth_place')
        if (nat) {
          result.nationality = stripWikiMarkup(nat)
        } else if (birthPlace) {
          const cleaned = stripWikiMarkup(birthPlace)
          const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean)
          result.nationality = parts[parts.length - 1] || ''
        }
      }
      if (!result.image) {
        const rawImage = params.get('image')
        if (rawImage) {
          const url = parseImageUrl(rawImage)
          if (url) result.image = url
        }
      }
    }
  }

  result.weightClass = extractWeightClass(rawWeight)

  return result
}

export interface BoxerStats {
  total: number | null
  wins: number | null
  kos: number | null
  losses: number
  draws: number
  nationality: string
  weightClass: string
  imageUrl: string
}

function parseBoxingRecordSummary(wikitext: string): { wins: number; losses: number; draws: number } | null {
  const start = wikitext.indexOf('{{BoxingRecordSummary')
  if (start < 0) return null

  let depth = 0
  let end = start
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) { end = i + 1; break }
    }
  }

  const block = wikitext.slice(start, end + 1)
  const lines = block.split('\n')

  let koWins = 0, decWins = 0, dqWins = 0
  let koLosses = 0, decLosses = 0, dqLosses = 0
  let draws = 0

  for (const line of lines) {
    const m = line.match(/^\|(\w[\w-]*)\s*=\s*(\d+)/)
    if (!m) continue
    const key = m[1].trim()
    const val = parseInt(m[2], 10)
    if (key === 'ko-wins') koWins = val
    else if (key === 'dec-wins') decWins = val
    else if (key === 'dq-wins') dqWins = val
    else if (key === 'ko-losses') koLosses = val
    else if (key === 'dec-losses') decLosses = val
    else if (key === 'dq-losses') dqLosses = val
    else if (key === 'draws') draws = val
  }

  const wins = koWins + decWins + dqWins
  const losses = koLosses + decLosses + dqLosses

  if (wins === 0 && losses === 0) return null

  return { wins, losses, draws }
}

function parseDetailedRecordTable(wikitext: string): { wins: number; losses: number; draws: number } | null {
  const lastRowRegex = /\n\|-\n\|(\d+)\n\|[^|]+\n\|(\d+)[–-](\d+)(?:[–-](\d+))?/g
  let match: RegExpExecArray | null
  let last: RegExpExecArray | null = null

  while ((match = lastRowRegex.exec(wikitext)) !== null) {
    last = match
  }

  if (!last) return null

  const wins = parseInt(last[2], 10)
  const losses = parseInt(last[3], 10)
  const draws = last[4] ? parseInt(last[4], 10) : 0

  return { wins, losses, draws }
}

function parseRecordTables(wikitext: string): { losses: number; draws: number } | null {
  const summary = parseBoxingRecordSummary(wikitext)
  if (summary) {
    return { losses: summary.losses, draws: summary.draws }
  }

  const detailed = parseDetailedRecordTable(wikitext)
  if (detailed) {
    return { losses: detailed.losses, draws: detailed.draws }
  }

  return null
}

function hasRecordTable(wikitext: string): boolean {
  if (wikitext.includes('BoxingRecordSummary')) return true
  return /\n\|-\n\|\d+\n\|/.test(wikitext)
}

function processRecord(wikitext: string): BoxerStats | null {
  if (!hasRecordTable(wikitext)) return null

  const infobox = parseWikitextInfobox(wikitext)
  if (infobox.wins === null) return null

  let total = infobox.total
  let losses: number
  let draws: number

  const noContests = infobox.no_contests ?? 0

  if (infobox.losses !== null) {
    losses = infobox.losses
    draws = infobox.draws ?? 0
    if (total === null) total = infobox.wins + losses + draws + noContests
  } else {
    const tables = parseRecordTables(wikitext)
    if (tables) {
      losses = tables.losses
      draws = tables.draws
      if (total === null) total = infobox.wins + losses + draws + noContests
    } else {
      draws = infobox.draws ?? 0
      if (total !== null) {
        losses = total - infobox.wins - draws - noContests
      } else {
        losses = 0
        total = infobox.wins
      }
    }
  }

  return {
    total,
    wins: infobox.wins,
    kos: infobox.kos ?? 0,
    losses,
    draws,
    nationality: infobox.nationality,
    weightClass: infobox.weightClass,
    imageUrl: infobox.image,
  }
}

export async function fetchBoxerRecord(name: string): Promise<BoxerStats | null> {
  const wikitext = await fetchPageWikitext(name)
  if (!wikitext) return null
  return processRecord(wikitext)
}

async function fetchPageWikitext(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    format: 'json',
    origin: '*',
    titles: title,
  })

  const url = `${API_URL}?${params.toString()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (res.status === 404) return null
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2000))
    return fetchPageWikitext(title)
  }
  if (!res.ok) return null

  const data = await res.json() as any
  const pages = data?.query?.pages ?? {}
  const page = Object.values(pages)[0] as any
  if (!page?.revisions?.[0]?.['*']) return null
  return page.revisions[0]['*']
}

export async function fetchBoxerRecords(titles: string[]): Promise<Map<string, BoxerStats | null>> {
  const results = new Map<string, BoxerStats | null>()

  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      format: 'json',
      origin: '*',
      titles: batch.join('|'),
    })

    const url = `${API_URL}?${params.toString()}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 5000))
      i -= 50
      continue
    }

    if (!res.ok) {
      for (const title of batch) results.set(title, null)
      continue
    }

    const data = await res.json() as any
    const pages = data?.query?.pages ?? {}

    for (const [pid, page] of Object.entries(pages)) {
      const p = page as any
      if (pid === '-1') continue
      const title = p.title as string
      const wikitext = p?.revisions?.[0]?.['*']
      if (!wikitext) {
        results.set(title, null)
      } else {
        results.set(title, processRecord(wikitext))
      }
    }

    for (const title of batch) {
      if (!results.has(title)) results.set(title, null)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  return results
}
