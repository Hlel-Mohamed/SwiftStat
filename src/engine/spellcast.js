// Deterministic spellcaster stat calculator: spell save DC and spell attack bonus.
//   DC        = 8 + proficiency bonus + spellcasting-ability modifier
//   attack    =     proficiency bonus + spellcasting-ability modifier
// Reuses the shared score/modifier parsing, so "wizard 18 int level 5" and
// "cleric +3 wis lvl 7" both work. Returns null unless the query clearly concerns
// casting (a caster class or a casting keyword) AND supplies an ability.
import { proficiencyBonus } from './dice.js'
import { parseStats } from './parse.js'

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

export function parseCasterQuery(raw) {
  const { q, abilities, modOf, level, loneMod } = parseStats(raw)

  let className = null
  for (const name of Object.keys(CASTERS)) {
    if (q.includes(` ${name} `)) {
      className = name
      break
    }
  }
  const castingKeyword = /\b(spell|spells|spellcast\w*|cast|casting|dc|save dc|spell save|spell attack)\b/.test(q)
  const hasAbility = Object.keys(abilities).length > 0

  // Gate: must be about casting AND provide an ability (DC/attack are meaningless
  // without one). Keeps a bare "wizard" or "18 int" out of the calculator.
  if (!(className || castingKeyword)) return null
  if (!(hasAbility || loneMod != null)) return null

  // Choose the spellcasting ability. Prefer the class's ability if its value was given;
  // otherwise fall back to any ability provided, then a lone modifier.
  let abilityKey = className ? CASTERS[className][0] : null
  let mod
  let score = null
  let given
  if (abilityKey && abilities[abilityKey]) {
    mod = modOf(abilityKey)
    score = abilities[abilityKey].score ?? null
    given = abilities[abilityKey].mod != null ? 'modifier' : 'score'
  } else if (hasAbility) {
    // Use whichever ability was provided (e.g. "18 int spell dc" with no class).
    const key = abilityKey && abilities[abilityKey] ? abilityKey : Object.keys(abilities)[0]
    abilityKey = key
    mod = modOf(key)
    score = abilities[key].score ?? null
    given = abilities[key].mod != null ? 'modifier' : 'score'
  } else {
    mod = loneMod
    given = 'modifier'
  }

  const prof = proficiencyBonus(level ?? 1)
  const saveDC = 8 + prof + mod
  const spellAttack = prof + mod
  const abilityName = className ? CASTERS[className][1] : (abilityKey ? abilityKey.toUpperCase() : 'spellcasting')

  const notes = []
  if (level == null) notes.push('Proficiency assumes level 1 (+2) — add a level to scale it.')

  return {
    kind: 'caster-calc',
    query: raw,
    className,
    level,
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
