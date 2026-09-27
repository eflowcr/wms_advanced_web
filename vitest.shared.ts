import { defineConfig } from 'vitest/config';

/**
 * Base del runner de `@angular/build:unit-test`; cada vitest.<proyecto>.config.ts pone sus pisos.
 * Un config por proyecto a propósito: un umbral por ruta se evalúa en toda corrida.
 * Ver vault: Integracion Continua §8.
 */

export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

/**
 * `alsoExclude` saca del reporte los archivos de otro proyecto que esta corrida cubre de paso.
 * Es `exclude` y no `include`: con `include` el builder no atribuye nada.
 * Ver vault: Integracion Continua §11.
 */

/**
 * Config del runner para un proyecto. `thresholds` es la cobertura medida, truncada al
 * entero: nunca un número redondo que suene exigente ni uno bajo de colchón. Desde ahí solo
 * sube: si un cambio baja la cobertura, se arregla el cambio.
 */
export function projectRunner(thresholds: CoverageThresholds, alsoExclude: string[] = []) {
  return defineConfig({
    test: {
      // Zona horaria fija y al oeste de UTC: `new Date('2026-03-15')` es medianoche UTC y
      // en hora local cae un día antes; en UTC ese error no se ve (así se escapó uno en la
      // tabla). Variable de entorno y no setup: Node cachea la zona al arrancar (Node 24).
      env: { TZ: 'America/Costa_Rica' },
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        exclude: [
          ...alsoExclude,
          '**/*.spec.ts',
          // Soporte de pruebas, como los specs: ayudantes y datos del TestBed, no código probado.
          '**/*.testing.ts',
          '**/projects/testing/**',
          '**/public-api.ts',
          '**/*.config.ts',
          '**/*.routes.ts',
          '**/main.ts',
          'e2e/**',
        ],
        thresholds: { ...thresholds },
      },
    },
  });
}
