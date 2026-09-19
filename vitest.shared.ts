import { defineConfig } from 'vitest/config';

/**
 * Base runner configuration for `@angular/build:unit-test`, shared by every
 * project's own `vitest.<project>.config.ts`.
 *
 * ONE CONFIG PER PROJECT, AND THAT IS THE POINT (DS-2, 2026-09-18).
 *
 * Until DS-2 every test target pointed at a single `vitest.config.ts`, so
 * there was one set of coverage thresholds for all of them. A single number
 * has to be the weakest project's -- today the shell's 79 -- and under it the
 * design system could have lost fifteen points and core sixteen without
 * anything complaining.
 *
 * The first attempt at fixing that was a per-path threshold
 * (`'projects/core/**': {...}`) inside the one config. It does not work, and
 * the way it fails is worth writing down so nobody tries it again: A PATH
 * THRESHOLD IS NOT EVALUATED IN ITS PROJECT'S RUN, IT IS EVALUATED IN EVERY
 * RUN THAT TOUCHES THOSE FILES. The shell depends on core, so `ng test shell`
 * covers `projects/core/**` in passing -- at 74.73 %, because it exercises
 * what the shell uses and not what core tests -- and a core threshold of 95
 * fails on the first of the five commands in `npm test`. The only number that
 * would have passed was 74, weaker than the global 79: loosening the gate
 * rather than tightening it.
 *
 * A config per project has neither problem. Each project's thresholds are
 * evaluated only in that project's own run, over what that run actually
 * covers, so every number means one thing.
 *
 * WHAT GOES WHERE: everything a runner needs and every project agrees on lives
 * here. The only thing a project config carries is its own measured
 * thresholds.
 */

export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

/**
 * `alsoExclude` drops another project's files out of this project's report.
 *
 * It exists for the same reason the note above exists, seen from the other
 * side. A run covers every file it loads, including the libraries the project
 * under test imports -- and it covers them as that project happens to use
 * them, which is never how their own tests cover them. The showroom is the
 * extreme case: its pages render nine design-system components, so without
 * this its number is mostly a measurement of the design system, taken badly,
 * while those same files are already measured properly by
 * `ng test design-system`.
 *
 * It is `exclude` and not `include` because `include` does not work here: the
 * builder hands Vitest modules whose paths do not match a source glob, so an
 * include narrows the denominator to the right files and then attributes no
 * coverage to any of them -- a confident 0 %. Exclude is matched against the
 * same paths the report already uses, and works.
 *
 * Excluding does not weaken anything. Every project's own files stay measured
 * by its own run at its own threshold; what goes away is the double count.
 * Added in DS-2 PR 3, when the showroom pages started importing real
 * components -- see that PR's report.
 *
 * Only pass it where the pollution is real. A project whose number means what
 * it says does not need it.
 */

/**
 * The runner configuration for one project.
 *
 * `thresholds` is the coverage MEASURED for that project, truncated to the
 * integer -- never a round number chosen because it looks demanding, and never
 * a low one left as slack. Each project config says when its numbers were
 * measured and what they were.
 *
 * From there a threshold only ever goes up. If a change lowers coverage, the
 * change is what gets fixed.
 */
export function projectRunner(thresholds: CoverageThresholds, alsoExclude: string[] = []) {
  return defineConfig({
    test: {
      setupFiles: ['./vitest-setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        exclude: [
          ...alsoExclude,
          '**/*.spec.ts',
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
