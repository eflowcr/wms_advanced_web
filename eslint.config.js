// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Reglas de dependencia entre bibliotecas: espejo de la regla del backend. Ningún
 * módulo entra en las entrañas de otro; todo cruce pasa por el alias `@ewms/*`, que
 * resuelve al `public-api.ts` de la biblioteca (tsconfig.json). Son errores que bloquean CI.
 *
 *   biblioteca     puede importar                 nunca importa
 *   -------------  -----------------------------  -------------------------
 *   shell          todo                           -
 *   showroom       design-system, shared          core, api-client, domains
 *   design-system  shared                         core, api-client, domains, @jsverse/*
 *   core           shared, api-client             design-system, domains
 *   shared         nada del proyecto              todo
 *   api-client     nada del proyecto              todo
 *   testing        todo (solo dev)                -
 */

const DOMAINS = ['@ewms/domains-*', '@ewms/domains/**'];

/**
 * Todas las bibliotecas del workspace. Producción usa el glob `@ewms/*`, que cerca una
 * biblioteca nueva al nacer; las specs necesitan restar `@ewms/testing` y el glob se
 * expande contra esta lista. Una biblioteca nueva va acá también, o las specs la importan.
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
 * Las hojas de componente se inyectan como <style> inline y la CSP estricta las bloquea
 * sin fallar en build ni en pruebas: el componente sale sin estilo. Por eso es error (ADR 0010).
 */
const COMPONENT_STYLES_MESSAGE =
  'Los estilos de componente se inyectan en línea y la CSP estricta los bloquea (ADR 0010). ' +
  "Estila con utilidades de Tailwind, y el host con `host: { class: '...' }`. " +
  'Si falta una utilidad, agregá el token — no abras una hoja de estilos.';

/**
 * El sistema de diseño no habla ningún idioma (ADR 0008): el texto llega ya traducido como
 * input. Importar la biblioteca de traducción obligaría a cargar el diccionario antes de
 * dibujar un botón y ataría la biblioteca de presentación a esta app.
 */
const NO_TRANSLATION_LIBRARY = {
  group: ['@jsverse/*'],
  message:
    '@ewms/design-system speaks no language (ADR 0008): no Transloco here. ' +
    'Receive the text as an input, already translated by the consumer.',
};

/**
 * Los formularios del proyecto son Signal Forms (ADR 0013). La API vieja se borró entera en
 * STG-FORMS; esta regla impide que vuelva de a poco, que es como vuelven estas cosas.
 */
const NO_LEGACY_FORMS = [
  {
    // `regex` y no `group`: un `group` de '@angular/forms' matchea la carpeta entera y se
    // llevaría puesto '@angular/forms/signals', que es justo el que hay que usar. De
    // `@angular/forms` salen `ReactiveFormsModule`, `FormsModule`, `FormControl`, `FormGroup`,
    // `FormBuilder`, `NgControl`, `NG_VALUE_ACCESSOR` y `ControlValueAccessor`; del otro, la
    // capa de compatibilidad que el ADR 0013 descartó.
    regex: '^@angular/forms(/signals-compat)?$',
    message:
      'Los formularios van sobre Signal Forms: importá de `@angular/forms/signals`. Un campo ' +
      'implementa FormValueControl o FormCheckboxControl con model(); el estado que no es un ' +
      'formulario vive en signal()s. Sin capa de compatibilidad. Ver vault: ' +
      '02-Arquitectura/Decisiones/0013 - Formularios con Signal Forms.md',
  },
];

function restrict(project, forbidden, allowedText, extraPatterns) {
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
        ...extraPatterns,
      ],
    },
  ];
}

/**
 * Arma los overrides de `no-restricted-imports` de una biblioteca: dos configs, primero
 * producción con todo lo prohibido y después *.spec.ts con lo mismo menos @ewms/testing.
 * Una spec no es la puerta trasera de la arquitectura: importa lo que el código probado.
 */
function boundary(project, forbidden, allowed, extraPatterns = []) {
  const allowedText = allowed.length ? allowed.join(', ') : 'nothing from this workspace';
  const inSpecs = forbidden
    .flatMap((pattern) => (pattern === '@ewms/*' ? LIBS : [pattern]))
    .filter((pattern) => pattern !== '@ewms/testing');

  return [
    {
      files: [`projects/${project}/**/*.ts`],
      rules: {
        '@typescript-eslint/no-restricted-imports': restrict(
          project,
          forbidden,
          allowedText,
          extraPatterns,
        ),
      },
    },
    {
      files: [`projects/${project}/**/*.spec.ts`],
      rules: {
        '@typescript-eslint/no-restricted-imports': restrict(
          project,
          inSpecs,
          `${allowedText}, plus @ewms/testing in specs`,
          extraPatterns,
        ),
      },
    },
  ];
}

