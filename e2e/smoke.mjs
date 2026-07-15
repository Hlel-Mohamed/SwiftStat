// Self-contained end-to-end smoke test: spawns `vite preview` on the built app,
// drives it with Playwright, and asserts the key flows. Run: npm run test:e2e
// (which builds first). Uses the `playwright` dep — no @playwright/test runner.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4178
const URL = `http://localhost:${PORT}/`

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(URL)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('preview server did not start')
}

const checks = []
const rec = (label, ok, detail) => checks.push({ label, ok: !!ok, detail })
let browser

try {
  await waitForServer()
  browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })

  const query = async (q) => {
    await page.fill('.search-bar input', q)
    await page.waitForTimeout(320) // debounce + render
    return page.$$eval('.card', (els) =>
      els.map((e) => ({
        type: (e.className.match(/card-([a-z-]+)/) || [])[1],
        name: e.querySelector('h2')?.textContent,
      })),
    )
  }

  const fb = await query('fireball')
  rec('search: fireball → spell', fb.some((c) => c.type === 'spell' && c.name === 'Fireball'))

  // Recall fix: monster action text is now indexed.
  const ma = await query('multiattack')
  rec('recall: "multiattack" finds monsters', ma.some((c) => c.type === 'monster'), JSON.stringify(ma.slice(0, 2)))

  const finesse = await query('finesse')
  rec('recall: "finesse" finds equipment', finesse.some((c) => c.type === 'equipment'), JSON.stringify(finesse.slice(0, 2)))

  // Attack calc includes Sneak Attack now.
  await query('rogue level 5 18 dex daggers full attack')
  const calc = await page.$eval('.card-calc h2', (e) => e.textContent).catch(() => null)
  rec('attack calc includes Sneak Attack (d6)', calc === '4 + 2d4 + 3d6', 'formula=' + calc)

  // Spellcaster stats calc.
  await query('wizard 18 int level 5')
  const dc = await page.$eval('.card-calc h2', (e) => e.textContent).catch(() => null)
  rec('caster calc: DC 15 / +7', /DC 15/.test(dc || '') && /\+7/.test(dc || ''), 'header=' + dc)

  // Spell upcast scaling table.
  await query('fireball')
  const cells = await page.$$eval('.card-spell .scaling-cell', (els) => els.map((e) => e.textContent))
  rec('Fireball shows upcast scaling (3rd 8d6 … 9th)', cells.length >= 7 && /8d6/.test(cells.join(' ')), JSON.stringify(cells.slice(0, 2)))

  // Edition toggle.
  await page.click('.edition:has-text("5.5")')
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('.results')?.textContent || ''), { timeout: 8000 })
  await page.waitForTimeout(150)
  const active = await page.$eval('.edition.active', (e) => e.textContent)
  rec('edition toggle → 5.5 active', active.includes('2024'), active)
  const gob = await query('goblin')
  rec('5.5: borrowed monster shows 5.1 badge', await page.$('.card-monster .badge-51') !== null, JSON.stringify(gob[0]))

  rec('no JS errors', errors.length === 0, JSON.stringify(errors))
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.ok ? '' : '  -> ' + c.detail}`)
const ok = checks.every((c) => c.ok)
console.log(ok ? 'E2E PASSED' : 'E2E FAILED')
process.exit(ok ? 0 : 1)
