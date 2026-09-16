import en from '../../public/i18n/en.json';
import es from '../../public/i18n/es.json';

/**
 * The real dictionaries, for specs only (provideI18nTesting). Rendering
 * against them means a template key missing from either file throws in the
 * spec, through the development missing handler.
 *
 * `*.testing.ts` is excluded from the app build (tsconfig.app.json) and from
 * typecheck, exactly like `*.spec.ts`.
 */
export const DICTIONARIES = { es, en } as const;
