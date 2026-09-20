import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The visual harness — a DEVELOPMENT RIG, not part of `npm run e2e`.
 *
 * It renders every showroom route at a fixed viewport, waits for Montserrat,
 * writes a full-page screenshot per route and dumps the measured geometry and
 * the token-derived computed styles to a text file. Nothing here asserts:
 * its output is images and numbers for a human to read.
 *
 * WHY IT IS SEPARATE FROM THE e2e SUITE
 *
 * A screenshot without a baseline asserts nothing, and committing baselines
 * would make every deliberate visual change a binary-diff review. The rig
 * exists to give the build/look/fix cycle a real signal while the pages are
 * being written; the facts worth defending forever became ordinary
 * assertions in e2e/showroom.e2e.ts instead, where a failure has a meaning.
 *
 * Splitting it also keeps the CI suite honest: this config never runs there,
 * so it can never fail the build for a reason nobody can act on.
 *
 * Run with `npm run showroom:capture`. Output: showroom-captures/ (ignored).
 */
export default defineConfig({
  testDir: './e2e/capture',
  testMatch: '**/*.capture.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
  },
  /*
   * The viewport is set AFTER the device preset, not before it: Desktop Chrome
   * carries a 1280x720 viewport of its own, and a project's `use` wins over the
   * top-level one. Put the other way round every capture silently came out at
   * 1280, which is the width the pages are meant to be CHECKED at, not the one
   * they are meant to be looked at.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
