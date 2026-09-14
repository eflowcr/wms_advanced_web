// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Dependency rules between libraries.
 *
 * This file is the frontend mirror of the backend architecture rule: no module
 * reaches into another module's internals; every crossing goes through a public
 * interface. Here the public interface is the `@ewms/*` alias, which resolves to
 * that library's `public-api.ts` (see tsconfig.json).
 *
 * These are CI-blocking errors, not a good-faith agreement.
 *
 *   library        may import                     never imports
 *   -------------  -----------------------------  -------------------------
 *   shell          everything                     -
 *   showroom       design-system, shared          core, api-client, domains
 *   design-system  shared                         core, api-client, domains
 *   core           shared, api-client             design-system, domains
 *   shared         nothing from the project       everything
 *   api-client     nothing from the project       everything
 *   testing        everything (dev only)          -
 */

const DOMAINS = ['@ewms/domains-*', '@ewms/domains/**'];

/**
 * Every workspace library, spelled out.
 *
 * Production configs below use the `@ewms/*` glob, so a new library is fenced
 * off the moment it exists. Spec configs cannot use the glob: they need to
 * subtract exactly one package (`@ewms/testing`), which the glob would swallow.
 * So the glob is expanded against this list for specs only.
 *
 * NOTE: adding a new @ewms/* library means adding it here too, otherwise it
 * stays importable from spec files.
 */
const LIBS = [
  '@ewms/design-system',
  '@ewms/showroom',
  '@ewms/core',
  '@ewms/shared',
  '@ewms/api-client',
  '@ewms/testing',
];

/**
 * Component stylesheets are injected as inline <style> elements, which the
 * strict CSP (`style-src 'self'`) blocks. Nothing fails at build or test time:
 * the component just ships unstyled. Hence a lint error (ADR 0010).
 */
const COMPONENT_STYLES_MESSAGE =
  'Los estilos de componente se inyectan en línea y la CSP estricta los bloquea (ADR 0010). ' +
  "Estila con utilidades de Tailwind, y el host con `host: { class: '...' }`. " +
  'Si falta una utilidad, agregá el token — no abras una hoja de estilos.';

function restrict(project, forbidden, allowedText) {
  return [
    'error',
    {
      patterns: [
        {
          group: forbidden,
          message:
            `Boundary violation: @ewms/${project} may only import ${allowedText}. ` +
            'If this dependency is genuinely needed, the architecture changes first, not this import.',
        },
      ],
    },
  ];
}

/**
 * Build the `no-restricted-imports` overrides for one library.
 *
 * Returns TWO configs, in order:
 *
 *   1. production code  -- the full forbidden set
 *   2. *.spec.ts        -- the same set minus @ewms/testing
 *
 * Specs get exactly one extra privilege: the dev-only testing library. Every
 * other boundary stays live inside a spec. A test file must never be the back
 * door into the architecture -- what a spec is allowed to import is what the
 * code under test will eventually be written against.
 */
function boundary(project, forbidden, allowed) {
  const allowedText = allowed.length ? allowed.join(', ') : 'nothing from this workspace';
  const inSpecs = forbidden
    .flatMap((pattern) => (pattern === '@ewms/*' ? LIBS : [pattern]))
    .filter((pattern) => pattern !== '@ewms/testing');

  return [
    {
      files: [`projects/${project}/**/*.ts`],
      rules: {
        '@typescript-eslint/no-restricted-imports': restrict(project, forbidden, allowedText),
      },
    },
    {
      files: [`projects/${project}/**/*.spec.ts`],
      rules: {
        '@typescript-eslint/no-restricted-imports': restrict(
          project,
          inSpecs,
          `${allowedText}, plus @ewms/testing in specs`,
        ),
      },
    },
  ];
}

