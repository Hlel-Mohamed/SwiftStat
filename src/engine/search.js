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
let requestSeq = 0 // monotonic token so only the latest loadIndex sets `active`

// Flatten every searchable bit of a card into one string — crucially the nested
// monster traits/actions/legendary/reactions and the scalar fields that were
// previously unindexed (classes, save, properties, saves/skills, resistances…).
// This is why "multiattack", "pack tactics", "finesse", "wizard" now find cards.
function cardBody(doc) {
  const bits = [
    doc.text, doc.summary, doc.category, doc.school, doc.meta, doc.rarity,
    doc.classes, doc.duration, doc.save, doc.higherLevel,
    doc.mastery, doc.rangeText, doc.senses, doc.languages,
    doc.savingThrows, doc.skills, doc.damageResistances, doc.damageVulnerabilities,
    doc.damageImmunities, doc.conditionImmunities, doc.ability,
    Array.isArray(doc.properties) ? doc.properties.join(' ') : null,
  ]
  for (const key of ['traits', 'actions', 'reactions', 'legendaryActions']) {
    for (const a of doc[key] || []) bits.push(a.name, a.desc)
  }
  return bits.filter(Boolean).join(' ')
}

function buildMini() {
  return new MiniSearch({
    fields: ['name', 'aliases', 'body'],
    storeFields: ['type'],
    extractField: (doc, field) => {
      if (field === 'body') return cardBody(doc)
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
      entry.byId = new Map()
      const types = {}
      for (const c of cards) {
        if (entry.byId.has(c.id)) continue // skip a duplicate id rather than throwing
        entry.byId.set(c.id, c)
        entry.mini.add(c)
        types[c.type] = (types[c.type] || 0) + 1
      }
      return { edition, count: entry.byId.size, types }
    })
    // Don't cache a rejected promise — a transient failure would brick the edition
    // until a full reload. Drop the entry so the next loadIndex retries the fetch.
    entry.promise.catch(() => cache.delete(edition))
    cache.set(edition, entry)
  }
  const token = ++requestSeq
  return entry.promise.then((res) => {
    if (token === requestSeq) active = edition // last request wins, not last resolved
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
