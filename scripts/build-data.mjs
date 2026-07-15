// Transforms the 5e-database into SwiftStat's card shapes, per edition, writing:
//   public/data/srd-2014.json   (5e / 2014 SRD 5.1)
//   public/data/srd-2024.json   (5.5 / 2024 SRD 5.2.1)
//
// The 2024 SRD has no spells and only 3 monsters, so in the 2024 file those two
// categories (plus the rules glossary, also absent in 2024) are BORROWED from 2014
// and tagged `fromEdition: '5.1'` — the UI shows a small "5.1" badge on them.
//
// Licensing: SRD data is CC-BY-4.0. The 2024 "change" cards are our own wording,
// flag-gated by NO_2024=1 (see srd-2024-extras.mjs).
//
// Usage: node scripts/build-data.mjs [path-to-5e-database]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renames, changeCards } from './srd-2024-extras.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dbRoot = process.argv[2] || path.resolve(projectRoot, '../5e-database')
const INCLUDE_2024_CHANGES = !process.env.NO_2024
// 'public' (SRD-only) or 'personal' (also merges your git-ignored custom cards).
const PROFILE = process.env.SWIFTSTAT_PROFILE === 'personal' ? 'personal' : 'public'
const EDITION_IDS = ['2014', '2024']

const dir2014 = path.join(dbRoot, 'src/2014/en')
const dir2024 = path.join(dbRoot, 'src/2024/en')
if (!fs.existsSync(dir2014)) {
  console.error(`5e-database not found at ${dir2014}`)
  process.exit(1)
}
const read = (dir, name) => {
  const p = path.join(dir, name)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []
}

// --- shared helpers -----------------------------------------------------------
const clip = (s, n) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s)
const cost = (c) => (c && typeof c === 'object' ? `${c.quantity} ${c.unit}` : c != null ? `${c} gp` : undefined)
const weight = (w) => (w ? `${w} lb.` : undefined)
// desc may be an array (2014) or a string under `desc`/`description` (2024).
const getText = (rec) => {
  const v = rec.desc ?? rec.description
  return Array.isArray(v) ? v.join('\n') : v || ''
}
const firstSentence = (s) => {
  const clean = (s || '').replace(/\*\*/g, '').replace(/^[-\s]+/, '').replace(/\n/g, ' ')
  const m = clean.match(/^.*?[.!?](\s|$)/)
  return clip((m ? m[0] : clean).trim(), 160)
}

// --- per-type transforms (edition-aware where shapes differ) -------------------
function makeSpell(sp) {
  const d = sp.damage
  let damage
  if (d) {
    const type = d.damage_type?.name ? ` ${d.damage_type.name.toLowerCase()}` : ''
    const base = d.damage_at_slot_level?.[String(sp.level)] || Object.values(d.damage_at_slot_level || {})[0] ||
      d.damage_at_character_level?.['1'] || Object.values(d.damage_at_character_level || {})[0]
    if (base) damage = `${base}${type}`
  }
  let save
  if (sp.dc) save = `${sp.dc.dc_type?.name || 'save'} save${sp.dc.dc_success === 'half' ? ' (half on success)' : ''}`
  else if (sp.attack_type) save = `${sp.attack_type} attack`
  return {
    id: `spell-${sp.index}`, type: 'spell', name: sp.name,
    level: sp.level, school: sp.school?.name, castingTime: sp.casting_time, range: sp.range,
    components: (sp.components || []).join(', ') + (sp.material ? ` (${clip(sp.material, 80)})` : ''),
    duration: (sp.concentration ? 'Concentration, ' : '') + sp.duration, ritual: sp.ritual || undefined,
    damage, save,
    areaOfEffect: sp.area_of_effect ? `${sp.area_of_effect.size}-ft ${sp.area_of_effect.type}` : undefined,
    classes: (sp.classes || []).map((c) => c.name).join(', ') || undefined,
    text: getText(sp), higherLevel: sp.higher_level?.length ? sp.higher_level.join('\n') : undefined,
  }
}

