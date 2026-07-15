// Deterministic natural-language-ish query parser for attack math.
//
// Handles things like:
//   "rogue level 5 18 dex daggers full attack"
//   "level 5 fighter longsword attack"
//   "20 str greatsword"
//   "16 dex longbow"
//
// It is intentionally rule-based (no LLM): fast, offline, and — crucially —
// *correct*. If a query doesn't look like an attack calc, `parseAttackQuery`
// returns null and the app falls back to plain search.

import { abilityModifier, proficiencyBonus, parseDice, formatDice, averageDamage } from './dice.js'
import { parseStats, ABILITY_KEYS } from './parse.js'

// Weapon table. Flags:
//   finesse   → may use the higher of STR/DEX
//   ranged    → DEX is forced (bows never use STR)
//   light     → eligible for two-weapon fighting
//   versatile → alternate damage die when wielded two-handed
//   twoHanded → inherently two-handed (informational)
const WEAPONS = {
  dagger: { damage: '1d4', finesse: true, light: true, thrown: true },
  shortsword: { damage: '1d6', finesse: true, light: true },
  scimitar: { damage: '1d6', finesse: true, light: true },
  rapier: { damage: '1d8', finesse: true },
  longsword: { damage: '1d8', versatile: '1d10' },
  battleaxe: { damage: '1d8', versatile: '1d10' },
  warhammer: { damage: '1d8', versatile: '1d10' },
  greatsword: { damage: '2d6', twoHanded: true },
  greataxe: { damage: '1d12', twoHanded: true },
  maul: { damage: '2d6', twoHanded: true },
  handaxe: { damage: '1d6', light: true, thrown: true },
  mace: { damage: '1d6' },
  club: { damage: '1d4', light: true },
  quarterstaff: { damage: '1d6', versatile: '1d8' },
  spear: { damage: '1d6', versatile: '1d8', thrown: true },
  shortbow: { damage: '1d6', ranged: true, twoHanded: true },
  longbow: { damage: '1d8', ranged: true, twoHanded: true },
}

// Classes that get Extra Attack, and at what level.
const CLASS_INFO = {
  fighter: { extraAttackAt: 5 },
  barbarian: { extraAttackAt: 5 },
  paladin: { extraAttackAt: 5 },
  ranger: { extraAttackAt: 5 },
  monk: { extraAttackAt: 5 },
  rogue: {}, // no Extra Attack; relies on Sneak Attack + two-weapon fighting
}

// Two-word spellings map to a canonical weapon key.
const WEAPON_ALIASES = {
  'short sword': 'shortsword', 'great sword': 'greatsword', 'great axe': 'greataxe',
  'hand axe': 'handaxe', 'war hammer': 'warhammer', 'long bow': 'longbow',
  'short bow': 'shortbow', 'quarter staff': 'quarterstaff',
}

const pluralAttacks = (n) => (n === 1 ? '1 attack' : `${n} attacks`)
const withSign = (n) => `${n >= 0 ? '+' : ''}${n}`

// Number of attacks from Extra Attack (fighter scales further at 11 and 20).
function attacksFromClass(className, level) {
  const info = CLASS_INFO[className]
  if (!info?.extraAttackAt || level == null || level < info.extraAttackAt) return 1
  if (className === 'fighter') {
    if (level >= 20) return 4
    if (level >= 11) return 3
  }
  return 2
}

