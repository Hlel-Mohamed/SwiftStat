# personal-data/

Your **custom, non-SRD cards** live here (e.g. Beholder, Battle Master, homebrew).
These are for a **personal build only** — everything in this folder except this README
is git-ignored, so it never gets committed or shipped in the public deploy.

## How it works

- Add one or more `*.json` files here, each an **array of card objects** (see below).
- Build with the personal profile:
  ```bash
  npm run data:personal      # merges these into public/data/personal-<edition>.json
  npm run dev:personal       # or build:personal
  ```
- Cards show a teal **"Custom"** badge in the app.
- A `public` build ignores this folder entirely and deletes any stale personal files.

## Card format

Same shape the app renders. Minimum: `type` + `name`. Optional `editions` limits which
edition(s) it appears in (default: both). `id` is auto-generated if omitted.

```json
[
  {
    "type": "monster",
    "name": "Beholder",
    "editions": ["2014", "2024"],
    "meta": "Large aberration, lawful evil",
    "ac": 18,
    "hp": "180 (19d10 + 76)",
    "speed": "0 ft., fly 20 ft. (hover)",
    "abilities": { "STR": "10 (+0)", "DEX": "14 (+2)", "CON": "18 (+4)", "INT": "17 (+3)", "WIS": "15 (+2)", "CHA": "17 (+3)" },
    "cr": 13,
    "xp": 10000,
    "senses": "darkvision 120 ft., passive Perception 12",
    "traits": [
      { "name": "Antimagic Cone", "desc": "The beholder's central eye creates an area of antimagic in a 150-foot cone..." }
    ],
    "actions": [
      { "name": "Bite", "desc": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 14 (4d6) piercing damage." },
      { "name": "Eye Rays", "desc": "The beholder shoots three of the following magical eye rays at random..." }
    ]
  },
  {
    "type": "subclass",
    "name": "Battle Master",
    "text": "A Fighter martial archetype focused on combat maneuvers and superiority dice..."
  }
]
```

### Supported `type` values
`spell`, `condition`, `equipment`, `magic-item`, `monster`, `skill`, `rule`, `feat`,
`poison`, `species`, `weapon-mastery`, `subclass`, `change`. Unknown types still render
name + text.

### Searchability
Indexed fields: `name`, `aliases`, `text`, `summary`, `type`, `category`, `school`,
`meta`, `rarity`. Add an `aliases` array for alternate search terms.

> ⚠️ Only add content you have the right to use. Keep this to your own table's personal
> use — it is deliberately excluded from public builds.
