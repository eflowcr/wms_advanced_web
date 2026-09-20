import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env['CI']);

/**
 * End-to-end configuration. Specs live in e2e/ and are named *.e2e.ts so the
 * Vitest unit-test runner never picks them up.
 *
 *
 * THREE LEVELS, AND THE NUMBER THAT FORCED THEM
 *
 * Until DS-5 this file declared ONE project and `workers: 1` in CI. That meant
 * 183 tests running one after another on the CI machine, and the suite was
 * already the longest job in the pipeline. The cost is not the problem by
 * itself; what makes it a problem is the direction of travel -- every domain
 * of DS-6 adds screens, and every screen adds tests to the same undivided
 * queue. A suite that can only grow and can only run serially stops being run.
 *
 * So the specs are split by WHAT THEY DEFEND, and each level gets its own
 * trigger (see .github/workflows/ci.yml):
 *
 *   smoke     the application boots, every route answers, and the three
 *             patterns still work end to end with the keyboard. Runs on EVERY
 *             pull request and on every push. Under two minutes, always.
 *
 *   showroom  the catalogue's own documentation: the component sheets, the
 *             iconography, the dictionaries, the click budget. Runs when what
 *             it documents changed, and unconditionally on development and
 *             main. Sharded three ways in CI.
 *
 *   domain    the vertical domains of DS-6. Empty today, declared now so the
 *             first domain has somewhere to put its tests instead of adding
 *             them to `showroom`.
 *
 * NOTHING WAS DELETED OR WEAKENED TO GET HERE. Every assertion that existed
 * before DS-5 still runs in `npm run e2e`; what changed is when each group
 * runs on its own and how many workers carry it.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,

  /*
   * FOUR WORKERS IN CI, NOT ONE.
   *
   * If a test stops passing in parallel, THAT TEST IS THE DEFECT -- shared
   * state between specs, a hard-coded port, two tests writing the same file.
   * The answer is to fix it, never to go back to one worker: serialising the
   * suite hides the coupling instead of removing it, and the coupling is what
   * makes a suite fragile as it grows.
   *
   * Four and not more because the GitHub runner has two cores: Playwright
   * workers are mostly waiting on the browser, so a small oversubscription
   * pays, and a large one only adds contention.
   */
  workers: CI ? 4 : undefined,

  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      /*
       * The floor. It answers one question -- is the application alive and are
       * its three patterns still usable? -- and it has to answer it fast
       * enough that nobody is tempted to skip it. The budget is two minutes
       * and it is asserted by the job, not hoped for.
       */
      name: 'smoke',
      testMatch: 'smoke.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      /*
       * The catalogue's documentation, proved. These are the 183 assertions
       * DS-2 to DS-4 built, unchanged: the component sheets, the keyboard walk
       * over every route, the icon table, the dictionaries and their failure
       * mode, and the click budget of the example screen.
       *
       * `click-budget.e2e.ts` belongs here and not in `smoke` although it is a
       * pattern: it measures the showroom's example screen against a standard
       * that lives in the vault, which is documentation of a number, not a
       * check that the application boots.
       */
      name: 'showroom',
      testMatch: [
        'showroom.e2e.ts',
        'iconography.e2e.ts',
        'i18n.e2e.ts',
        'i18n-failure.e2e.ts',
        'click-budget.e2e.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      /*
       * Empty on purpose, and declared anyway.
       *
       * The first vertical domain of DS-6 will arrive with tests, and the only
       * place to put them today would be `showroom` -- which is how a suite
       * that was split stops being split. The folder and the project exist so
       * that the right answer is also the obvious one.
       */
      name: 'domain',
      testMatch: 'domains/**/*.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
