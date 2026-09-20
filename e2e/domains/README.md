# `domain` — el tercer nivel de la suite, todavía vacío

Aquí van los E2E de los dominios verticales (DS-6): recepción, picking,
despacho, inventario. Hoy no hay ninguno, y la carpeta existe igual.

La razón es la de siempre con las fronteras de este repositorio: **una
frontera es barata cuando está vacía.** El día que llegue el primer dominio,
el único sitio donde poner sus pruebas sería `showroom`, y así es como una
suite que se dividió deja de estar dividida.

El proyecto se declara en `playwright.config.ts` con `testMatch:
'domains/**/*.e2e.ts'`. Correr `npm run e2e:domain` sin archivos aquí no
encuentra pruebas y lo dice; `npm run e2e` completo no se ve afectado.
