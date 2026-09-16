import { defineConfig } from 'vitest/config';

/**
 * Runner configuration for the Angular `@angular/build:unit-test` builder.
 * angular.json points every project's test target here via `runnerConfig`;
 * it only flips `coverage` on, so thresholds and setup live in this file and
 * nowhere else.
 */
export default defineConfig({
  test: {
    setupFiles: ['./vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      exclude: [
        '**/*.spec.ts',
        '**/public-api.ts',
        '**/*.config.ts',
        '**/*.routes.ts',
        '**/main.ts',
        'e2e/**',
      ],
      // DECIDIDO (DS-0): los umbrales quedan en 0 a proposito. No es un TODO
      // pendiente de numero, es la decision.
      //
      // Con dos pruebas triviales, cualquier umbral seria teatro: fijar 80% hoy
      // no mide nada y solo invita a escribir pruebas de relleno para alcanzarlo.
      //
      // Se fijan en la fase DS-2, cuando el design system tenga pruebas de verdad.
      // El valor se toma de la cobertura MEDIDA en ese momento, no de una cifra
      // aspiracional. Desde ahi el umbral solo puede subir, nunca bajar: si un
      // cambio lo hace bajar, se arregla el cambio, no el umbral.
      //
      // La compuerta ya es real y bloqueante -- verificado subiendo statements a
      // 95 y viendo fallar el build. Lo unico provisional es el numero.
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
