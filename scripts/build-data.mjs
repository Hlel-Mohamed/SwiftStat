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
function makeMonster(m) {
  const ac = Array.isArray(m.armor_class) ? m.armor_class[0]?.value : m.armor_class
  return {
    id: `monster-${m.index}`, type: 'monster', name: m.name,
    meta: `${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment}`,
    ac, hp: m.hit_points ? `${m.hit_points} (${m.hit_dice})` : undefined,
    speed: m.speed ? Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(', ') : undefined,
    abilities: { STR: abilMod(m.strength), DEX: abilMod(m.dexterity), CON: abilMod(m.constitution), INT: abilMod(m.intelligence), WIS: abilMod(m.wisdom), CHA: abilMod(m.charisma) },
    cr: m.challenge_rating, xp: m.xp,
    senses: m.senses ? Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ') : undefined,
    languages: m.languages || undefined,
    damageImmunities: m.damage_immunities?.join(', ') || undefined,
    conditionImmunities: m.condition_immunities?.map((c) => c.name).join(', ') || undefined,
    traits: (m.special_abilities || []).map((a) => ({ name: a.name, desc: clip(a.desc, 400) })),
    actions: (m.actions || []).map((a) => ({ name: a.name, desc: clip(a.desc, 400) })),
  }
}

function makeSkill(s) { return { id: `skill-${s.index}`, type: 'skill', name: s.name, ability: s.ability_score?.name, text: clip(getText(s), 600) } }
function makeRule(r) {
  const text = getText(r).split('\n').filter((l) => !l.trim().startsWith('|')).join('\n').replace(/#{1,6}\s*/g, '')
  return { id: `rule-${r.index}`, type: 'rule', name: r.name, text: clip(text.trim(), 900) }
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

// --- write --------------------------------------------------------------------
const outDir = path.join(projectRoot, 'public/data')
fs.mkdirSync(outDir, { recursive: true })
// Remove the old single-file dataset if present.
const legacy = path.join(outDir, 'srd.json')
if (fs.existsSync(legacy)) fs.unlinkSync(legacy)

for (const [edition, cards] of [['2014', cards2014], ['2024', cards2024]]) {
  const file = path.join(outDir, `srd-${edition}.json`)
  fs.writeFileSync(file, JSON.stringify(cards))
  const byType = {}
  for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1
  const borrowed = cards.filter((c) => c.fromEdition).length
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`srd-${edition}.json: ${cards.length} cards (${kb} KB)${borrowed ? `, ${borrowed} borrowed 5.1` : ''}`)
  console.log('  ', JSON.stringify(byType))
}
