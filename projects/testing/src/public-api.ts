/*
 * Public API surface of @ewms/testing
 *
 * Dev-only support library. It may import from any other library; nothing
 * shipped to production may import from it.
 */
export { expectNoAxeViolations } from './lib/a11y';
export { pixels } from './lib/css-length';
export { provideI18nTesting } from './lib/i18n';
