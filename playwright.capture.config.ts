import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * El arnés visual: captura cada ruta del showroom y vuelca geometría y estilos; no afirma nada y
 * nunca corre en CI. `npm run showroom:capture` → showroom-captures/ (ignorada).
 * Ver vault: Integracion Continua §11.
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
  // El viewport va después del preset: Desktop Chrome trae su propio 1280x720 y el `use`
  // del proyecto gana sobre el de arriba. Al revés, toda captura salía en silencio a 1280.
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
