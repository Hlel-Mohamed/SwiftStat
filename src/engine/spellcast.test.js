import { describe, it, expect } from 'vitest'
import { parseCasterQuery } from './spellcast.js'

describe('parseCasterQuery', () => {
  it('computes DC and spell attack from class + score + level', () => {
    const r = parseCasterQuery('wizard 18 int level 5')
    // mod +4, prof +3 → DC 8+3+4=15, attack 3+4=7
    expect(r.saveDC).toBe(15)
    expect(r.spellAttack).toBe(7)
    expect(r.abilityName).toBe('Intelligence')
  })

  it('accepts a signed modifier and a keyword without a class', () => {
    const r = parseCasterQuery('spell save dc +3 wis lvl 7')
    // prof +3 at level 7, mod +3 → DC 8+3+3=14
    expect(r.saveDC).toBe(14)
    expect(r.spellAttack).toBe(6)
  })

  it('picks the class casting ability even if other abilities are present', () => {
    const r = parseCasterQuery('cleric 20 wis 8 str level 9')
    // wis +5, prof +4 → DC 8+4+5=17
    expect(r.abilityName).toBe('Wisdom')
    expect(r.saveDC).toBe(17)
  })

  it('defaults proficiency to level 1 and notes it when no level given', () => {
    const r = parseCasterQuery('sorcerer 16 cha')
    // mod +3, prof +2 → DC 13
    expect(r.saveDC).toBe(13)
    expect(r.notes.join(' ')).toMatch(/level 1/i)
  })

  it('does not fire on a bare class name or a bare ability', () => {
    expect(parseCasterQuery('wizard')).toBeNull()
    expect(parseCasterQuery('18 int')).toBeNull()
    expect(parseCasterQuery('fireball')).toBeNull()
  })

  describe('character defaults (auto-fill)', () => {
    const wiz = { name: 'Tas', className: 'wizard', level: 5, abilities: { int: 18 } }

    it('fills DC/attack from an active caster given a casting keyword', () => {
      const r = parseCasterQuery('spell save dc', wiz)
      expect(r.saveDC).toBe(15) // 8 + prof 3 + int mod 4
      expect(r.spellAttack).toBe(7)
      expect(r.character).toBe('Tas')
    })

    it('still needs casting intent — a bare search does not fire', () => {
      expect(parseCasterQuery('goblin', wiz)).toBeNull()
      expect(parseCasterQuery('', wiz)).toBeNull()
    })

    it('does not use a non-caster character class', () => {
      const barb = { name: 'Grok', className: 'barbarian', level: 5, abilities: { str: 18 } }
      // "spell dc" keyword fires, but barbarian has no casting ability and no ability was
      // typed → nothing to compute → null.
      expect(parseCasterQuery('spell dc', barb)).toBeNull()
    })
  })
})
