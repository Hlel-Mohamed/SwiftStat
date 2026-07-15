import { describe, it, expect } from 'vitest'
import { parseAttackQuery } from './query.js'

describe('parseAttackQuery', () => {
  it('returns null for non-attack queries', () => {
    expect(parseAttackQuery('fireball')).toBeNull()
    expect(parseAttackQuery('poisoned')).toBeNull()
  })

  it('rogue with level includes Sneak Attack (once per turn)', () => {
    const r = parseAttackQuery('rogue level 5 18 dex daggers full attack')
    // main 1d4+4, off-hand 1d4, sneak 3d6 (ceil(5/2))
    expect(r.formula).toBe('4 + 2d4 + 3d6')
    expect(r.sneak).toBe('3d6')
    expect(r.abilityUsed).toBe('dex')
  })

  it('infers level from a bare number for Sneak Attack', () => {
    const r = parseAttackQuery('rogue 5 18 dex daggers full attack')
    expect(r.sneak).toBe('3d6')
  })

  it('rogue without a level omits Sneak Attack but notes it', () => {
    const r = parseAttackQuery('rogue 18 dex daggers full attack')
    expect(r.formula).toBe('4 + 2d4')
    expect(r.sneak).toBeNull()
    expect(r.notes.join(' ')).toMatch(/sneak attack/i)
  })

  it('bows force DEX even when only STR is given', () => {
    const r = parseAttackQuery('20 str longbow')
    expect(r.abilityUsed).toBe('dex')
    expect(r.formula).toBe('1d8') // DEX 10 → +0, so no flat mod
  })

  it('two-weapon fighting works for non-rogue classes', () => {
    const r = parseAttackQuery('fighter 16 dex two shortswords full attack')
    expect(r.attacks).toBe(2) // main + off-hand
    expect(r.formula).toBe('3 + 2d6')
  })

  it('fighter Extra Attack scales at 11 and 20', () => {
    expect(parseAttackQuery('fighter level 20 greatsword').attacks).toBe(4)
    expect(parseAttackQuery('fighter level 11 greatsword').attacks).toBe(3)
    expect(parseAttackQuery('fighter level 5 greatsword').attacks).toBe(2)
  })

  it('does not double-count level and ability from the same digits', () => {
    const r = parseAttackQuery('fighter level 20 str greatsword')
    expect(r.level).toBe(20)
    expect(r.abilityScore).toBe(10) // "str" had no number of its own
  })

  it('upgrades versatile weapons wielded two-handed', () => {
    const r = parseAttackQuery('longsword two-handed 16 str')
    expect(r.formula).toBe('3 + 1d10')
  })

  it('tolerates punctuation', () => {
    const r = parseAttackQuery('daggers, full attack rogue level 3 16 dex')
    expect(r).not.toBeNull()
    expect(r.sneak).toBe('2d6')
  })

  it('accepts an ability as a score OR a signed modifier (18 dex == +4 dex)', () => {
    const score = parseAttackQuery('rapier 18 dex')
    const mod = parseAttackQuery('rapier +4 dex')
    expect(score.abilityMod).toBe(4)
    expect(mod.abilityMod).toBe(4)
    expect(mod.abilityUsed).toBe('dex')
    expect(mod.formula).toBe('4 + 1d8')
  })

  it('accepts the modifier before the ability too (dex +4)', () => {
    expect(parseAttackQuery('rapier dex +4').abilityMod).toBe(4)
  })

  it('handles a negative modifier', () => {
    const r = parseAttackQuery('club -1 str')
    expect(r.abilityMod).toBe(-1)
    expect(r.formula).toBe('-1 + 1d4')
  })

  it('does not treat a bare weapon name as an attack query (no weird calc)', () => {
    expect(parseAttackQuery('longsword')).toBeNull()
    expect(parseAttackQuery('dagger')).toBeNull()
    expect(parseAttackQuery('short sword')).toBeNull()
  })

  it('uses a lone signed number as the modifier', () => {
    const r = parseAttackQuery('longsword +3')
    expect(r.abilityMod).toBe(3)
    expect(r.formula).toBe('3 + 1d8')
  })

  it('accepts two-word weapon spellings', () => {
    expect(parseAttackQuery('16 str great sword').weapon).toBe('greatsword')
  })

  it('notes when no ability was given rather than silently using +0', () => {
    const r = parseAttackQuery('greatsword damage')
    expect(r).not.toBeNull()
    expect(r.abilityMod).toBe(0)
    expect(r.notes.join(' ')).toMatch(/assumed \+0/i)
  })
})
