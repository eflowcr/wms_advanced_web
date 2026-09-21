import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * El arnés visual: un banco de desarrollo, no parte de `npm run e2e`. Renderiza cada
 * ruta del showroom a un viewport fijo, espera a Montserrat, guarda una captura por ruta
 * y vuelca geometría y estilos computados a un texto. No afirma nada.
 * Va aparte porque una captura sin línea base no afirma nada, y versionar líneas base
 * haría de cada cambio visual deliberado una revisión de diff binario; lo que vale
 * defender quedó como aserción en e2e/showroom.e2e.ts. Nunca corre en CI.
 *
 * `npm run showroom:capture`. Salida: showroom-captures/ (ignorada).
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
