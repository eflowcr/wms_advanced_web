# eWMS Advance — frontend

Angular workspace for the eWMS Advance WMS: the web console shell, the
`@ewms/design-system` component library with its internal catalogue at
`/design-system`, and every CI gate wired and blocking. Product screens arrive
with the first business domain, once the backend exists; until then the menu
destinations render an "under construction" page.

Design decisions, component specs and the working log live in the team vault
(Obsidian), not in this repository.

## Runtime

Node **24 LTS**, in four places that must agree: `.node-version` holds the
exact version CI runs (read by fnm and by `node-version-file` in `ci.yml`),
`engines.node` in `package.json` the range the toolchain accepts, and
`engine-strict=true` in `.npmrc` makes a Node outside that range fail
`npm install` immediately instead of failing strangely several commands later.
`tools/ci/workflow-hardening.test.mjs` keeps them in step.

```
fnm use          # picks up .node-version
npm ci
npm start        # http://localhost:4200
```

> Review the Node major in **Q1 2027**: Node 24 enters Maintenance on
> 2026-10-20 when Node 26 takes Active LTS, and runs until April 2028.

## Versions and branches

SemVer on the root `package.json`, one entry per release in `CHANGELOG.md`;
the `vX.Y.Z` tag is set when `development` is merged into `main`. Work branches
are named `STG-<TOPIC>` and go back to `development` through a PR. The why
lives in the vault (ADR 0018).

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server for the shell app |
| `npm run build` | Production build (bundle budgets apply) |
| `npm run build:libs` | ng-packagr build of every library |
| `npm run typecheck` | `tsc` in full strict mode |
| `npm run lint` | ESLint, including the boundary and security rules, zero warnings |
| `npm test` | Vitest per library + coverage thresholds + axe-core, then the tool tests |
| `npm run lint:tokens` / `lint:icons` / `lint:i18n` / `lint:shortcuts` / `lint:click-budget` / `lint:ds` | The project's own CI gates |
| `npm run e2e:smoke` | Playwright: the app boots, every route answers, the patterns work by keyboard |
| `npm run e2e:showroom` | Playwright: the whole catalogue (axe, keyboard, overflow, behaviour) |
| `npm run showroom:capture` | Screenshots of every catalogue page, for review; not a test |
| `npm run audit:ci` | `npm audit --audit-level=high` |
| `npm run vault:check-tokens -- <vault>` | Lists `--color-*` names cited in the docs vault that `tokens.css` does not define. Manual tool, **not a CI gate**: the vault is outside this repo |

## Layout

```
projects/
  shell/            the application (app + layout/ + pages/)
  design-system/    @ewms/design-system   tokens, components, patterns
  showroom/         @ewms/showroom        internal route /design-system, not Storybook
  core/             @ewms/core            cross-cutting runtime concerns
  shared/           @ewms/shared          leaf utilities (filters in the URL), depends on nothing
  api-client/       @ewms/api-client      reserved for the client generated from OpenAPI (empty until the backend publishes it), depends on nothing
  testing/          @ewms/testing         dev-only test helpers
e2e/                Playwright specs (*.e2e.ts)
```

## Design tokens

`projects/design-system/src/styles/tokens.css` **is the source of truth** for
every colour, spacing, radius, shadow and type value. It is written and reviewed
by hand, in a pull request, like any other code. Nothing generates it and
nothing syncs it.

**No component may contain a raw design value.** If a token is missing, it gets
added to `tokens.css` first — never inlined into a component "for now".
`npm run lint:tokens` fails the build on a raw value.

Figma is archived design reference, not a live dependency. Where Figma and this
file disagree, this file wins: it is what compiles. See ADR 0005.

<!--
  projects/domains/ does not exist yet. The eight business domains land there,
  one library each, once the primitives exist:

      security, inventory, kardex, decisions, audit, outbox, extensibility, tasks

  Each gets its own @ewms/<name> alias (@ewms/inventory, @ewms/kardex, ...) and
  falls under the domain row of the dependency table below.
-->

## Dependency rules

The frontend mirror of the backend architecture rule: no module reaches into
another module's internals; every crossing goes through a public interface. Here
that interface is the `@ewms/*` alias, which resolves to the library's
`public-api.ts`.

| Library | May import | Never imports |
| --- | --- | --- |
| `shell` | everything (`@ewms/testing` only in specs) | — |
| `showroom` | design-system, shared | core, api-client, testing, domains |
| `design-system` | shared | core, api-client, showroom, domains, `@angular/router`, `@jsverse/*` |
| `core` | shared, api-client | design-system, showroom, domains |
| `domains/X` | design-system, core, shared, api-client | showroom, **another domain** |
| `shared` | nothing from the project | everything |
| `api-client` | nothing from the project | everything |
| `testing` | everything (dev only) | — |

Deep relative imports across projects (`../../design-system/src/lib/...`) are
forbidden; so is reaching past a public API (`@ewms/design-system/src/...`).

**Spec files get exactly one extra privilege: `@ewms/testing`.** Every other
boundary stays live inside a `*.spec.ts`. A test file is not a back door into
the architecture — what a spec may import is what the code under test will end
up being written against. `@ewms/testing` itself remains forbidden in production
code, specs only.

These rules are **ESLint errors that fail CI**, not a good-faith agreement, and
they are an **allowlist**: each library declares the `@ewms/*` it may import and
everything else fails, so a new library is off-limits until someone declares it.
See [`eslint.config.js`](./eslint.config.js).
[`tools/ci/boundaries.test.mjs`](./tools/ci/boundaries.test.mjs) probes every
boundary with one allowed and one forbidden import, and runs in `npm test`.

## Conventions

- **Identifiers in English; comments and UI in Spanish.** Folders, files,
  classes, properties and models are English, matching the database tables.
  UI text lives in the i18n files; code comments are Spanish, short, and point
  to the vault for the long reason.
- Files in kebab-case, with no type suffix: `button.ts`, never
  `button.component.ts`.
- Selector prefixes: `ewms-` for the design system, `app-` for the shell.
  Domain prefixes (`inv-`, `sec-`) arrive with `projects/domains/`.
- Standalone components and lazy routes only. No NgModules.
- Signals by default: `input()`, `output()`, `computed()`.
- Forms: **Signal Forms** (ADR 0013). A field implements `FormValueControl` or
  `FormCheckboxControl` with `model()`, and the `[ewmsForm]` pattern submits with
  `submit()`. Importing `@angular/forms` is a lint error.
- OnPush is the Angular 22 default and is not configured per component.
