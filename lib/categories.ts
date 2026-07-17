const USER_AGENT = 'BoxingRankings/1.0 (https://github.com/user/boxing; boxing-app@example.com)'
const API_URL = 'https://en.wikipedia.org/w/api.php'
const CONCURRENCY = 5

interface CategoryMember {
  title: string
  ns: number
}

interface ApiResponse {
  query?: { categorymembers?: CategoryMember[] }
  continue?: Record<string, string>
}

async function apiQuery(params: Record<string, string>): Promise<ApiResponse> {
  const url = new URL(API_URL)
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000))
    return apiQuery(params)
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function getAllMembers(
  category: string,
  type: 'page' | 'subcat' = 'page'
): Promise<CategoryMember[]> {
  const members: CategoryMember[] = []
  let cmcontinue: string | null = null

  do {
    const params: Record<string, string> = {
      list: 'categorymembers',
      cmtitle: category,
      cmtype: type,
      cmlimit: 'max',
    }
    if (cmcontinue) params.cmcontinue = cmcontinue

    const data = await apiQuery(params)
    const pages = data.query?.categorymembers ?? []
    members.push(...pages)
    cmcontinue = data.continue?.cmcontinue ?? null
  } while (cmcontinue)

  return members
}

function isBoxerPage(title: string): boolean {
  if (title.startsWith('Category:')) return false
  if (title.startsWith('List of')) return false
  if (title.startsWith('Draft:')) return false
  if (title.startsWith('User:')) return false
  if (title.startsWith('Template:')) return false
  if (title.startsWith('Portal:')) return false
  if (title.startsWith('Wikipedia:')) return false
  if (title.startsWith('Module:')) return false
  if (title.startsWith('File:')) return false
  if (title.startsWith('Talk:')) return false
  if (title.startsWith('Help:')) return false
  if (title.startsWith('MediaWiki:')) return false
  return true
}

async function throttledMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    for (const result of batchResults) {
      if (result.status === 'fulfilled') results.push(result.value)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

async function getCategoryPagesRecursive(category: string): Promise<string[]> {
  const pages = new Set<string>()

  const directPages = await getAllMembers(category, 'page')
  for (const p of directPages) {
    if (isBoxerPage(p.title)) pages.add(p.title)
  }

  const subcats = await getAllMembers(category, 'subcat')
  const subcatResults = await throttledMap(
    subcats.filter(c => !c.title.includes('Lists of')),
    (cat) => getAllMembers(cat.title, 'page'),
    CONCURRENCY
  )

  for (const members of subcatResults) {
    for (const member of members) {
      if (isBoxerPage(member.title)) pages.add(member.title)
    }
  }

  return Array.from(pages)
}

async function getCategoryPagesDeep(category: string): Promise<string[]> {
  const pages = new Set<string>()

  const directPages = await getAllMembers(category, 'page')
  for (const p of directPages) {
    if (isBoxerPage(p.title)) pages.add(p.title)
  }

  const subcats = await getAllMembers(category, 'subcat')
  const deepSubcats = subcats.filter(c =>
    !c.title.includes('Lists of') &&
    (c.title.includes('by state') ||
     c.title.includes('by populated place') ||
     c.title.includes('by descent'))
  )

  const results = await throttledMap(
    deepSubcats,
    (cat) => getCategoryPagesRecursive(cat.title),
    CONCURRENCY
  )

  for (const memberPages of results) {
    for (const page of memberPages) {
      pages.add(page)
    }
  }

  return Array.from(pages)
}

async function getCountryBoxerPages(genderCategoryName: string): Promise<string[]> {
  const nationalityCategory = `${genderCategoryName} by nationality`
  const countryCats = await getAllMembers(nationalityCategory, 'subcat')

  const results = await throttledMap(
    countryCats,
    (cat) => getCategoryPagesRecursive(cat.title),
    CONCURRENCY
  )

  const pages = new Set<string>()
  for (const members of results) {
    for (const member of members) {
      pages.add(member)
    }
  }

  return Array.from(pages)
}

export async function getAllBoxerPages(): Promise<Map<string, import('./types').Gender>> {
  const pageMap = new Map<string, import('./types').Gender>()

  const directPages = await getAllMembers('Category:Boxers (sport)', 'page')
  for (const p of directPages) {
    if (isBoxerPage(p.title) && !pageMap.has(p.title)) pageMap.set(p.title, 'male')
  }

  const malePages = await getCountryBoxerPages('Category:Male boxers (sport)')
  for (const p of malePages) {
    if (!pageMap.has(p)) pageMap.set(p, 'male')
  }

  const femalePages = await getCountryBoxerPages('Category:Women boxers (sport)')
  for (const p of femalePages) {
    pageMap.set(p, 'female')
  }

  const allCountryCats = await getAllMembers('Category:Boxers by nationality', 'subcat')
  const extraCountryCats = allCountryCats.filter(cat => {
    const n = cat.title
    if (n.includes(' male boxers') || n.includes(' women boxers')) return false
    if (n.includes(' by nationality')) return false
    if (n.includes('Lists of')) return false
    if (n.includes('Olympic')) return false
    if (n.includes('Asian Games') || n.includes('Pan American') || n.includes('Commonwealth')) return false
    if (n.includes('by populated place')) return false
    return true
  })

  const extraResults = await throttledMap(
    extraCountryCats,
    (cat) => getCategoryPagesDeep(cat.title),
    CONCURRENCY
  )

  for (const pages of extraResults) {
    for (const page of pages) {
      if (!pageMap.has(page)) pageMap.set(page, 'male')
    }
  }

  return pageMap
}