function makeCondition(c) {
  const t = getText(c)
  return { id: `condition-${c.index}`, type: 'condition', name: c.name, summary: firstSentence(t), text: t.replace(/^-\s*/gm, '') }
}

function equipCategory(e) {
  if (e.equipment_category) return e.category_range || e.equipment_category.name
  const cats = (e.equipment_categories || []).map((c) => c.name)
  return cats.find((n) => /Melee|Ranged/.test(n)) || cats.find((n) => /Armor/.test(n)) || cats[0] || 'Gear'
}
function makeEquipment(e) {
  const card = { id: `equipment-${e.index}`, type: 'equipment', name: e.name, category: equipCategory(e), cost: cost(e.cost), weight: weight(e.weight) }
  if (e.damage) card.damage = `${e.damage.damage_dice} ${e.damage.damage_type?.name?.toLowerCase() || ''}`.trim()
  if (e.two_handed_damage) card.damage += ` (${e.two_handed_damage.damage_dice} two-handed)`
  if (e.armor_class) {
    card.category = (e.equipment_categories || []).map((c) => c.name).find((n) => /Armor/.test(n)) || `${e.armor_category || ''} Armor`.trim()
    let ac = String(e.armor_class.base)
    if (e.armor_class.dex_bonus) ac += ' + Dex' + (e.armor_class.max_bonus ? ` (max ${e.armor_class.max_bonus})` : '')
    card.armorClass = ac
    card.strMin = e.str_minimum || undefined
    card.stealth = e.stealth_disadvantage ? 'Disadvantage' : undefined
  }
  if (e.properties?.length) card.properties = e.properties.map((p) => p.name)
  if (e.mastery?.name) card.mastery = e.mastery.name
  if (e.range?.normal) card.rangeText = `${e.range.normal}${e.range.long ? '/' + e.range.long : ''} ft`
  const t = getText(e)
  if (t) card.text = clip(t, 600)
  return card
}

function makeMagicItem(mi) {
  return { id: `magic-item-${mi.index}`, type: 'magic-item', name: mi.name, category: mi.equipment_category?.name, rarity: mi.rarity?.name, attunement: mi.attunement || undefined, text: clip(getText(mi), 900) }
}

const abilMod = (score) => { const m = Math.floor((score - 10) / 2); return `${score} (${m >= 0 ? '+' : ''}${m})` }
// Saving throws / skills live in `proficiencies` with names like "Saving Throw: DEX".
function profList(m, prefix) {
  const out = (m.proficiencies || [])
    .filter((p) => p.proficiency?.name?.startsWith(prefix))
    .map((p) => `${p.proficiency.name.slice(prefix.length).trim()} ${p.value >= 0 ? '+' : ''}${p.value}`)
  return out.length ? out.join(', ') : undefined
}
function acText(ac) {
  if (!Array.isArray(ac)) return ac
  return ac.map((a) => `${a.value}${a.type && a.type !== 'dex' ? ` (${a.type})` : ''}`).join(' or ')
}
const actionList = (arr) => (arr || []).map((a) => ({ name: a.name, desc: clip(a.desc, 700) }))
function makeMonster(m) {
  return {
    id: `monster-${m.index}`, type: 'monster', name: m.name,
    meta: `${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment}`,
    ac: acText(m.armor_class),
    // Use hit_points_roll ("19d12+133") which includes the CON term; hit_dice omits it.
    hp: m.hit_points ? `${m.hit_points} (${m.hit_points_roll || m.hit_dice})` : undefined,
    speed: m.speed ? Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(', ') : undefined,
    abilities: { STR: abilMod(m.strength), DEX: abilMod(m.dexterity), CON: abilMod(m.constitution), INT: abilMod(m.intelligence), WIS: abilMod(m.wisdom), CHA: abilMod(m.charisma) },
    savingThrows: profList(m, 'Saving Throw:'),
    skills: profList(m, 'Skill:'),
    cr: m.challenge_rating, xp: m.xp,
    senses: m.senses ? Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ') : undefined,
    languages: m.languages || undefined,
    damageResistances: m.damage_resistances?.join(', ') || undefined,
    damageVulnerabilities: m.damage_vulnerabilities?.join(', ') || undefined,
    damageImmunities: m.damage_immunities?.join(', ') || undefined,
    conditionImmunities: m.condition_immunities?.map((c) => c.name).join(', ') || undefined,
    traits: actionList(m.special_abilities),
    actions: actionList(m.actions),
    reactions: actionList(m.reactions),
    legendaryActions: actionList(m.legendary_actions),
  }
}