module.exports = tseslint.config(
  {
    // Salida de build, cachés y código de terceros: no se lintean.
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
      // ------------------------------------------------ compuertas de seguridad
      // Regla 9. Cada una es error, nunca warning.
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
          // Atrapa `localStorage.setItem(...)`.
          selector: 'MemberExpression[object.name=/^(localStorage|sessionStorage)$/]',
          message: 'Web storage must never hold auth tokens. Use the token store from @ewms/core.',
        },
        {
          // Atrapa `window.localStorage...` y `globalThis.sessionStorage...`, que
          // no-restricted-globals no ve porque son accesos a propiedad.
          selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage)$/]',
          message: 'Web storage must never hold auth tokens. Use the token store from @ewms/core.',
        },
        {
          // `styles: [...]` o `styles: '...'`, solo como clave directa de los
          // metadatos de @Component({...}), claves entre comillas incluidas.
          selector:
            "Decorator > CallExpression[callee.name='Component'] > ObjectExpression > Property:matches([key.name='styles'], [key.value='styles'])",
          message: COMPONENT_STYLES_MESSAGE,
        },
        {
          // `styleUrl: '...'` y la forma vieja `styleUrls: [...]`, que se inyecta igual.
          selector:
            "Decorator > CallExpression[callee.name='Component'] > ObjectExpression > Property:matches([key.name=/^styleUrls?$/], [key.value=/^styleUrls?$/])",
          message: COMPONENT_STYLES_MESSAGE,
        },
      ],

      // ------------------------------------ imports profundos entre proyectos
      // Todo cruce pasa por el alias @ewms/*; una ruta relativa hacia el src/ de otro
      // proyecto saltea su API pública.
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

      // ------------------------------------------------------------ convenciones
      '@angular-eslint/prefer-standalone': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Prefijos de selector: `ewms-` para el sistema de diseño y vecinos, `app-` para el
  // shell. Los de dominio (`inv-`, `sec-`) llegan con los dominios.
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

  // ------------------------------------------------------------ las fronteras
  // Cada llamada emite la regla de producción y después la de specs, así el override
  // de specs siempre queda detrás de la config que acota.
  ...boundary('shared', ['@ewms/*', ...DOMAINS], [], [...NO_LEGACY_FORMS]),
  ...boundary('api-client', ['@ewms/*', ...DOMAINS], [], [...NO_LEGACY_FORMS]),
  ...boundary(
    'design-system',
    ['@ewms/core', '@ewms/api-client', '@ewms/showroom', '@ewms/testing', ...DOMAINS],
    ['@ewms/shared'],
    [NO_TRANSLATION_LIBRARY, ...NO_LEGACY_FORMS],
  ),
  ...boundary(
    'showroom',
    ['@ewms/core', '@ewms/api-client', '@ewms/testing', ...DOMAINS],
    ['@ewms/design-system', '@ewms/shared'],
    [...NO_LEGACY_FORMS],
  ),
  ...boundary(
    'core',
    ['@ewms/design-system', '@ewms/showroom', '@ewms/testing', ...DOMAINS],
    ['@ewms/shared', '@ewms/api-client'],
    [...NO_LEGACY_FORMS],
  ),

  // `shell` y `testing` no pasan por `boundary` (no tienen frontera de @ewms/*), pero la
  // API vieja de formularios tampoco entra por ahí.
  {
    files: ['projects/shell/**/*.ts', 'projects/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...NO_LEGACY_FORMS] }],
    },
  },

  /*
   * El único import profundo permitido hacia projects/ no se configura acá: es un
   * disable con su razón en e2e/click-budget.e2e.ts, que lee los presupuestos del mismo
   * archivo que la pantalla (REQ-FE-DS4-003 HG-02). El barrel público cargaría toda la
   * biblioteca Angular en Node desde Playwright. La única fuente la cuida check-click-budget.mjs.
   */

  // ------------------------------------------------------------ plantillas HTML
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
