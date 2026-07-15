// Deterministic dice utilities. No randomness needed for the card use-case —
// we report *formulas* and *average* damage, which is what players want when
// deciding an action quickly. (A roller can be added later.)

// Parse "2d6+3" / "1d8" / "4" into { count, sides, flat }.
export function parseDice(expr) {
  const parts = []
  const re = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/gi
  let m
  while ((m = re.exec(expr)) !== null) {
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1
      parts.push({ count: sign * (m[2] ? parseInt(m[2], 10) : 1), sides: parseInt(m[3], 10) })
    } else if (m[5]) {
      const sign = m[4] === '-' ? -1 : 1
      parts.push({ flat: sign * parseInt(m[5], 10) })
    }
  }
  return parts
}

export function averageOfDie(sides) {
  return (sides + 1) / 2
}

// Average total of a parsed dice list.
export function averageDamage(parts) {
  return parts.reduce((sum, p) => {
    if (p.sides) return sum + p.count * averageOfDie(p.sides)
    return sum + (p.flat || 0)
  }, 0)
}

// Render a parsed dice list back into a tidy formula string, e.g. "4 + 2d4".
export function formatDice(parts) {
  const dice = {}
  let flat = 0
  for (const p of parts) {
    if (p.sides) dice[p.sides] = (dice[p.sides] || 0) + p.count
    else flat += p.flat || 0
  }
  const pieces = []
  if (flat) pieces.push(String(flat))
  for (const sides of Object.keys(dice).sort((a, b) => a - b)) {
    if (dice[sides] !== 0) pieces.push(`${dice[sides]}d${sides}`)
  }
  return pieces.length ? pieces.join(' + ') : '0'
}

export const abilityModifier = (score) => Math.floor((score - 10) / 2)

// Proficiency bonus by character level (SRD table).
export function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4)
}
