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
    await page.waitForTimeout(550) // > SEARCH_DEBOUNCE_MS (350) + render
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

  // Character profiles: seed one, reload, and confirm auto-fill.
  await page.evaluate(() => {
    localStorage.setItem('swiftstat-characters', JSON.stringify([
      { id: 'c1', name: 'Vex', className: 'rogue', subclass: 'Thief', level: 12, abilities: { dex: 20 } },
    ]))
    localStorage.setItem('swiftstat-active-char', 'c1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })
  await query('daggers full attack')
  const acFormula = await page.$eval('.card-calc h2', (e) => e.textContent).catch(() => null)
  const usingName = await page.$eval('.card-calc', (e) => /using/i.test(e.textContent) && /Vex/.test(e.textContent)).catch(() => false)
  rec('character auto-fills attack calc (L12 rogue, DEX 20 → Sneak 6d6)', acFormula === '5 + 2d4 + 6d6', 'formula=' + acFormula)
  rec('calc card shows "using Vex"', usingName)
  // Reset for later checks.
  await page.evaluate(() => { localStorage.removeItem('swiftstat-active-char'); localStorage.removeItem('swiftstat-characters') })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })

  // Category filter: hiding Monsters removes them even from a direct search.
  const gobBefore = await query('goblin')
  rec('goblin visible before filtering', gobBefore.some((c) => c.type === 'monster'))
  await page.click('details.filters summary')
  await page.click('.filter-item:has-text("Monsters") input')
  await page.waitForTimeout(200)
  const gobAfter = await page.$$eval('.card-monster', (els) => els.length)
  rec('hiding Monsters hides them from search', gobAfter === 0, 'monster cards=' + gobAfter)
  await page.click('.filter-item:has-text("Monsters") input') // restore
  await page.waitForTimeout(150)

  // Edition toggle.
  await page.click('.edition:has-text("5.5")')
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('.results')?.textContent || ''), { timeout: 8000 })
  await page.waitForTimeout(150)
  const active = await page.$eval('.edition.active', (e) => e.textContent)
  rec('edition toggle → 5.5 active', active.includes('2024'), active)
  const gob = await query('goblin')
  rec('5.5: borrowed monster shows 5.1 badge', await page.$('.card-monster .badge-51') !== null, JSON.stringify(gob[0]))

  // --- Mobile regression: the character panel used to render ~204px off-screen ---
  const mobile = await browser.newPage({ viewport: { width: 390, height: 820 }, isMobile: true })
  await mobile.goto(URL, { waitUntil: 'networkidle' })
  await mobile.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })
  await mobile.click('.charbar summary')
  await mobile.waitForTimeout(200)
  const box = await mobile.$eval('.charbar-panel', (e) => {
    const r = e.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right) }
  })
  rec('mobile: character panel is on-screen', box.left >= 0 && box.right <= 390, JSON.stringify(box))
  // And it is actually usable: create + activate a character at 390px.
  await mobile.click('.charbar .chip') // + Add character
  await mobile.fill('.char-name', 'Mob')
  await mobile.selectOption('.char-form select', 'rogue')
  await mobile.fill('.char-level', '5')
  await mobile.click('.char-form .primary')
  await mobile.waitForTimeout(250)
  const activeName = await mobile.$eval('.charbar summary', (e) => e.textContent)
  rec('mobile: can create + activate a character', /Mob/.test(activeName), activeName)
  rec('mobile: panel auto-closes after save', await mobile.$('.charbar-panel:visible') === null)
  await mobile.close()

  // --- Voice: only FINAL results persist, and it stops (no endless restart) ---
  const voice = await browser.newPage()
  await voice.addInitScript(() => {
    class MockSR {
      start() {
        this.onstart?.({})
        // Interim "18" several times, then a session end mid-stream, then the final.
        const interim = (t) => ({ results: [{ 0: { transcript: t }, isFinal: false, length: 1 }] })
        setTimeout(() => this.onresult?.(interim('18')), 40)
        setTimeout(() => this.onresult?.(interim('18')), 80)
        setTimeout(() => this.onend?.({}), 120) // previously triggered a bridging restart
        setTimeout(() => this.onresult?.({ results: [{ 0: { transcript: '18 dex' }, isFinal: true, length: 1 }] }), 160)
      }
      stop() { this.onend?.({}) }
      abort() {}
    }
    window.SpeechRecognition = MockSR
    window.webkitSpeechRecognition = MockSR
  })
  await voice.goto(URL, { waitUntil: 'networkidle' })
  await voice.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })
  await voice.click('.mic')
  await voice.waitForTimeout(400)
  const spoken = await voice.inputValue('.search-bar input')
  rec('voice: no duplicated words', !/18\s+18/.test(spoken), 'value=' + JSON.stringify(spoken))
  await voice.waitForTimeout(1600) // past the 1200ms silence window
  const stillListening = await voice.$('.mic.listening') !== null
  rec('voice: stops listening after the phrase', !stillListening)
  await voice.close()

  // --- Install banner appears on beforeinstallprompt ---
  const inst = await browser.newPage()
  await inst.goto(URL, { waitUntil: 'networkidle' })
  await inst.waitForFunction(() => /\d{3,} cards/.test(document.body.innerText), { timeout: 10000 })
  await inst.evaluate(() => {
    const e = new Event('beforeinstallprompt')
    e.prompt = () => {}
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })
  await inst.waitForTimeout(200)
  rec('install banner shows when installable', await inst.$('.install-banner') !== null)
  await inst.click('.install-banner .chip:has-text("Not now")')
  await inst.waitForTimeout(150)
  rec('install banner dismissable', await inst.$('.install-banner') === null)
  await inst.close()

  rec('no JS errors', errors.length === 0, JSON.stringify(errors))
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.ok ? '' : '  -> ' + c.detail}`)
const ok = checks.every((c) => c.ok)
console.log(ok ? 'E2E PASSED' : 'E2E FAILED')
process.exit(ok ? 0 : 1)
