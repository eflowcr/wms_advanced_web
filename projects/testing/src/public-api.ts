/*
 * Public API surface of @ewms/testing
 *
 * Dev-only support library. It may import from any other library; nothing
 * shipped to production may import from it.
 *
 * Fase 0 exposes only the axe-core harness required by CI gate 5.
 */
export { expectNoAxeViolations } from './lib/a11y';
