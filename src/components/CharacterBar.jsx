import { useState } from 'react'

// Classes offered in the form: martial + caster (union of the calculator tables).
const CLASSES = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
]
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const summarize = (c) =>
  `L${c.level} ${cap(c.className)}${c.subclass ? ` · ${c.subclass}` : ''}`

function blank() {
  return { id: null, name: '', className: 'fighter', subclass: '', level: 1, abilities: {} }
}

function CharForm({ value, onSubmit, onCancel }) {
  const [c, setC] = useState({ ...blank(), ...value, abilities: { ...value.abilities } })
  const set = (patch) => setC((prev) => ({ ...prev, ...patch }))
  const setAbil = (k, v) => setC((prev) => ({ ...prev, abilities: { ...prev.abilities, [k]: v } }))

  function submit(e) {
    e.preventDefault()
    const abilities = {}
    for (const k of ABILITIES) {
      const n = parseInt(c.abilities[k], 10)
      if (Number.isFinite(n)) abilities[k] = n
    }
    onSubmit({
      id: c.id || crypto.randomUUID(),
      name: c.name.trim() || 'Character',
      className: c.className,
      subclass: c.subclass.trim(),
      level: Math.max(1, Math.min(20, parseInt(c.level, 10) || 1)),
      abilities,
    })
  }

  return (
    <form className="char-form" onSubmit={submit}>
      <div className="char-form-row">
        <input
          className="char-name"
          placeholder="Name"
          value={c.name}
          onChange={(e) => set({ name: e.target.value })}
          autoFocus
        />
        <select value={c.className} onChange={(e) => set({ className: e.target.value })} aria-label="Class">
          {CLASSES.map((cl) => (
            <option key={cl} value={cl}>{cap(cl)}</option>
          ))}
        </select>
        <input
          className="char-level"
          type="number"
          min="1"
          max="20"
          value={c.level}
          onChange={(e) => set({ level: e.target.value })}
          aria-label="Level"
        />
      </div>
      <input
        className="char-subclass"
        placeholder="Subclass (optional)"
        value={c.subclass}
        onChange={(e) => set({ subclass: e.target.value })}
      />
      <div className="char-abilities">
        {ABILITIES.map((k) => (
          <label key={k} className="char-abil">
            <span>{k.toUpperCase()}</span>
            <input
              type="number"
              min="1"
              max="30"
              placeholder="10"
              value={c.abilities[k] ?? ''}
              onChange={(e) => setAbil(k, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="char-form-actions">
        <button type="submit" className="chip primary">Save</button>
        <button type="button" className="chip" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export function CharacterBar({ characters, activeId, onSetActive, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const active = characters.find((c) => c.id === activeId)

  return (
    <details className="charbar">
      <summary>{active ? `▾ ${active.name}` : '▾ Character'}</summary>
      <div className="charbar-panel">
        <div className="char-list">
          <button
            className={`char-pick ${!activeId ? 'active' : ''}`}
            onClick={() => onSetActive('')}
          >
            No character
          </button>
          {characters.map((c) => (
            <div key={c.id} className="char-row">
              <button
                className={`char-pick ${activeId === c.id ? 'active' : ''}`}
                onClick={() => onSetActive(c.id)}
              >
                {c.name} <span className="muted small">{summarize(c)}</span>
              </button>
              <button className="char-icon" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>✎</button>
              <button className="char-icon" onClick={() => onDelete(c.id)} aria-label={`Delete ${c.name}`}>✕</button>
            </div>
          ))}
        </div>
        {editing ? (
          <CharForm
            value={editing}
            onSubmit={(ch) => { onSave(ch); setEditing(null) }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button className="chip" onClick={() => setEditing(blank())}>+ Add character</button>
        )}
      </div>
    </details>
  )
}
