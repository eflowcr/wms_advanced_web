# Domain E2E

Security and Users use the explicit synthetic artifact at port 4401. Production smoke and showroom use port 4400. Playwright builds both into separate output directories; reload resets the demo data.

Run `npm run e2e:domain`. CI requires this suite to find and pass tests. The scenarios cover Administrator, Consultation, Limited operation, context changes, revocation, provenance, keyboard, ES/EN, mobile and accessibility.

The grouped permission matrix covers module search, the granted-only filter, global draft counts, hidden grants, cancellation and focus recovery. A complete flow grants one dependent action, assigns it in A/X, creates a user through its newly enabled button and verifies that B/Y retains consultation. Accessibility waits for the matrix and table to load before scanning their controls. Console checks include untranslated Security keys.
