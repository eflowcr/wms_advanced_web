import { defineConfig, devices } from '@playwright/test';

// No 4200: el servidor de desarrollo que alguien tenga abierto nunca se confunde con el artefacto.
const PORT = 4400;
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env['CI']);

/**
 * E2E en e2e/*.e2e.ts (Vitest no las toma), en tres niveles con su disparador en ci.yml: smoke
 * (todo PR y push), showroom (el catálogo) y domain (DS-6, vacío). Todo corre en `npm run e2e`.
 * Ver vault: Integracion Continua §4.1 y §11.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  // Sin reintentos, también en CI: una prueba inestable se arregla, no se repite hasta que pase.
  retries: 0,

  // Cuatro workers en CI, no uno. Si una prueba deja de pasar en paralelo, el defecto es
  // esa prueba (estado compartido, puerto fijo): serializar esconde el acoplamiento. Cuatro
  // y no más porque el runner tiene dos núcleos y un worker pasa casi todo esperando al navegador.
  workers: CI ? 4 : undefined,

  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    // Sin reintentos no hay «primer reintento». Grabar la traza de todas duplicó el catálogo
    // (138 → 280 s, 2026-09-26): al fallar quedan la captura y el error-context.
    trace: 'off',
    screenshot: 'only-on-failure',
    // La app sigue al idioma del navegador y las aserciones están en español. Una prueba en
    // inglés lo pide con `test.use({ locale })`.
    locale: 'es-CR',
  },

  projects: [
    {
      // El piso: ¿la app vive y sus tres patrones se usan? Tiene que ser tan rápido que
      // nadie quiera saltearlo. Presupuesto: dos minutos.
      name: 'smoke',
      testMatch: 'smoke.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // La documentación del catálogo, probada: las 183 aserciones de DS-2 a DS-4, sin
      // cambios. click-budget va acá y no en smoke: mide la pantalla de ejemplo contra un
      // estándar del vault, que es documentar un número, no comprobar que la app arranca.
      name: 'showroom',
      testMatch: [
        'showroom.e2e.ts',
        'iconography.e2e.ts',
        'i18n.e2e.ts',
        'i18n-failure.e2e.ts',
        'config-failure.e2e.ts',
        'click-budget.e2e.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Vacío a propósito y declarado igual: el primer dominio de DS-6 trae pruebas, y sin
      // este proyecto irían a `showroom`, que es como una suite partida deja de estarlo.
      name: 'domain',
      testMatch: 'domains/**/*.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // El artefacto que se despliega: build de producción servido estático, así la vigilancia de
  // consola y CSP mira lo mismo que un usuario. Ver vault: Integracion Continua §4.1.
  webServer: {
    command: `npm run build && node tools/e2e/serve.mjs --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
