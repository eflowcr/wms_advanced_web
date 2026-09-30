# ADR 0011 — Iconografía: Tabler outline, vendorizado

- **Estado:** aceptada
- **Fecha:** 2026-09-15
- **Relacionados:** ADR 0005 (el código es la fuente de verdad de los tokens),
  ADR 0009 (Tailwind como motor, no como sistema de diseño), ADR 0010 (estilado
  sin hojas de estilo por componente).
- Copia en el vault: `02-Arquitectura/Decisiones/0011 - Iconografia Tabler vendorizada.md`.

## Contexto

El set de iconos era el pendiente más transversal del sistema de diseño. Tenía
cinco consumidores identificados en la especificación —`icon`/`iconPosition`
del Botón, `ewms-icon-button`, el `.field-icon` del Input, los iconos de
severidad de Notificaciones y los de KPI del Dashboard— y los dos últimos se
habían dibujado sueltos en Figma, sin set.

Un WMS necesita un vocabulario que un set genérico de interfaz no trae:
montacargas, andén, devolución logística, peso, temperatura, lotes.

## Decisión

### Set

**Tabler Icons, estilo outline.** Licencia MIT, grid de 24×24, trazo de 2
unidades, `stroke-linecap="round"` y `stroke-linejoin="round"`.

### Alternativas evaluadas

| Set | Resultado | Por qué |
|---|---|---|
| **Tabler** | elegido | El único de los tres con el vocabulario de almacén completo: `truck-delivery`, `truck-loading`, `truck-return`, `packages`, `forklift`, `weight`, `thermometer`. |
| **Lucide** | descartado | Mejor carácter de dibujo, pero peor cobertura de almacén. Habría obligado a dibujar a mano buena parte del vocabulario de dominio. |
| **Phosphor** | descartado | Sin montacargas, sin temperatura y sin devolución logística. |

**Ningún set del mercado tiene icono de tarima (pallet).** Se dibuja propio.

### Vendorizado, no dependencia de runtime

Los iconos **no entran como dependencia de runtime**. Se vendoriza un
subconjunto curado dentro del repositorio, por la misma razón que el ADR 0009
da para Tailwind: el paquete es motor, no sistema de diseño. Importar
`@tabler/icons` en runtime pondría 5.000+ iconos a un `import` de distancia y
el catálogo dejaría de ser una decisión.

- `projects/design-system/src/icons/icons.manifest.json` es la **allowlist y
  la única fuente de verdad** de qué iconos existen: nombre semántico del
  producto (inglés, kebab-case) → archivo de origen.
- `tools/icons/build-icons.mjs` lee el manifiesto, extrae **solo la
  geometría** de cada SVG (descarta el `<path>` de bounding box invisible de
  Tabler y todos los atributos de presentación) y emite
  `icons.generated.ts`: un objeto tipado cuyo union `IconName` hace que un
  nombre inválido sea error de compilación, no un icono en blanco en
  producción.
- El archivo generado **se commitea**; no se genera en el build.
- `@tabler/icons` entra como `devDependency` con versión exacta,
  **únicamente** para que el script regenere el subconjunto de forma
  reproducible.
- La compuerta 11 de CI (`tools/ci/check-icons.mjs`) regenera en memoria y
  compara byte a byte con lo commiteado, como un lockfile, y falla si aparece
  un `<svg>` escrito a mano en una plantilla.

**Alternativa descartada — dependencia de runtime** (`@tabler/icons-angular` o
similar): cero mantenimiento, pero el conjunto disponible es todo Tabler, cada
icono llega con sus atributos de presentación, y los iconos propios quedarían
en un segundo mecanismo distinguible del primero.

### Iconos de dominio propios

La tarima, y cualquier icono de dominio que falte en Tabler, **se dibuja sobre
el mismo grid de 24 y con el mismo trazo de 2**, en el mismo formato de archivo
que Tabler (el `<path>` de bounding box es opcional en un icono propio), y vive
en `projects/design-system/src/icons/custom/`. El script lo
procesa con exactamente el mismo tratamiento: en el archivo generado y en el
consumo **no hay forma de distinguir el origen**. Si mañana Tabler publica
`pallet`, se cambia una línea del manifiesto y nada más.

### Renderizado

`<ewms-icon>` recorre las primitivas con `@for` y liga `[attr.d]` de cada
`<path>`. **Prohibido `innerHTML` y `DomSanitizer`**: la
geometría es dato, no marcado. El color es siempre `currentColor`.

**El formato admite solo `<path>`, a propósito** (2026-09-15): Tabler outline y
la tarima son solo `path`, así que `circle`/`rect`/`line` eran tres tipos, tres
reglas del generador y tres ramas de plantilla que ningún icono alcanzaba; una
forma así se convierte a `path` antes de entrar, y el generador lo exige con ese
mensaje.

### Licencia

La atribución MIT de Tabler vive **una sola vez** en `THIRD-PARTY-NOTICES.md`,
en la raíz del repositorio, con el texto de licencia completo. No se pone
atribución en cada archivo.

## Consecuencias

**Se gana** un catálogo cerrado y revisable en un diff, sin peso de runtime por
iconos que nadie usa, con nombres del producto en vez de nombres de un
proveedor, y con los iconos propios indistinguibles de los de Tabler.

**Se sacrifica** el "agregar un icono en un minuto": cada icono nuevo es un PR
que edita el manifiesto y regenera. Es el costo buscado.

**Se sacrifica** tree-shaking por icono: la tabla completa viaja junta, y viaja en la
**ruta crítica de `/`**, porque el marco (navegación, cabecera, pestañas) dibuja iconos.
Cuántos iconos tiene la tabla y lo que mide la ruta crítica que la lleva están en
el vault: `01-Proyecto/Base del proyecto.md` §10.

**Actualizar Tabler** es un bump de la `devDependency` + `npm run icons:build`;
la compuerta 11 obliga a hacerlo en el mismo PR.

## Condición de revisión

**Cada icono nuevo pasa por el techo de la ruta crítica de `/`**: la regla 17 de
Integración Continua (`tools/ci/check-critical-path.mjs`), 532 kB crudos, Decisión del
usuario (2026-09-26). Se agrega, se mide la ruta crítica, y si el techo no alcanza,
se decide a propósito —el icono o el techo—, nunca en silencio.

Se reevalúa el vendorizado si el peso de la tabla en la ruta crítica deja de ser
despreciable frente a ese techo (el costo de no poder hacer tree-shaking), o si
Tabler cambia de licencia.