// `defaults` (from an active character) supply class/level/ability scores when the
// query omits them, so "daggers full attack" can compute a full Sneak-Attack line.
// Anything typed always overrides the character.
export function parseAttackQuery(raw, defaults = {}) {
  const { q, abilities: typed, level: typedLevel, loneMod } = parseStats(raw)

  // --- Weapon (aliases + plural detection for two-weapon fighting) ---
  let weaponName = null
  let usedPlural = false
  for (const [alias, canon] of Object.entries(WEAPON_ALIASES)) {
    if (q.includes(` ${alias} `)) { weaponName = canon; break }
    if (q.includes(` ${alias}s `)) { weaponName = canon; usedPlural = true; break }
  }
  if (!weaponName) {
    for (const name of Object.keys(WEAPONS)) {
      if (q.includes(` ${name} `)) { weaponName = name; break }
      if (q.includes(` ${name}s `)) { weaponName = name; usedPlural = true; break }
    }
  }
  if (!weaponName) return null // no weapon → not an attack query
  const weapon = WEAPONS[weaponName]

  // --- Class (typed, else from the active character) ---
  let typedClass = null
  for (const name of Object.keys(CLASS_INFO)) {
    if (q.includes(` ${name} `)) { typedClass = name; break }
  }
  const className = typedClass ?? defaults.className ?? null
  const level = typedLevel ?? (defaults.level != null ? defaults.level : null)

  // --- Merge abilities: typed wins, else the character's score ---
  const defAbil = defaults.abilities || {}
  const abil = {}
  for (const k of ABILITY_KEYS) {
    if (typed[k]) abil[k] = typed[k]
    else if (defAbil[k] != null) abil[k] = { score: defAbil[k], fromDefault: true }
  }
  const modOfM = (k) => {
    const a = abil[k]
    if (!a) return null
    return a.mod != null ? a.mod : abilityModifier(a.score)
  }

  // --- Ability selection: bows force DEX; finesse takes the better modifier ---
  let abilityUsed
  if (weapon.ranged) {
    abilityUsed = 'dex'
  } else if (weapon.finesse) {
    const s = modOfM('str')
    const d = modOfM('dex')
    if (s != null && d != null) abilityUsed = d >= s ? 'dex' : 'str'
    else if (d != null) abilityUsed = 'dex'
    else if (s != null) abilityUsed = 'str'
    else abilityUsed = 'dex' // finesse with nothing given: assume the Dex weapon
  } else {
    abilityUsed = 'str'
  }

  // Resolve the modifier + how it was expressed (score / modifier / lone / assumed).
  let abilMod
  let abilityScore = null
  let abilityGiven
  const chosen = abil[abilityUsed]
  if (chosen) {
    abilMod = modOfM(abilityUsed)
    abilityScore = chosen.score ?? null
    abilityGiven = chosen.mod != null ? 'modifier' : 'score'
  } else if (loneMod != null) {
    abilMod = loneMod
    abilityGiven = 'modifier'
  } else {
    abilMod = 0
    abilityScore = 10
    abilityGiven = 'assumed'
  }

  // Did the active character fill anything in? (for the "using {name}" note)
  const usedDefaults = Boolean(
    defaults.name &&
      ((!typedClass && defaults.className) ||
        (typedLevel == null && defaults.level != null) ||
        chosen?.fromDefault),
  )

  // --- Damage die: versatile weapons upgrade when wielded two-handed ---
  const twoHandedRequested = /\btwo\s*handed\b|\bversatile\b/.test(q)
  const damageDice = weapon.versatile && twoHandedRequested ? weapon.versatile : weapon.damage

  // --- Attacks ---
  const wantsFull = /\bfull\b/.test(q) || /\battack\b/.test(q)
  const twoWeapon = !!weapon.light && (usedPlural || /\btwo\b|\bdual\b|\btwf\b|\boffhand\b|\boff hand\b/.test(q))
  const attacks = attacksFromClass(className, level)
  const offhand = twoWeapon && wantsFull

  // --- Gate: only produce a calc when the query actually looks like an attack.
  // A bare weapon name ("longsword") should just show the item card — UNLESS a character
  // is active, in which case the weapon + their stats is a deliberate calc.
  const hasTyped = Object.keys(typed).length > 0
  const defaultsActive = Boolean(
    defaults.className || defaults.level != null || (defaults.abilities && Object.keys(defaults.abilities).length),
  )
  const attackWord = /\b(attack|attacks|damage|dmg|hit|full|dual|twf|strike|swing|dpr|dps)\b/.test(q)
  const looksLikeAttack =
    hasTyped || loneMod != null || typedClass != null || typedLevel != null || twoHandedRequested ||
    usedPlural || attackWord || defaultsActive
  if (!looksLikeAttack) return null

  // --- Build damage ---
  const baseParts = parseDice(damageDice)
  const totalParts = []
  for (let i = 0; i < attacks; i++) {
    totalParts.push(...baseParts.map((p) => ({ ...p })))
    if (abilMod) totalParts.push({ flat: abilMod })
  }
  if (offhand) {
    // Off-hand attack adds the weapon dice; you add your ability modifier only if it's negative.
    totalParts.push(...baseParts.map((p) => ({ ...p })))
    if (abilMod < 0) totalParts.push({ flat: abilMod })
  }

  // --- Sneak Attack (rogue, once per turn, finesse/ranged weapon) ---
  const notes = []
  if (abilityGiven === 'assumed') {
    notes.push(`No ${abilityUsed.toUpperCase()} given — assumed +0. Add e.g. "18 ${abilityUsed}" or "+4 ${abilityUsed}".`)
  }
  let sneak = null
  if (className === 'rogue' && (weapon.finesse || weapon.ranged)) {
    if (level != null) {
      sneak = `${Math.ceil(level / 2)}d6`
      totalParts.push(...parseDice(sneak))
      notes.push(`Includes Sneak Attack ${sneak} (once per turn, assumes it applies).`)
    } else {
      notes.push('Add Sneak Attack (⌈level/2⌉d6, once per turn) — give a level to include it.')
    }
  }

  const formula = formatDice(totalParts)
  const avg = averageDamage(totalParts)
  const prof = proficiencyBonus(level ?? 1)
  const toHit = abilMod + prof
  const attackCount = attacks + (offhand ? 1 : 0)

  return {
    kind: 'attack-calc',
    query: raw,
    weapon: weaponName,
    className,
    level,
    character: usedDefaults ? defaults.name : null,
    abilityUsed,
    abilityScore,
    abilityMod: abilMod,
    proficiency: prof,
    toHit,
    attacks: attackCount,
    sneak,
    notes,
    formula,
    average: Math.round(avg * 10) / 10,
    explanation:
      `${pluralAttacks(attackCount)} with ${weaponName} (${damageDice} each` +
      `${offhand ? ', incl. off-hand' : ''}). ` +
      `Uses ${abilityUsed.toUpperCase()} ${
        abilityGiven === 'score' ? `${abilityScore} (${withSign(abilMod)})` : withSign(abilMod)
      }${abilityGiven === 'assumed' ? ' (assumed)' : ''}. ` +
      `To hit ${withSign(toHit)} (prof +${prof}).`,
  }
}
