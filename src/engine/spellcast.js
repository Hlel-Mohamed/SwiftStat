// Deterministic spellcaster stat calculator: spell save DC and spell attack bonus.
//   DC        = 8 + proficiency bonus + spellcasting-ability modifier
//   attack    =     proficiency bonus + spellcasting-ability modifier
// Reuses the shared score/modifier parsing, so "wizard 18 int level 5" and
// "cleric +3 wis lvl 7" both work. Returns null unless the query clearly concerns
// casting (a caster class or a casting keyword) AND supplies an ability.
import { abilityModifier, proficiencyBonus } from './dice.js'
import { parseStats, ABILITY_KEYS } from './parse.js'

// Caster class → [short ability key, display name].
const CASTERS = {
  wizard: ['int', 'Intelligence'],
  artificer: ['int', 'Intelligence'],
  cleric: ['wis', 'Wisdom'],
  druid: ['wis', 'Wisdom'],
  ranger: ['wis', 'Wisdom'],
  sorcerer: ['cha', 'Charisma'],
  bard: ['cha', 'Charisma'],
  warlock: ['cha', 'Charisma'],
  paladin: ['cha', 'Charisma'],
}

const withSign = (n) => `${n >= 0 ? '+' : ''}${n}`

// `defaults` (from an active character) supply class/level/ability when the query omits
// them. Intent is still required (a typed caster class or a casting keyword) — an active
// character only fills in the numbers, so a bare search never spawns a DC card.
export function parseCasterQuery(raw, defaults = {}) {
  const { q, abilities: typed, level: typedLevel, loneMod } = parseStats(raw)

  let typedClass = null
  for (const name of Object.keys(CASTERS)) {
    if (q.includes(` ${name} `)) { typedClass = name; break }
  }
  const castingKeyword = /\b(spell|spells|spellcast\w*|cast|casting|dc|save dc|spell save|spell attack)\b/.test(q)
  if (!(typedClass || castingKeyword)) return null

  // Use the active character's class only if it's a caster.
  const className = typedClass ?? (defaults.className && CASTERS[defaults.className] ? defaults.className : null)
  const level = typedLevel ?? (defaults.level != null ? defaults.level : null)

  // Merge abilities: typed wins, else the character's score.
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

  // Choose the spellcasting ability: the class's ability if we have it, else any provided,
  // else a lone modifier. If nothing resolves, we can't compute a DC.
  let abilityKey = className ? CASTERS[className][0] : null
  let mod
  let score = null
  let given
  let fromDefault = false
  if (abilityKey && abil[abilityKey]) {
    mod = modOfM(abilityKey)
    score = abil[abilityKey].score ?? null
    given = abil[abilityKey].mod != null ? 'modifier' : 'score'
    fromDefault = Boolean(abil[abilityKey].fromDefault)
  } else if (Object.keys(typed).length) {
    const key = Object.keys(typed)[0]
    abilityKey = key
    mod = modOfM(key)
    score = typed[key].score ?? null
    given = typed[key].mod != null ? 'modifier' : 'score'
  } else if (loneMod != null) {
    mod = loneMod
    given = 'modifier'
  } else {
    return null // nothing to compute a DC from
  }

  const prof = proficiencyBonus(level ?? 1)
  const saveDC = 8 + prof + mod
  const spellAttack = prof + mod
  const abilityName = className ? CASTERS[className][1] : (abilityKey ? abilityKey.toUpperCase() : 'spellcasting')

  const notes = []
  if (level == null) notes.push('Proficiency assumes level 1 (+2) — add a level to scale it.')

  const usedDefaults = Boolean(
    defaults.name &&
      ((!typedClass && className) || (typedLevel == null && defaults.level != null) || fromDefault),
  )

  return {
    kind: 'caster-calc',
    query: raw,
    className,
    level,
    character: usedDefaults ? defaults.name : null,
    abilityKey,
    abilityName,
    abilityScore: score,
    abilityMod: mod,
    proficiency: prof,
    saveDC,
    spellAttack,
    notes,
    explanation:
      `Spell save DC ${saveDC} · spell attack ${withSign(spellAttack)}. ` +
      `${abilityName} ${given === 'score' ? `${score} (${withSign(mod)})` : withSign(mod)}` +
      `, proficiency +${prof}${level != null ? ` (level ${level})` : ''}. ` +
      `DC = 8 + prof + mod; attack = prof + mod.`,
  }
}
