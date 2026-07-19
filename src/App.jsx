import { useEffect, useMemo, useState } from 'react'
import { loadIndex, search, EDITIONS, DEFAULT_EDITION, PROFILE } from './engine/search.js'
import { parseAttackQuery } from './engine/query.js'
import { parseCasterQuery } from './engine/spellcast.js'
import { useVoice } from './hooks/useVoice.js'
import { useInstallPrompt } from './hooks/useInstallPrompt.js'
import { Card, AttackCard, SpellCastCard } from './components/Card.jsx'
import { CharacterBar } from './components/CharacterBar.jsx'
import './App.css'

// Delay after the last keystroke before searching, so results don't churn mid-word.
const SEARCH_DEBOUNCE_MS = 350

// Grouped starter queries — the empty state that teaches what SwiftStat can do.
const EXAMPLE_GROUPS = [
  {
    label: 'Look things up',
    hint: 'spells, monsters, conditions, items, feats…',
    items: ['fireball', 'poisoned', 'goblin', 'longsword', 'bag of holding'],
  },
  {
    label: 'Attack damage',
    hint: 'type your weapon + stats → instant math',
    items: ['20 str greatsword', 'rogue level 5 18 dex daggers full attack', '+4 dex rapier'],
  },
  {
    label: 'Spell save DC',
    hint: 'class + ability + level → DC & spell attack',
    items: ['wizard 18 int level 5', 'cleric +3 wis'],
  },
]

// Reference guide shown in the "How to search" panel.
const HELP = [
  { title: 'Search anything', body: 'Type a name — fireball, goblin, longsword, grappled — for an instant stat card. Monster trait/action text is searchable too (try multiattack).' },
  { title: 'Attack math, no dice', body: 'Type a weapon with your stats: 20 str greatsword or rogue level 5 18 dex daggers full attack. Give ability as a score (18 dex) or a modifier (+4 dex).' },
  { title: 'Spell DC & attack', body: 'Type a caster + ability + level: wizard 18 int level 5 → spell save DC and spell attack bonus.' },
  { title: 'Upcasting', body: 'Damage spells show a table of damage at every slot level (and cantrips by character level) right on the card.' },
  { title: 'Characters', body: 'Save a character (top-right) and the attack/spell math auto-fills their stats — then just type the weapon or spell.' },
  { title: 'Filters & editions', body: 'Hide categories (e.g. Monsters, to avoid metagaming) under “Categories”, and switch 5e (2014) / 5.5 (2024) at the top.' },
]

// Plural category labels + a stable display order for the filter checkboxes.
const CATEGORY_LABELS = {
  spell: 'Spells', monster: 'Monsters', condition: 'Conditions', equipment: 'Equipment',
  'magic-item': 'Magic Items', feat: 'Feats', species: 'Species', poison: 'Poisons',
  'weapon-mastery': 'Masteries', skill: 'Skills', rule: 'Rules', subclass: 'Subclasses',
  change: '5.2.1 Changes',
}
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

function initialEdition() {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem('swiftstat-edition')
  return saved && EDITIONS[saved] ? saved : DEFAULT_EDITION
}

