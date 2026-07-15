# SwiftStat

Fast D&D 5e rules reference — search, voice, and instant stat cards. Built as an
offline-ready **PWA** (installable to a phone home screen without an app store).

## Features

- **Instant search** over spells, conditions, actions, and equipment (client-side, offline).
- **Attack math** without an LLM: type `rogue 18 dex daggers full attack` → `4 + 2d4` (avg 9, +6 to hit). Deterministic and correct — computed from SRD rules, not guessed.
- **Tap-to-talk voice** search (Web Speech API where supported).
- **Works offline** and installs to your home screen (service worker + web manifest).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the built app
```

## Architecture

Two independent halves, on purpose:

1. **The index** (`src/data`, `src/engine/search.js`) — pure client-side, no backend.
2. **The calculator** (`src/engine/dice.js`, `src/engine/query.js`) — a rule-based parser
   + dice engine. No AI, so it's fast, offline, and accurate. If you later want free-form
   natural language, add a *tiny* serverless function that only turns a sentence into
   structured params (`{class, dex, weapon, action}`) and still let this engine do the math.

## Deploy

- **GitHub Pages:** push to `main`; `.github/workflows/deploy.yml` builds with
  `BASE_PATH=/SwiftStat/` and publishes. Enable Pages → Source: GitHub Actions.
- **Vercel/Netlify/custom domain:** deploy `dist/` with default `BASE_PATH=/`.

## Extending the data

The seed dataset in `src/data/srd.js` is small. To scale up, map structured SRD JSON
from [5e-bits/5e-database](https://github.com/5e-bits/5e-database) into the same shapes.

## Licensing

Rules content is from the **D&D 5.1 System Reference Document**, © Wizards of the Coast,
licensed under **CC-BY-4.0**. Only SRD content may be redistributed publicly — do not add
non-SRD spells, monsters, or subclass features to a public build. SwiftStat is unofficial
and unaffiliated with Wizards of the Coast.
