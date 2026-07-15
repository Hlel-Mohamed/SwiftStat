// Shared query tokenizer for the deterministic calculators (attacks + spellcasting).
// Handles level + ability parsing consistently, including the two ability forms:
//   score    — unsigned, e.g. "18 dex"  → mod = floor((18-10)/2)
//   modifier — signed,   e.g. "+4 dex"  → mod = +4
import { abilityModifier } from './dice.js'

export const ABILITY_WORDS =
  'str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma'

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export function parseStats(raw) {
  const lower = ` ${raw.toLowerCase()} `
  // `q` strips all punctuation (word matching); `qs` keeps + and - (ability modifiers).
  const q = ` ${lower.replace(/[^a-z0-9]+/g, ' ').trim()} `
  const qs = ` ${lower.replace(/[^a-z0-9+-]+/g, ' ').trim()} `

  let work = qs
  let level = null
  const lvl = work.match(/(?:level|lvl|lv)\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\b/)
  if (lvl) {
    level = parseInt(lvl[1] || lvl[2], 10)
    work = work.replace(lvl[0], ' ')
  }

  const abilities = {} // key -> { score } | { mod }
  const abilRe = new RegExp(`([+-]?\\d+)\\s*(${ABILITY_WORDS})|(${ABILITY_WORDS})\\s*([+-]?\\d+)`, 'g')
  let am
  while ((am = abilRe.exec(work)) !== null) {
    const key = (am[2] || am[3]).slice(0, 3)
    const numStr = am[1] ?? am[4]
    abilities[key] = /^[+-]/.test(numStr) ? { mod: parseInt(numStr, 10) } : { score: parseInt(numStr, 10) }
  }
  work = work.replace(abilRe, ' ')

  // A lone signed number (not attached to an ability) is a bare modifier ("rapier +7").
  let loneMod = null
  const lone = work.match(/(?:^|\s)([+-]\d+)(?=\s)/)
  if (lone) loneMod = parseInt(lone[1], 10)

  // Strip signed numbers, then a leftover bare (unsigned) number is the level.
  const forLevel = work.replace(/[+-]\d+/g, ' ')
  if (level == null) {
    const bare = forLevel.match(/\b(\d+)\b/)
    if (bare) level = parseInt(bare[1], 10)
  }

  const modOf = (key) => {
    const a = abilities[key]
    if (!a) return null
    return a.mod != null ? a.mod : abilityModifier(a.score)
  }

  return { q, qs, abilities, modOf, level, loneMod }
}