function initialHidden() {
  try {
    const raw = localStorage.getItem('swiftstat-hidden')
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function initialCharacters() {
  try {
    const raw = localStorage.getItem('swiftstat-characters')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function initialActiveChar() {
  try {
    return localStorage.getItem('swiftstat-active-char') || ''
  } catch {
    return ''
  }
}
function initialHelpOpen() {
  try {
    return localStorage.getItem('swiftstat-seen-help') !== '1'
  } catch {
    return true
  }
}
function initialInstallDismissed() {
  try {
    return localStorage.getItem('swiftstat-install-dismissed') === '1'
  } catch {
    return false
  }
}
const save = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage disabled — keep in-memory state anyway */
  }
}

export default function App() {
  const [query, setQuery] = useState('')
  const [edition, setEdition] = useState(initialEdition)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [count, setCount] = useState(0)
  const [types, setTypes] = useState({}) // type -> count in the active edition
  const [hidden, setHidden] = useState(initialHidden) // category types the user hid
  const [characters, setCharacters] = useState(initialCharacters)
  const [activeChar, setActiveChar] = useState(initialActiveChar)
  const [helpOpen, setHelpOpen] = useState(initialHelpOpen)
  const [installDismissed, setInstallDismissed] = useState(initialInstallDismissed)
  const { canInstall, iosHint, promptInstall } = useInstallPrompt()

  function dismissInstall() {
    setInstallDismissed(true)
    save('swiftstat-install-dismissed', '1')
  }

  function onHelpToggle(e) {
    const open = e.target.open
    setHelpOpen(open)
    if (!open) save('swiftstat-seen-help', '1') // remember the guide was seen
  }

  // Load (or switch) the edition index. Re-runs when `edition` changes.
  useEffect(() => {
    let alive = true
    setStatus('loading')
    loadIndex(edition)
      .then(({ count, types }) => {
        if (!alive) return
        setCount(count)
        setTypes(types)
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [edition])

  function toggleType(type) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      try {
        localStorage.setItem('swiftstat-hidden', JSON.stringify([...next]))
      } catch {
        /* storage disabled — keep the in-memory filter anyway */
      }
      return next
    })
  }
  function showAllCategories() {
    setHidden(new Set())
    try {
      localStorage.removeItem('swiftstat-hidden')
    } catch {
      /* ignore */
    }
  }

  function chooseEdition(id) {
    if (id === edition) return
    save('swiftstat-edition', id)
    setEdition(id)
  }

  // --- Characters (calculator profiles) ---
  function persistCharacters(list) {
    setCharacters(list)
    save('swiftstat-characters', JSON.stringify(list))
  }
  function saveCharacter(ch) {
    const exists = characters.some((c) => c.id === ch.id)
    persistCharacters(exists ? characters.map((c) => (c.id === ch.id ? ch : c)) : [...characters, ch])
    setActiveCharacter(ch.id) // activate the just-saved character
  }
  function deleteCharacter(id) {
    persistCharacters(characters.filter((c) => c.id !== id))
    if (activeChar === id) setActiveCharacter('')
  }
  function setActiveCharacter(id) {
    setActiveChar(id)
    save('swiftstat-active-char', id)
  }

  // Defaults handed to the calculators when a character is active.
  const defaults = useMemo(() => {
    const c = characters.find((x) => x.id === activeChar)
    return c ? { name: c.name, className: c.className, level: c.level, abilities: c.abilities } : {}
  }, [characters, activeChar])

  const { supported, listening, error: voiceError, toggle } = useVoice((transcript) => setQuery(transcript))

  // Debounce the query so we don't run a fuzzy search over ~1300 docs and render up
  // to 40 heavy cards on every keystroke.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const attackCalc = useMemo(
    () => (debounced.trim() ? parseAttackQuery(debounced, defaults) : null),
    [debounced, defaults],
  )
  const casterCalc = useMemo(
    () => (debounced.trim() && !attackCalc ? parseCasterQuery(debounced, defaults) : null),
    [debounced, attackCalc, defaults],
  )
  // `status` flips to 'loading' then 'ready' on an edition switch, so it (not
  // `edition`) is what correctly re-runs the search against the newly-active index.
  // Hidden categories are filtered out even for a direct search — the whole point is
  // that hiding e.g. Monsters keeps them out of view (anti-metagaming).
  const { results, hiddenCount } = useMemo(() => {
    if (status !== 'ready' || !debounced.trim()) return { results: [], hiddenCount: 0 }
    // For an attack calc, only surface the matching weapon item(s) — not monsters that
    // merely mention the weapon in their action text (now that it's indexed).
    const raw = attackCalc
      ? search(attackCalc.weapon, 8).filter((r) => r.type === 'equipment' || r.type === 'magic-item').slice(0, 3)
      : search(debounced, 60)
    const shown = raw.filter((r) => !hidden.has(r.type))
    return { results: shown.slice(0, 40), hiddenCount: raw.length - shown.length }
  }, [debounced, attackCalc, status, hidden])

  return (
    <div className="app">
      <header className="app-head">
        <div className="title-row">
          <h1>SwiftStat</h1>
          <div className="header-controls">
            <CharacterBar
              characters={characters}
              activeId={activeChar}
              onSetActive={setActiveCharacter}
              onSave={saveCharacter}
              onDelete={deleteCharacter}
            />
            <div className="edition-toggle" role="radiogroup" aria-label="Rules edition">
              {Object.values(EDITIONS).map((e) => (
                <button
                  key={e.id}
                  className={`edition ${edition === e.id ? 'active' : ''}`}
                  onClick={() => chooseEdition(e.id)}
                  role="radio"
                  aria-checked={edition === e.id}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="tagline">
          D&amp;D rules at a glance — search, voice, instant cards.
          {PROFILE === 'personal' && <span className="badge-custom build-tag">Personal build</span>}
        </p>
      </header>

      <div className="search-bar">
        <input
          autoFocus
          type="text"
          value={query}
          placeholder="Search or ask — e.g. fireball, goblin, rogue 18 dex daggers full attack"
          onChange={(e) => setQuery(e.target.value)}
        />
        {supported && (
          <button
            className={`mic ${listening ? 'listening' : ''}`}
            onClick={toggle}
            title={listening ? 'Listening — stops on pause (tap to stop now)' : 'Tap to talk'}
            aria-label={listening ? 'Listening — tap to stop voice search' : 'Start voice search'}
            aria-pressed={listening}
          >
            {listening ? '● Listening' : '🎤'}
          </button>
        )}
        {query && (
          <button className="clear" onClick={() => setQuery('')} aria-label="Clear">
            ✕
          </button>
        )}
      </div>

      {!installDismissed && (canInstall || iosHint) && (
        <div className="install-banner">
          <span className="install-text">
            📲 <strong>Install SwiftStat</strong> — opens like an app and works offline.
            {iosHint && !canInstall && ' On iPhone: tap Share, then “Add to Home Screen”.'}
          </span>
          <span className="install-actions">
            {canInstall && (
              <button
                className="chip primary"
                onClick={async () => {
                  const outcome = await promptInstall()
                  if (outcome === 'accepted') dismissInstall()
                }}
              >
                Install
              </button>
            )}
            <button className="chip" onClick={dismissInstall}>Not now</button>
          </span>
        </div>
      )}

      {voiceError && <p className="voice-error" role="alert">🎤 {voiceError}</p>}

      {status === 'ready' && (
        <details className="filters">
          <summary>
            Categories{hidden.size > 0 ? ` · ${hidden.size} hidden` : ''}
          </summary>
          <div className="filter-list">
            {CATEGORY_ORDER.filter((t) => types[t]).map((t) => (
              <label key={t} className="filter-item">
                <input type="checkbox" checked={!hidden.has(t)} onChange={() => toggleType(t)} />
                {CATEGORY_LABELS[t]} <span className="muted small">{types[t]}</span>
              </label>
            ))}
            {hidden.size > 0 && (
              <button className="chip" onClick={showAllCategories}>Show all</button>
            )}
          </div>
        </details>
      )}

      {status === 'ready' && (
        <details className="help" open={helpOpen} onToggle={onHelpToggle}>
          <summary>How to search</summary>
          <div className="help-body">
            <p className="muted small">
              SwiftStat isn’t just a lookup — you can <strong>type your stats and it does the math</strong>. Tap any
              example to try it.
            </p>
            <ul className="help-list">
              {HELP.map((h) => (
                <li key={h.title}>
                  <strong>{h.title}.</strong> {h.body}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {!query && status === 'ready' && (
        <div className="example-groups">
          {EXAMPLE_GROUPS.map((g) => (
            <div key={g.label} className="example-group">
              <div className="example-head">
                <span className="example-label">{g.label}</span>
                <span className="muted small">{g.hint}</span>
              </div>
              <div className="example-chips">
                {g.items.map((ex) => (
                  <button key={ex} className="chip" onClick={() => setQuery(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {edition === '2024' && (
            <p className="muted small edition-note">
              5.5 mode: spells &amp; monsters are marked <span className="badge-51">5.1</span> — the 2024 SRD doesn’t
              include them, so they’re shown from 5e (2014).
            </p>
          )}
        </div>
      )}

      <main className="results" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' && <p className="muted">Loading {EDITIONS[edition].label} rules…</p>}
        {status === 'error' && (
          <p className="muted">Couldn’t load the rules data. Check your connection and reload.</p>
        )}
        {attackCalc && <AttackCard calc={attackCalc} />}
        {casterCalc && <SpellCastCard calc={casterCalc} />}
        {results.map((entry) => (
          <Card key={entry.id} entry={entry} />
        ))}
        {status === 'ready' && debounced.trim() && hiddenCount > 0 && (
          <p className="muted small">
            {hiddenCount} result{hiddenCount === 1 ? '' : 's'} hidden by category filters.
          </p>
        )}
        {status === 'ready' && debounced.trim() && !attackCalc && !casterCalc && results.length === 0 && (
          <p className="muted">
            {hiddenCount > 0
              ? 'All matches are in hidden categories.'
              : 'No match. Try a spell, condition, monster, action, or weapon name.'}
          </p>
        )}
      </main>

      <footer className="app-foot">
        <p className="muted small">
          {status === 'ready' ? `${count} cards · ` : ''}Includes material from the{' '}
          <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">
            System Reference Document 5.1 &amp; 5.2.1
          </a>{' '}
          by Wizards of the Coast, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
            CC-BY-4.0
          </a>
          . 5.2.1 change notes are summarized in our own words. SwiftStat is unofficial and unaffiliated.
        </p>
      </footer>
    </div>
  )
}
