const TYPE_LABEL = {
  spell: 'Spell',
  condition: 'Condition',
  equipment: 'Equipment',
  action: 'Action',
  monster: 'Monster',
  'magic-item': 'Magic Item',
  rule: 'Rule',
  skill: 'Skill',
  change: '5.2.1',
  poison: 'Poison',
  species: 'Species',
  feat: 'Feat',
  'weapon-mastery': 'Mastery',
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{value}</span>
    </div>
  )
}

// Preserve line breaks from the source text without dangerouslySetInnerHTML.
function Body({ text }) {
  if (!text) return null
  return <p className="body">{text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
}

function AbilityGrid({ abilities }) {
  return (
    <div className="abilities">
      {Object.entries(abilities).map(([k, v]) => (
        <div key={k} className="ability">
          <span className="ability-name">{k}</span>
          <span className="ability-val">{v}</span>
        </div>
      ))}
    </div>
  )
}

export function Card({ entry }) {
  return (
    <article className={`card card-${entry.type}`}>
      <header className="card-head">
        <h2>{entry.name}</h2>
        <span className="badges">
          {entry.fromEdition && (
            <span className="badge-51" title="Shown from 5e (2014) — not in the 2024 SRD">{entry.fromEdition}</span>
          )}
          <span className="badge">{TYPE_LABEL[entry.type] || entry.type}</span>
        </span>
      </header>

      {entry.type === 'spell' && (
        <>
          <p className="subtitle">
            {entry.level === 0 ? 'Cantrip' : `Level ${entry.level}`} {entry.school}
            {entry.ritual ? ' · Ritual' : ''}
          </p>
          <Row label="Cast" value={entry.castingTime} />
          <Row label="Range" value={entry.range} />
          <Row label="Damage" value={entry.damage} />
          <Row label="Save" value={entry.save} />
          <Row label="Area" value={entry.areaOfEffect} />
          <Row label="Duration" value={entry.duration} />
          <Row label="Components" value={entry.components} />
          <Row label="Classes" value={entry.classes} />
        </>
      )}

      {entry.type === 'equipment' && (
        <>
          <p className="subtitle">{entry.category}</p>
          <Row label="Damage" value={entry.damage} />
          <Row label="Range" value={entry.rangeText} />
          <Row label="Armor Class" value={entry.armorClass} />
          <Row label="Str min" value={entry.strMin} />
          <Row label="Stealth" value={entry.stealth} />
          <Row label="Cost" value={entry.cost} />
          <Row label="Weight" value={entry.weight} />
          <Row label="Properties" value={entry.properties?.join(', ')} />
          <Row label="Mastery" value={entry.mastery} />
        </>
      )}

      {entry.type === 'magic-item' && (
        <p className="subtitle">
          {[entry.category, entry.rarity, entry.attunement ? 'requires attunement' : null].filter(Boolean).join(' · ')}
        </p>
      )}

      {entry.type === 'skill' && <p className="subtitle">{entry.ability} skill</p>}
      {entry.type === 'feat' && <p className="subtitle">{entry.category}</p>}
      {entry.type === 'poison' && (
        <p className="subtitle">{[entry.category, entry.cost].filter(Boolean).join(' · ')}</p>
      )}
      {entry.type === 'species' && <p className="subtitle">{entry.meta}</p>}

      {entry.type === 'monster' && (
        <>
          <p className="subtitle">{entry.meta}</p>
          <Row label="AC" value={entry.ac} />
          <Row label="HP" value={entry.hp} />
          <Row label="Speed" value={entry.speed} />
          <Row label="CR" value={entry.cr != null ? `${entry.cr} (${entry.xp} XP)` : null} />
          {entry.abilities && <AbilityGrid abilities={entry.abilities} />}
          <Row label="Senses" value={entry.senses} />
          <Row label="Languages" value={entry.languages} />
          <Row label="Dmg. immun." value={entry.damageImmunities} />
          <Row label="Cond. immun." value={entry.conditionImmunities} />
          {entry.traits?.map((t, i) => (
            <p key={i} className="body"><strong>{t.name}.</strong> {t.desc}</p>
          ))}
          {entry.actions?.length > 0 && <p className="section-label">Actions</p>}
          {entry.actions?.map((a, i) => (
            <p key={i} className="body"><strong>{a.name}.</strong> {a.desc}</p>
          ))}
        </>
      )}

      {(entry.type === 'condition' || entry.type === 'action' || entry.type === 'change') && entry.summary && (
        <p className="summary">{entry.summary}</p>
      )}

      {entry.type !== 'monster' && <Body text={entry.text} />}
      {entry.higherLevel && (
        <p className="body">
          <strong>At higher levels:</strong> {entry.higherLevel}
        </p>
      )}
    </article>
  )
}

export function AttackCard({ calc }) {
  return (
    <article className="card card-calc">
      <header className="card-head">
        <h2>{calc.formula}</h2>
        <span className="badge">Attack</span>
      </header>
      <p className="subtitle">avg {calc.average} damage · to hit +{calc.toHit} · {calc.attacks}×</p>
      <p className="body">{calc.explanation}</p>
      <p className="muted small">Deterministic calc — no AI, computed from SRD rules.</p>
    </article>
  )
}
