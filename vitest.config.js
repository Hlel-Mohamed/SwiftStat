import { defineConfig } from 'vitest/config'

// Unit tests target the pure, deterministic engine (dice + attack parser). Node
// environment — no DOM needed. (Search/PWA/UI are covered by the e2e smoke.)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
