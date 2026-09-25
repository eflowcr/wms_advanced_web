import { defineConfig } from 'vitest/config';

/**
 * Configuración base del runner de `@angular/build:unit-test`, compartida por cada
 * `vitest.<proyecto>.config.ts`, que solo aporta sus umbrales medidos.
 *
 * Un config por proyecto, a propósito (DS-2): un umbral por ruta dentro de un solo config
 * no se evalúa en la corrida de su proyecto sino en toda corrida que toque esos archivos,
 * y `ng test shell` cubre core de paso al 74.73 %. No los vuelvas a juntar.
 * Ver vault: 02-Arquitectura/Integracion Continua.md §8.
 */

export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

/**
 * `alsoExclude` saca del reporte los archivos de otro proyecto, que la corrida cubre solo
 * como este los usa (caso extremo: showroom sobre el design-system). Es `exclude` y no
 * `include`: con `include` el builder no atribuye cobertura a nada, un 0 % seguro de sí.
 * No debilita nada: cada proyecto se mide en su propia corrida. Se pasa solo donde la
 * contaminación es real (desde DS-2 PR 3).
 */

/**
 * Config del runner para un proyecto. `thresholds` es la cobertura medida, truncada al
 * entero: nunca un número redondo que suene exigente ni uno bajo de colchón. Desde ahí solo
 * sube: si un cambio baja la cobertura, se arregla el cambio.
 */
export function projectRunner(thresholds: CoverageThresholds, alsoExclude: string[] = []) {
  return defineConfig({
    test: {
      setupFiles: ['./vitest-setup.ts'],
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
