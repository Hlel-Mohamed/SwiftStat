import { useEffect, useMemo, useState } from 'react'
import { loadIndex, search, EDITIONS, DEFAULT_EDITION, PROFILE } from './engine/search.js'
import { parseAttackQuery } from './engine/query.js'
import { useVoice } from './hooks/useVoice.js'
import { Card, AttackCard } from './components/Card.jsx'
import './App.css'

const EXAMPLES = ['fireball', 'poisoned', 'goblin', 'longsword', 'rogue 18 dex daggers full attack', 'weapon mastery']

function initialEdition() {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem('swiftstat-edition')
  return saved && EDITIONS[saved] ? saved : DEFAULT_EDITION
}

export default function App() {
  const [query, setQuery] = useState('')
  const [edition, setEdition] = useState(initialEdition)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [count, setCount] = useState(0)

  // Load (or switch) the edition index. Re-runs when `edition` changes.
  useEffect(() => {
    let alive = true
    setStatus('loading')
    loadIndex(edition)
      .then(({ count }) => {
        if (!alive) return
        setCount(count)
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [edition])

  function chooseEdition(id) {
    if (id === edition) return
    try {
      localStorage.setItem('swiftstat-edition', id)
    } catch {
      /* storage disabled (e.g. Safari private) — switch anyway */
    }
    setEdition(id)
  }

  const { supported, listening, toggle } = useVoice((transcript) => setQuery(transcript))

  // Debounce the query so we don't run a fuzzy search over ~1300 docs and render up
  // to 40 heavy cards on every keystroke.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180)
    return () => clearTimeout(id)
  }, [query])

  const attackCalc = useMemo(() => (debounced.trim() ? parseAttackQuery(debounced) : null), [debounced])
  // `status` flips to 'loading' then 'ready' on an edition switch, so it (not
  // `edition`) is what correctly re-runs the search against the newly-active index.
  const results = useMemo(() => {
    if (status !== 'ready' || !debounced.trim()) return []
    if (attackCalc) return search(attackCalc.weapon, 3)
    return search(debounced)
  }, [debounced, attackCalc, status])

  return (
    <div className="app">
      <header className="app-head">
        <div className="title-row">
          <h1>SwiftStat</h1>
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

      {!query && status === 'ready' && (
        <div className="examples">
          <span className="muted small">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => setQuery(ex)}>
              {ex}
            </button>
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
        {results.map((entry) => (
          <Card key={entry.id} entry={entry} />
        ))}
        {status === 'ready' && debounced.trim() && !attackCalc && results.length === 0 && (
          <p className="muted">No match. Try a spell, condition, monster, action, or weapon name.</p>
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
