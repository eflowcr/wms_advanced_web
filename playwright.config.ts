import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env['CI']);

/**
 * Configuración e2e. Las specs viven en e2e/ y se llaman *.e2e.ts para que Vitest nunca
 * las tome. Tres niveles por lo que cada uno defiende, cada uno con su disparador en
 * .github/workflows/ci.yml: hasta DS-5 eran 183 pruebas en una cola con un worker, y
 * cada dominio de DS-6 iba a sumar a esa misma cola.
 *
 *   smoke     la app arranca, toda ruta responde y los tres patrones andan con teclado.
 *             Todo PR y todo push, menos de dos minutos.
 *   showroom  la documentación del catálogo. Cuando cambia lo que documenta, y siempre
 *             en development y main. Una sola máquina.
 *   domain    los dominios de DS-6. Vacío hoy.
 *
 * No se borró ni se debilitó nada: todo sigue corriendo en `npm run e2e`.
 * Ver vault: 02-Arquitectura/Integracion Continua.md §4.1.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,

  // Cuatro workers en CI, no uno. Si una prueba deja de pasar en paralelo, el defecto es
  // esa prueba (estado compartido, puerto fijo): serializar esconde el acoplamiento. Cuatro
  // y no más porque el runner tiene dos núcleos y un worker pasa casi todo esperando al navegador.
  workers: CI ? 4 : undefined,

  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
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

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
