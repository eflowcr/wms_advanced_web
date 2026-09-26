// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Fronteras en lista blanca: cada biblioteca declara qué `@ewms/*` puede importar y lo demás es
 * error; una spec suma `@ewms/testing`. Las prueba tools/ci/boundaries.test.mjs, una sonda por
 * frontera. Ver vault: 02-Arquitectura/Anatomia del Workspace.md.
 */

/** Los alias de dominio de Estructura §2, en una sola lista; cada uno en projects/domains/<nombre>. */
const DOMAINS = [
  '@ewms/inventory',
  '@ewms/security',
  '@ewms/kardex',
  '@ewms/decisions',
  '@ewms/audit',
  '@ewms/outbox',
  '@ewms/extensibility',
  '@ewms/tasks',
];

/** Lo que un dominio puede importar del workspace; nunca otro dominio (Estructura §3). */
const DOMAIN_ALLOWED = ['@ewms/design-system', '@ewms/core', '@ewms/shared', '@ewms/api-client'];

/** El sistema de diseño no conoce el router: es presentación (ADR 0014). */
const NO_ROUTER = {
  group: ['@angular/router', '@angular/router/*'],
  message:
    '@ewms/design-system does not know the router (ADR 0014): receive the route as an input ' +
    'and let the consumer navigate.',
};

/**
 * Las hojas de componente se inyectan como <style> inline y la CSP estricta las bloquea
 * sin fallar en build ni en pruebas: el componente sale sin estilo. Por eso es error (ADR 0010).
 */
const COMPONENT_STYLES_MESSAGE =
  'Los estilos de componente se inyectan en línea y la CSP estricta los bloquea (ADR 0010). ' +
  "Estila con utilidades de Tailwind, y el host con `host: { class: '...' }`. " +
  'Si falta una utilidad, agregá el token — no abras una hoja de estilos.';

/** Regla 9: nada de la sesión vive en el navegador; la única excepción escrita es el idioma (ADR 0008). */
const STORAGE_MESSAGE =
  'El almacenamiento del navegador está prohibido (PLN-WMS-003 §4): nada de la sesión vive en el ' +
  'navegador. La única excepción escrita es el idioma de la interfaz (ADR 0008); otra pide su ADR.';

/** Con Trusted Types en la CSP, un sumidero con una cadena lanza en ejecución: acá falla antes. */
const CODE_SINK_MESSAGE =
  'Escribir HTML o código desde una cadena está prohibido (XSS; Trusted Types en la CSP): ' +
  'arme el DOM con una plantilla o con createElement.';

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

// `@ewms/*` menos lo permitido: una biblioteca nueva queda prohibida hasta que alguien la declare.
function restrict(project, allowed, extraPatterns) {
  const allowedText = allowed.length ? allowed.join(', ') : 'nothing from this workspace';
  return [
    'error',
    {
      patterns: [
        {
          group: ['@ewms/*', ...allowed.map((alias) => `!${alias}`)],
          message:
            `Boundary violation: @ewms/${project} may only import ${allowedText}. ` +
            'If this dependency is genuinely needed, the architecture changes first, not this import.',
        },
        ...extraPatterns,
      ],
    },
  ];
}

// Producción y después sus specs, que suman @ewms/testing y nada más: una spec no es la puerta
// trasera de la arquitectura, importa lo que el código probado.
function boundary(project, folder, allowed, extraPatterns = []) {
  const rule = (list) => ({
    '@typescript-eslint/no-restricted-imports': restrict(project, list, extraPatterns),
  });
  return [
    { files: [`${folder}/**/*.ts`], rules: rule(allowed) },
    { files: [`${folder}/**/*.spec.ts`], rules: rule([...allowed, '@ewms/testing']) },
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
    // no-implied-eval solo mira globales declarados: sin esto, `setTimeout('…')` pasaba.
    languageOptions: {
      globals: {
        setTimeout: 'readonly',
        setInterval: 'readonly',
        window: 'readonly',
        globalThis: 'readonly',
        self: 'readonly',
      },
    },
    rules: {
      // ------------------------------------------------ compuertas de seguridad
      // Regla 9. Cada una es error, nunca warning.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: STORAGE_MESSAGE },
        { name: 'sessionStorage', message: STORAGE_MESSAGE },
        { name: 'indexedDB', message: STORAGE_MESSAGE },
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
          // Leer outerHTML no ejecuta nada; asignarlo sí.
          selector: "AssignmentExpression > MemberExpression.left[property.name='outerHTML']",
          message: CODE_SINK_MESSAGE,
        },
        {
          selector: "MemberExpression[property.name='insertAdjacentHTML']",
          message: CODE_SINK_MESSAGE,
        },
        {
          selector: "MemberExpression[object.name='document'][property.name=/^(write|writeln)$/]",
          message: CODE_SINK_MESSAGE,
        },
        {
          // Atrapa `localStorage.setItem(...)`.
          selector: 'MemberExpression[object.name=/^(localStorage|sessionStorage|indexedDB)$/]',
          message: STORAGE_MESSAGE,
        },
        {
          // `window.localStorage` y `globalThis.indexedDB`: no-restricted-globals no ve propiedades.
          selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB)$/]',
          message: STORAGE_MESSAGE,
        },
        {
          // `window['localStorage']`: el nombre llega como cadena, no como identificador.
          selector:
            'MemberExpression[computed=true][property.value=/^(localStorage|sessionStorage|indexedDB)$/]',
          message: STORAGE_MESSAGE,
        },
        {
          selector:
            "MemberExpression[property.name='cookie']:matches([object.name='document'], [object.property.name='document'])",
          message: STORAGE_MESSAGE,
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
  ...boundary('shared', 'projects/shared', [], NO_LEGACY_FORMS),
  ...boundary('api-client', 'projects/api-client', [], NO_LEGACY_FORMS),
  ...boundary(
    'design-system',
    'projects/design-system',
    ['@ewms/shared'],
    [NO_TRANSLATION_LIBRARY, NO_ROUTER, ...NO_LEGACY_FORMS],
  ),
  ...boundary(
    'showroom',
    'projects/showroom',
    ['@ewms/design-system', '@ewms/shared'],
    NO_LEGACY_FORMS,
  ),
  ...boundary('core', 'projects/core', ['@ewms/shared', '@ewms/api-client'], NO_LEGACY_FORMS),
  // El shell arma la app con todo; @ewms/testing, solo en sus specs.
  ...boundary(
    'shell',
    'projects/shell',
    [
      '@ewms/design-system',
      '@ewms/showroom',
      '@ewms/core',
      '@ewms/shared',
      '@ewms/api-client',
      ...DOMAINS,
    ],
    NO_LEGACY_FORMS,
  ),
  ...DOMAINS.flatMap((alias) => {
    const name = alias.replace('@ewms/', '');
    return boundary(name, `projects/domains/${name}`, DOMAIN_ALLOWED, NO_LEGACY_FORMS);
  }),

  // `testing` es solo de desarrollo y usa todo; la API vieja de formularios tampoco entra por ahí.
  {
    files: ['projects/testing/**/*.ts'],
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

// Para las sondas de tools/ci/boundaries.test.mjs: la misma lista, no una copia.
module.exports.DOMAINS = DOMAINS;
