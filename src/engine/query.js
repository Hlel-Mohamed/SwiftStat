// Deterministic natural-language-ish query parser for attack math.
//
// Handles things like:
//   "rogue 18 dex daggers full attack"
//   "level 5 fighter longsword attack"
//   "20 str greatsword"
//
// It is intentionally rule-based (no LLM): fast, offline, and — crucially —
// *correct*. If a query doesn't look like an attack calc, `parseAttackQuery`
// returns null and the app falls back to plain search.

import {
  abilityModifier,
  proficiencyBonus,
  parseDice,
  formatDice,
  averageDamage,
} from './dice.js'

// Minimal weapon table (extend from SRD equipment as needed).
const WEAPONS = {
  dagger: { damage: '1d4', finesse: true, light: true },
  daggers: { damage: '1d4', finesse: true, light: true },
  shortsword: { damage: '1d6', finesse: true, light: true },
  scimitar: { damage: '1d6', finesse: true, light: true },
  rapier: { damage: '1d8', finesse: true },
  longsword: { damage: '1d8' },
  greatsword: { damage: '2d6' },
  greataxe: { damage: '1d12' },
  handaxe: { damage: '1d6', light: true },
  shortbow: { damage: '1d6', ranged: true, dex: true },
  longbow: { damage: '1d8', ranged: true, dex: true },
  club: { damage: '1d4', light: true },
  mace: { damage: '1d6' },
  quarterstaff: { damage: '1d6' },
}

// Classes that get Extra Attack, and at what level, plus notable damage riders.
const CLASS_INFO = {
  fighter: { extraAttackAt: 5 }, // (SRD fighter gets more at 11/20; kept simple here)
  barbarian: { extraAttackAt: 5 },
  paladin: { extraAttackAt: 5 },
  ranger: { extraAttackAt: 5 },
  monk: { extraAttackAt: 5 },
  rogue: {}, // no extra attack; relies on Sneak Attack + two-weapon
}

function pluralAttacks(n) {
  return n === 1 ? '1 attack' : `${n} attacks`
}

export function parseAttackQuery(raw) {
  const q = ` ${raw.toLowerCase()} `

  // Weapon
  let weaponName = null
  for (const name of Object.keys(WEAPONS)) {
    if (q.includes(` ${name} `) || q.includes(` ${name}s `)) {
      weaponName = name.replace(/s$/, '')
      break
    }
  }
  if (!weaponName) return null // not an attack query we understand

  const weapon = WEAPONS[weaponName] || WEAPONS[weaponName + 's']
  if (!weapon) return null

  // Class
  let className = null
  for (const name of Object.keys(CLASS_INFO)) {
    if (q.includes(` ${name} `)) {
      className = name
      break
    }
  }

  // Level: "level 5" / "lvl 5" / "5th"
  let level = null
  const lvlMatch = q.match(/(?:level|lvl)\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\b/)
  if (lvlMatch) level = parseInt(lvlMatch[1] || lvlMatch[2], 10)

  // Ability scores: "18 dex", "str 20", "16 strength"
  const abilities = {}
  const abilRe = /(\d+)\s*(str|dex|con|int|wis|cha|strength|dexterity)|(str|dex|con|int|wis|cha|strength|dexterity)\s*(\d+)/g
  let am
  while ((am = abilRe.exec(q)) !== null) {
    const key = (am[2] || am[3]).slice(0, 3)
    const val = parseInt(am[1] || am[4], 10)
    abilities[key] = val
  }

  // Choose ability: finesse/ranged can use dex; else str. Prefer whichever was given.
  const canUseDex = weapon.finesse || weapon.ranged || weapon.dex
  let abilityUsed = 'str'
  if (canUseDex && abilities.dex != null && (abilities.str == null || abilities.dex >= abilities.str)) {
    abilityUsed = 'dex'
  } else if (abilities.str != null) {
    abilityUsed = 'str'
  } else if (canUseDex && abilities.dex != null) {
    abilityUsed = 'dex'
  }
  const abilityScore = abilities[abilityUsed] ?? 10
  const abilMod = abilityModifier(abilityScore)

  // Number of attacks
  const wantsFull = /\bfull\b|\bfull attack\b/.test(q) || /\battack\b/.test(q)
  const twoWeapon = weapon.light && (q.includes('two') || q.includes('dual') || weaponName === 'dagger')
  let attacks = 1
  if (className && CLASS_INFO[className].extraAttackAt && level != null && level >= CLASS_INFO[className].extraAttackAt) {
    attacks = 2
  }
  // Rogue "full attack" with a light weapon → main hand + off-hand (two-weapon fighting).
  let offhand = false
  if (className === 'rogue' && twoWeapon && wantsFull) {
    offhand = true
  }

  // Build damage. Each attack: weapon dice + ability mod (off-hand gets no mod by default).
  const baseParts = parseDice(weapon.damage)
  const mainParts = [...baseParts, { flat: abilMod }]
  const totalParts = []
  for (let i = 0; i < attacks; i++) totalParts.push(...mainParts.map((p) => ({ ...p })))
  if (offhand) totalParts.push(...baseParts.map((p) => ({ ...p }))) // off-hand: no ability mod

  const formula = formatDice(totalParts)
  const avg = averageDamage(totalParts)

  // To-hit
  const prof = level != null ? proficiencyBonus(level) : 2
  const toHit = abilMod + prof

  const attackCount = attacks + (offhand ? 1 : 0)

  return {
    kind: 'attack-calc',
    query: raw,
    weapon: weaponName,
    className,
    level,
    abilityUsed,
    abilityScore,
    abilityMod: abilMod,
    proficiency: prof,
    toHit,
    attacks: attackCount,
    formula,
    average: Math.round(avg * 10) / 10,
    explanation:
      `${pluralAttacks(attackCount)} with ${weaponName} (${weapon.damage} each). ` +
      `Uses ${abilityUsed.toUpperCase()} ${abilityScore} (${abilMod >= 0 ? '+' : ''}${abilMod}). ` +
      `To hit +${toHit} (prof +${prof})${offhand ? '. Off-hand attack adds weapon dice with no ability modifier.' : '.'}`,
  }
}
