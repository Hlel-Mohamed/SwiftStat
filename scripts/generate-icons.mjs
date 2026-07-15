// Generates PWA PNG icons by rasterizing a canvas in headless Chromium (reuses the
// already-installed `playwright` dep — no image toolchain needed). Run once, or after
// changing the icon design:  node scripts/generate-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons')
fs.mkdirSync(outDir, { recursive: true })

const BG = '#14110f'
const ACCENT = '#c9662a'
const TEXT = '#f2e9dd'

const browser = await chromium.launch()
const page = await browser.newPage()

async function render(size, glyphScale) {
  const dataUrl = await page.evaluate(
    ([size, glyphScale, BG, ACCENT, TEXT]) => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const g = c.getContext('2d')
      g.fillStyle = BG
      g.fillRect(0, 0, size, size)
      // accent ring
      g.strokeStyle = ACCENT
      g.lineWidth = size * 0.05
      g.beginPath()
      g.arc(size / 2, size / 2, size * glyphScale * 0.5, 0, Math.PI * 2)
      g.stroke()
      // "S"
      g.fillStyle = TEXT
      g.font = `bold ${Math.round(size * glyphScale * 0.7)}px system-ui, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('S', size / 2, size / 2 + size * 0.02)
      return c.toDataURL('image/png')
    },
    [size, glyphScale, BG, ACCENT, TEXT],
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

// purpose:any icons fill more; maskable keeps the glyph inside the ~80% safe zone.
const jobs = [
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  ['maskable-512.png', 512, 0.55],
  ['apple-touch-icon.png', 180, 0.72],
]
for (const [name, size, scale] of jobs) {
  fs.writeFileSync(path.join(outDir, name), await render(size, scale))
  console.log(`wrote public/icons/${name}`)
}
await browser.close()