module.exports = tseslint.config(
  {
    // Build output, caches and vendored code are not ours to lint.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // ---------------------------------------------------------------- TypeScript
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // ------------------------------------------------------- security gates
      // Gate 9. Each of these is an error, never a warning.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'localStorage must never hold auth tokens. Use the token store from @ewms/core. For a non-sensitive UI preference, disable this rule on the line with a written justification.',
        },
        {
          name: 'sessionStorage',
          message:
            'sessionStorage must never hold auth tokens. Use the token store from @ewms/core. For a non-sensitive UI preference, disable this rule on the line with a written justification.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^bypassSecurityTrust/]',
          message:
            'bypassSecurityTrust* disables Angular sanitisation and is forbidden. Sanitise the value instead.',
        },
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message:
            'Raw innerHTML is forbidden (XSS). Render through a template, or sanitise via DomSanitizer.sanitize().',
        },
        {
          // Catches `localStorage.setItem(...)`.
          selector: 'MemberExpression[object.name=/^(localStorage|sessionStorage)$/]',
          message: 'Web storage must never hold auth tokens. Use the token store from @ewms/core.',
        },
        {
          // Catches `window.localStorage...` and `globalThis.sessionStorage...`,
          // which no-restricted-globals cannot see because they are property
          // accesses rather than bare global references.
          selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage)$/]',
          message:
            'Web storage must never hold auth tokens. Use the token store from @ewms/core.',
        },
        {
          // `styles: [...]` or `styles: '...'`, only as a direct key of the
          // @Component({...}) metadata object. Quoted keys included.
          selector:
            "Decorator > CallExpression[callee.name='Component'] > ObjectExpression > Property:matches([key.name='styles'], [key.value='styles'])",
          message: COMPONENT_STYLES_MESSAGE,
        },
        {
          // `styleUrl: '...'`, plus the older `styleUrls: [...]` form, which
          // is injected the same way.
          selector:
            "Decorator > CallExpression[callee.name='Component'] > ObjectExpression > Property:matches([key.name=/^styleUrls?$/], [key.value=/^styleUrls?$/])",
          message: COMPONENT_STYLES_MESSAGE,
        },
      ],

      // --------------------------------------------- cross-project deep imports
      // Every crossing goes through the @ewms/* alias. Reaching into another
      // project's src/ by relative path bypasses its public API.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*/src/**', '../../../**', '**/projects/**'],
              message:
                'Deep relative import across projects. Import the library through its @ewms/* alias instead.',
            },
            {
              group: ['@ewms/*/**'],
              message:
                "Reaching past a library's public-api.ts is forbidden. Import the bare alias, e.g. '@ewms/shared'.",
            },
          ],
        },
      ],

      // ------------------------------------------------------------ conventions
      '@angular-eslint/prefer-standalone': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Selector prefixes. `ewms-` for the design system and its neighbours,
  // `app-` for the shell. Domain prefixes (`inv-`, `sec-`) arrive with domains.
  {
    files: ['projects/shell/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    files: [
      'projects/design-system/**/*.ts',
      'projects/showroom/**/*.ts',
      'projects/shared/**/*.ts',
      'projects/core/**/*.ts',
      'projects/api-client/**/*.ts',
      'projects/testing/**/*.ts',
    ],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ewms', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'ewms', style: 'camelCase' },
      ],
    },
  },

  // ------------------------------------------------------------ the boundaries
  // Each call emits the production rule followed by the spec rule, so the spec
  // override always lands after the config it narrows.
  ...boundary('shared', ['@ewms/*', ...DOMAINS], []),
  ...boundary('api-client', ['@ewms/*', ...DOMAINS], []),
  ...boundary(
    'design-system',
    ['@ewms/core', '@ewms/api-client', '@ewms/showroom', '@ewms/testing', ...DOMAINS],
    ['@ewms/shared'],
  ),
  ...boundary(
    'showroom',
    ['@ewms/core', '@ewms/api-client', '@ewms/testing', ...DOMAINS],
    ['@ewms/design-system', '@ewms/shared'],
  ),
  ...boundary(
    'core',
    ['@ewms/design-system', '@ewms/showroom', '@ewms/testing', ...DOMAINS],
    ['@ewms/shared', '@ewms/api-client'],
  ),

  // ------------------------------------------------------------- HTML templates
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
