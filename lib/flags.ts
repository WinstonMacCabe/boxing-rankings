const COUNTRY_FLAGS: Record<string, string> = {
  'afghanistan': '🇦🇫', 'albania': '🇦🇱', 'algeria': '🇩🇿',
  'american samoa': '🇦🇸', 'angola': '🇦🇴', 'argentina': '🇦🇷',
  'armenia': '🇦🇲', 'australia': '🇦🇺', 'austria': '🇦🇹',
  'azerbaijan': '🇦🇿',
  'bahamas': '🇧🇸', 'bahrain': '🇧🇭', 'bangladesh': '🇧🇩',
  'barbados': '🇧🇧', 'belarus': '🇧🇾', 'belgium': '🇧🇪',
  'belize': '🇧🇿', 'benin': '🇧🇯', 'bolivia': '🇧🇴',
  'bosnia': '🇧🇦', 'botswana': '🇧🇼', 'brazil': '🇧🇷',
  'brunei': '🇧🇳', 'bulgaria': '🇧🇬', 'burkina faso': '🇧🇫',
  'burma': '🇲🇲', 'burundi': '🇧🇮',
  'cameroon': '🇨🇲',
  'canada': '🇨🇦', 'cape verde': '🇨🇻', 'cayman islands': '🇰🇾',
  'central african republic': '🇨🇫', 'chad': '🇹🇩', 'chile': '🇨🇱',
  'china': '🇨🇳', 'colombia': '🇨🇴', 'congo': '🇨🇬',
  'costa rica': '🇨🇷', 'croatia': '🇭🇷', 'cuba': '🇨🇺',
  'cyprus': '🇨🇾', 'czech republic': '🇨🇿',
  'denmark': '🇩🇰', 'dominican republic': '🇩🇴',
  'dr congo': '🇨🇩',
  'ecuador': '🇪🇨', 'egypt': '🇪🇬', 'el salvador': '🇸🇻',
  'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'estonia': '🇪🇪', 'ethiopia': '🇪🇹',
  'fiji': '🇫🇯', 'finland': '🇫🇮', 'france': '🇫🇷',
  'gabon': '🇬🇦', 'gambia': '🇬🇲', 'georgia': '🇬🇪',
  'germany': '🇩🇪', 'ghana': '🇬🇭', 'gibraltar': '🇬🇮',
  'great britain': '🇬🇧', 'greece': '🇬🇷', 'grenada': '🇬🇩',
  'guatemala': '🇬🇹', 'guinea': '🇬🇳', 'guyana': '🇬🇾',
  'haiti': '🇭🇹', 'honduras': '🇭🇳', 'hong kong': '🇭🇰',
  'hungary': '🇭🇺',
  'iceland': '🇮🇸', 'india': '🇮🇳', 'indonesia': '🇮🇩',
  'iran': '🇮🇷', 'iraq': '🇮🇶', 'ireland': '🇮🇪',
  'israel': '🇮🇱', 'italy': '🇮🇹', 'ivory coast': '🇨🇮',
  'jamaica': '🇯🇲', 'japan': '🇯🇵', 'jordan': '🇯🇴',
  'kazakhstan': '🇰🇿', 'kenya': '🇰🇪', 'kosovo': '🇽🇰',
  'kuwait': '🇰🇼', 'kyrgyzstan': '🇰🇬',
  'laos': '🇱🇦', 'latvia': '🇱🇻', 'lebanon': '🇱🇧',
  'liberia': '🇱🇷', 'libya': '🇱🇾', 'liechtenstein': '🇱🇮',
  'lithuania': '🇱🇹', 'luxembourg': '🇱🇺',
  'madagascar': '🇲🇬', 'malawi': '🇲🇼', 'malaysia': '🇲🇾',
  'maldives': '🇲🇻', 'mali': '🇲🇱', 'malta': '🇲🇹',
  'mexico': '🇲🇽', 'moldova': '🇲🇩', 'monaco': '🇲🇨',
  'mongolia': '🇲🇳', 'montenegro': '🇲🇪', 'morocco': '🇲🇦',
  'mozambique': '🇲🇿',
  'namibia': '🇳🇦', 'nepal': '🇳🇵', 'netherlands': '🇳🇱',
  'new zealand': '🇳🇿', 'nicaragua': '🇳🇮', 'niger': '🇳🇪',
  'nigeria': '🇳🇬', 'north korea': '🇰🇵', 'norway': '🇳🇴',
  'oman': '🇴🇲',
  'pakistan': '🇵🇰', 'palestine': '🇵🇸', 'panama': '🇵🇦',
  'papua new guinea': '🇵🇬', 'paraguay': '🇵🇾', 'peru': '🇵🇪',
  'philippines': '🇵🇭', 'poland': '🇵🇱', 'portugal': '🇵🇹',
  'puerto rico': '🇵🇷',
  'qatar': '🇶🇦',
  'romania': '🇷🇴', 'russia': '🇷🇺', 'rwanda': '🇷🇼',
  'saudi arabia': '🇸🇦', 'senegal': '🇸🇳', 'serbia': '🇷🇸',
  'sierra leone': '🇸🇱', 'singapore': '🇸🇬', 'slovakia': '🇸🇰',
  'slovenia': '🇸🇮', 'south africa': '🇿🇦', 'south korea': '🇰🇷',
  'soviet union': '🇺🇳', 'spain': '🇪🇸', 'sri lanka': '🇱🇰',
  'sudan': '🇸🇩', 'suriname': '🇸🇷', 'swaziland': '🇸🇿',
  'sweden': '🇸🇪', 'switzerland': '🇨🇭', 'syria': '🇸🇾',
  'taiwan': '🇹🇼', 'tajikistan': '🇹🇯', 'tanzania': '🇹🇿',
  'thailand': '🇹🇭', 'togo': '🇹🇬', 'tonga': '🇹🇴',
  'trinidad and tobago': '🇹🇹', 'tunisia': '🇹🇳', 'turkey': '🇹🇷',
  'turkmenistan': '🇹🇲',
  'uganda': '🇺🇬', 'ukraine': '🇺🇦', 'united states': '🇺🇸',
  'uruguay': '🇺🇾', 'uzbekistan': '🇺🇿',
  'vanuatu': '🇻🇺',   'venezuela': '🇻🇪', 'vietnam': '🇻🇳', 'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'zambia': '🇿🇲', 'zimbabwe': '🇿🇼',
}

