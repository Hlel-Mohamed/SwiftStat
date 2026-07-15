import MiniSearch from 'minisearch'

// Data lives as static, service-worker-cached JSON per edition:
//   public/data/srd-2014.json  (5e / 2014)
//   public/data/srd-2024.json  (5.5 / 2024)
// We build one MiniSearch index per edition, lazily, and keep an `active` pointer
// so search()/getById() operate on whichever edition the UI last loaded.

export const EDITIONS = {
  '2014': { id: '2014', label: '5e (2014)' },
  '2024': { id: '2024', label: '5.5 (2024)' },
}
export const DEFAULT_EDITION = '2014'

// Injected at build time by vite.config.js. 'public' → SRD only; 'personal' → also
// merge your git-ignored custom cards from personal-<edition>.json.
export const PROFILE = import.meta.env.VITE_PROFILE || 'public'

const cache = new Map() // edition -> { promise, mini, byId }
let active = null

function buildMini() {
  return new MiniSearch({
    fields: ['name', 'aliases', 'text', 'summary', 'type', 'category', 'school', 'meta', 'rarity'],
    storeFields: ['type'],
    extractField: (doc, field) => {
      const v = doc[field]
      return Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v)
    },
    searchOptions: { boost: { name: 4, aliases: 4 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  })
}

async function fetchCards(edition) {
  const base = import.meta.env.BASE_URL
  const srd = await fetch(`${base}data/srd-${edition}.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${edition} data (${r.status})`)
    return r.json()
  })
  if (PROFILE !== 'personal') return srd
  // Personal build: merge custom cards. Tolerate an absent file (e.g. none authored).
  const personal = await fetch(`${base}data/personal-${edition}.json`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
  return [...personal, ...srd]
}

export function loadIndex(edition = DEFAULT_EDITION) {
  let entry = cache.get(edition)
  if (!entry) {
    entry = {}
    entry.promise = fetchCards(edition).then((cards) => {
      entry.mini = buildMini()
      entry.mini.addAll(cards)
      entry.byId = new Map(cards.map((c) => [c.id, c]))
      return { edition, count: cards.length }
    })
    cache.set(edition, entry)
  }
  return entry.promise.then((res) => {
    active = edition
    return res
  })
}

export function isReady() {
  return active !== null && cache.get(active)?.mini != null
}

export function search(query, limit = 40) {
  const entry = active && cache.get(active)
  if (!entry?.mini || !query.trim()) return []
  return entry.mini
    .search(query)
    .slice(0, limit)
    .map((r) => entry.byId.get(r.id))
    .filter(Boolean)
}

export function getById(id) {
  return active && cache.get(active)?.byId.get(id)
}
