import { describe, it, expect } from 'vitest'
import { parseDice, averageDamage, formatDice, abilityModifier, proficiencyBonus } from './dice.js'

describe('parseDice', () => {
  it('parses dice + flat', () => {
    expect(parseDice('2d6+3')).toEqual([{ count: 2, sides: 6 }, { flat: 3 }])
  })
  it('parses a bare number', () => {
    expect(parseDice('4')).toEqual([{ flat: 4 }])
  })
  it('handles negatives', () => {
    expect(parseDice('1d8-1')).toEqual([{ count: 1, sides: 8 }, { flat: -1 }])
  })
  it('rejects non-string input', () => {
    expect(parseDice(undefined)).toEqual([])
    expect(parseDice(null)).toEqual([])
  })
  it('guards zero/negative-sided dice', () => {
    expect(parseDice('d0')).toEqual([])
  })
  it('does not merge a spaced die ("2 d6" is 2 and 1d6, not 2d6)', () => {
    // count and sides must be adjacent
    expect(parseDice('2 d6')).toEqual([{ flat: 2 }, { count: 1, sides: 6 }])
  })
})

describe('averageDamage / formatDice', () => {
  it('averages dice + flat', () => {
    expect(averageDamage(parseDice('2d6+3'))).toBe(10) // 7 + 3
  })
  it('formats a tidy formula', () => {
    expect(formatDice(parseDice('1d4+4+1d4'))).toBe('4 + 2d4')
  })
})

describe('abilityModifier / proficiencyBonus', () => {
  it('computes modifiers', () => {
    expect(abilityModifier(18)).toBe(4)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(7)).toBe(-2)
  })
  it('computes proficiency by level (SRD table)', () => {
    expect(proficiencyBonus(1)).toBe(2)
    expect(proficiencyBonus(5)).toBe(3)
    expect(proficiencyBonus(20)).toBe(6)
  })
})