const DEMONYM_MAP: Record<string, string> = {
  'american': 'united states',
  'british': 'great britain',
  'canadian': 'canada',
  'chinese': 'china',
  'croatian': 'croatia',
  'czech': 'czech republic',
  'danish': 'denmark',
  'dutch': 'netherlands',
  'english': 'england',
  'filipino': 'philippines',
  'french': 'france',
  'german': 'germany',
  'greek': 'greece',
  'hungarian': 'hungary',
  'irish': 'ireland',
  'italian': 'italy',
  'japanese': 'japan',
  'korean': 'south korea',
  'latvian': 'latvia',
  'mexican': 'mexico',
  'nigerian': 'nigeria',
  'pakistani': 'pakistan',
  'polish': 'poland',
  'romanian': 'romania',
  'russian': 'russia',
  'scottish': 'scotland',
  'serbian': 'serbia',
  'south african': 'south africa',
  'south korean': 'south korea',
  'spanish': 'spain',
  'swedish': 'sweden',
  'thai': 'thailand',
  'ukrainian': 'ukraine',
  'uzbek': 'uzbekistan',
  'venezuelan': 'venezuela',
  'welsh': 'wales',
  'kazakh': 'kazakhstan',
  'colombian': 'colombia',
}

const ALIAS_MAP: Record<string, string> = {
  'u.s.': 'united states',
  'u.s': 'united states',
  'usa': 'united states',
  'uk': 'great britain',
  'u.k.': 'great britain',
  'côte d\'ivoire': 'ivory coast',
  'dr congo': 'congo',
  'congo (drc)': 'congo',
  'hong konger': 'hong kong',
  'americanpuerto rican': 'united states',
}

function normalizeCountry(raw: string): string {
  if (!raw) return ''

  let s = raw.replace(/\{\{plainlist[\s\S]*$/i, '').trim()

  // Try splitting multi-nationality on "/" or " & "
  const parts = s.split(/\s*\/\s*|\s+&\s+/)
  s = parts[0].trim()

  // Strip hyphenated suffixes like -American, -Irish
  s = s.replace(/-(?:American|Irish|Italian|Canadian|British|German|French|Japanese|Chinese|Korean|Mexican|Russian|Spanish|African)$/i, '').trim()

  const key = s.toLowerCase()

  // Direct match
  if (COUNTRY_FLAGS[key]) return key
  if (COUNTRY_FLAGS[s]) return s

  // Alias
  if (ALIAS_MAP[key]) return ALIAS_MAP[key]

  // Demonym
  if (DEMONYM_MAP[key]) return DEMONYM_MAP[key]

  if (!key) return ''

  for (const c of Object.keys(COUNTRY_FLAGS)) {
    if (c.includes(key)) return c
    if (key.includes(c)) return c
  }

  return key
}

export function getCountryFlag(country: string): string {
  const normalized = normalizeCountry(country)
  if (!normalized) return ''
  return COUNTRY_FLAGS[normalized] || ''
}

export function getCountryFlagUrl(country: string): string {
  const flag = getCountryFlag(country)
  const codePoints = Array.from(flag).map(char => char.codePointAt(0) ?? 0)
  const regional = codePoints.every(code => code >= 0x1f1e6 && code <= 0x1f1ff) && codePoints.length === 2
  if (!regional) return ''
  const code = codePoints.map(code => String.fromCharCode(code - 0x1f1e6 + 97)).join('')
  return `https://flagcdn.com/w40/${code}.png`
}

export function getCountryName(country: string): string {
  if (!country) return ''
  const normalized = normalizeCountry(country)
  if (!normalized) return country
  // Title case the normalized name
  return normalized.replace(/\b\w/g, c => c.toUpperCase())
}