function makeSkill(s) { return { id: `skill-${s.index}`, type: 'skill', name: s.name, ability: s.ability_score?.name, text: clip(getText(s), 600) } }
function makeRule(r) {
  // Keep table rows (lines starting with "|"); only strip markdown heading markers.
  const text = getText(r).replace(/#{1,6}\s*/g, '')
  return { id: `rule-${r.index}`, type: 'rule', name: r.name, text: clip(text.trim(), 1600) }
}
function makeFeat(f) { return { id: `feat-${f.index}`, type: 'feat', name: f.name, category: f.type ? `${f.type} feat` : 'Feat', text: clip(getText(f), 700) } }
function makePoison(p) { return { id: `poison-${p.index}`, type: 'poison', name: p.name, category: p.type ? `${p.type} poison` : 'Poison', cost: cost(p.cost), text: clip(getText(p), 600) } }
function makeSpecies(s) {
  return { id: `species-${s.index}`, type: 'species', name: s.name, meta: `${s.size} ${s.type}, speed ${s.speed}${typeof s.speed === 'number' ? ' ft' : ''}`, text: (s.traits || []).map((t) => t.name).join(', ') || undefined }
}
function makeMastery(w) { return { id: `mastery-${w.index}`, type: 'weapon-mastery', name: w.name, text: clip(getText(w), 700) } }

// --- alias + change helpers ---------------------------------------------------
const renameByLower = new Map(Object.entries(renames).map(([o, n]) => [o.toLowerCase(), n]))
function applyAliases(cards) {
  for (const c of cards) {
    const newName = renameByLower.get(c.name.toLowerCase())
    if (newName) c.aliases = [...(c.aliases || []), newName]
  }
  return cards
}
function makeChangeCards() {
  return changeCards.map((ch) => ({
    id: `change-${ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
    type: 'change', name: ch.name, aliases: ch.aliases, summary: ch.summary, text: ch.text,
  }))
}
const tagBorrowed = (cards) => cards.map((c) => ({ ...c, fromEdition: '5.1' }))

// --- build 2014 ---------------------------------------------------------------
const cards2014 = applyAliases([
  ...read(dir2014, '5e-SRD-Spells.json').map(makeSpell),
  ...read(dir2014, '5e-SRD-Conditions.json').map(makeCondition),
  ...read(dir2014, '5e-SRD-Equipment.json').map(makeEquipment),
  ...read(dir2014, '5e-SRD-Magic-Items.json').map(makeMagicItem),
  ...read(dir2014, '5e-SRD-Monsters.json').map(makeMonster),
  ...read(dir2014, '5e-SRD-Skills.json').map(makeSkill),
  ...read(dir2014, '5e-SRD-Rule-Sections.json').map(makeRule),
])

// --- build 2024 (native + labeled 5.1 fallback for spells/monsters/rules) ------
const native2024 = [
  ...read(dir2024, '5e-SRD-Conditions.json').map(makeCondition),
  ...read(dir2024, '5e-SRD-Equipment.json').map(makeEquipment),
  ...read(dir2024, '5e-SRD-Magic-Items.json').map(makeMagicItem),
  ...read(dir2024, '5e-SRD-Skills.json').map(makeSkill),
  ...read(dir2024, '5e-SRD-Feats.json').map(makeFeat),
  ...read(dir2024, '5e-SRD-Poisons.json').map(makePoison),
  ...read(dir2024, '5e-SRD-Species.json').map(makeSpecies),
  ...read(dir2024, '5e-SRD-Weapon-Mastery-Properties.json').map(makeMastery),
]
const borrowed2024 = tagBorrowed([
  ...read(dir2014, '5e-SRD-Spells.json').map(makeSpell),
  ...read(dir2014, '5e-SRD-Monsters.json').map(makeMonster),
  ...read(dir2014, '5e-SRD-Rule-Sections.json').map(makeRule),
])
const cards2024 = applyAliases([...native2024, ...borrowed2024, ...(INCLUDE_2024_CHANGES ? makeChangeCards() : [])])

// --- personal cards (profile === 'personal') ----------------------------------
// Authored by you in the git-ignored personal-data/ folder. Kept in SEPARATE
// personal-<edition>.json files so the committed srd-*.json stay SRD-only and safe
// to host publicly. Each card may set "editions": ["2014"] to limit where it shows
// (default: both). See personal-data/README.md for the format.
function loadPersonalCards() {
  const dir = path.join(projectRoot, 'personal-data')
  if (!fs.existsSync(dir)) return { '2014': [], '2024': [] }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const byEdition = { '2014': [], '2024': [] }
  for (const f of files) {
    let arr
    try {
      arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch (e) {
      console.error(`  ! skipping personal-data/${f}: invalid JSON (${e.message})`)
      continue
    }
    for (const raw of Array.isArray(arr) ? arr : []) {
      const editions = Array.isArray(raw.editions) && raw.editions.length ? raw.editions : EDITION_IDS
      const { editions: _drop, ...rest } = raw
      const slug = (raw.name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const card = { id: raw.id || `personal-${raw.type || 'card'}-${slug}`, personal: true, ...rest }
      for (const ed of editions) if (byEdition[ed]) byEdition[ed].push(card)
    }
  }
  return byEdition
}
const personalByEdition = PROFILE === 'personal' ? loadPersonalCards() : { '2014': [], '2024': [] }

// --- write --------------------------------------------------------------------
const outDir = path.join(projectRoot, 'public/data')
fs.mkdirSync(outDir, { recursive: true })
const rm = (p) => fs.existsSync(p) && fs.unlinkSync(p)
rm(path.join(outDir, 'srd.json')) // remove the old single-file dataset if present

// Sanity thresholds — a silently half-empty read() (missing upstream file) would
// otherwise ship a broken dataset. Fail loudly instead.
const MIN_COUNTS = {
  '2014': { spell: 300, monster: 300, equipment: 200, 'magic-item': 300, condition: 10 },
  '2024': { spell: 300, monster: 300, equipment: 150, 'magic-item': 200, feat: 10, poison: 10 },
}
const problems = []

console.log(`Profile: ${PROFILE}`)
for (const [edition, cards] of [['2014', cards2014], ['2024', cards2024]]) {
  const file = path.join(outDir, `srd-${edition}.json`)
  fs.writeFileSync(file, JSON.stringify(cards))
  const byType = {}
  for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1
  const borrowed = cards.filter((c) => c.fromEdition).length
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`srd-${edition}.json: ${cards.length} cards (${kb} KB)${borrowed ? `, ${borrowed} borrowed 5.1` : ''}`)
  console.log('  ', JSON.stringify(byType))

  for (const [type, min] of Object.entries(MIN_COUNTS[edition])) {
    if ((byType[type] || 0) < min) problems.push(`${edition}: ${type} = ${byType[type] || 0} (expected ≥ ${min})`)
  }
  const missingId = cards.find((c) => !c.id || !c.name)
  if (missingId) problems.push(`${edition}: a ${missingId.type} card is missing id/name`)

  // Personal file: written only in the personal profile; purged in the public
  // profile so a subsequent public build can never ship stale custom content.
  const personalFile = path.join(outDir, `personal-${edition}.json`)
  const personal = personalByEdition[edition] || []
  if (PROFILE === 'personal' && personal.length) {
    fs.writeFileSync(personalFile, JSON.stringify(personal))
    console.log(`personal-${edition}.json: ${personal.length} custom cards (git-ignored)`)
  } else {
    rm(personalFile)
  }
}

if (problems.length) {
  console.error('\nData validation FAILED:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('Data validation passed.')
