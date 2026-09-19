import { version } from '../../package.json';

/**
 * The version of @ewms/design-system, taken from its own package.json at
 * compile time.
 *
 * Exported because the showroom shows which version of the system you are
 * looking at, and a version typed into a page by hand is wrong the first time
 * the library is bumped. The showroom cannot read this package.json itself:
 * crossing into another project by relative path is what the public API
 * exists to prevent (eslint.config.js).
 */
export const DESIGN_SYSTEM_VERSION: string = version;
