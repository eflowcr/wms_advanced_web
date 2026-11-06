# Changelog

Formato de [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/); versiones
según [SemVer 2.0.0](https://semver.org/lang/es/) (DEV-007). La etiqueta `vX.Y.Z` la pone
quien fusiona `development` en `main`. Convención de ramas y versiones: ADR 0018 del vault.

## [0.1.0] — sin fecha: la de la fusión a `main`

Primera versión numerada: el Sprint 0 del frente web (el sistema de diseño) y su base.
Hasta acá el proyecto estaba en `0.0.0`. Lo que contiene, por pull request fusionado a
`development`:

### Agregado

- Seguridad y Usuarios: perfiles, concesiones positivas, asignaciones exactas por almacén/propietario, procedencia y administración con control de versión; adaptador asíncrono sintético y demostración separada de producción.
- Control común de acceso en rutas, navegación, pestañas, favoritos y acciones; exportación/copiar independiente de consulta. Documentación del módulo, contratos y decisiones en la bóveda.
- Matriz de permisos agrupada por módulo, resumen del perfil y borrador, búsqueda de pantallas/módulos y filtro de concesiones con recuperación de foco.
- Security Core contra el simulador HTTP del contrato: sesión con token en memoria y renovación en cookie, login y guard de sesión; almacén activo en la cabecera con cambio sin reautenticarse; `*ewmsCan` con códigos `modulo.opcion:accion` y la compuerta `lint:permissions`; afiliación, vigencia, alta masiva y rechazos de la comanda; revisión de accesos por campaña; segundo factor bajo demanda (RFC 9470) con `Idempotency-Key`.
- Login con el panel de marca, la entrada escalonada y la ruta del éxito durante la bienvenida, quieto con movimiento reducido.
- `production-artifact.test.mjs`: el build de producción no lleva ni el simulador ni la franja de demostración, que entran solo por `fileReplacements`.
- Tabla con filtros, chips, topes de ancho, fila de totales, acciones confirmadas y vistas guardadas por usuario y tabla (#36).
- El marco con capas por token, cajón y comentarios de tres líneas (#27); fronteras en lista blanca, ruta crítica con techo, E2E contra producción, Trusted Types, CI endurecido y el resto de la base (#28, #30).
- Compuertas de CI bloqueantes y Dependabot sobre `main`/`development` (#4).
- DS-2 a DS-4: sistema de diseño, showroom y patrones (#9, #12).
- DS-5: App Shell, navegación, favoritos y la suite E2E en tres niveles (#13).
- Componentes: botón, select, diálogo, split button y date picker (#19).
- Tabla con diferenciadores y select con búsqueda (#21); tabla terminada y patrones de
  formulario, filtros y estado vacío (#22).
- Formularios con Signal Forms (#23).
- El catálogo con diccionario propio y en inglés (#26).

### Cambiado

- Protección contra fórmulas en CSV y copiado para Excel, incluidos encabezados; los números legítimos conservan su formato.
- Optimización de CI, pruebas y comentarios (#16); comentarios en español en todo el
  repositorio (#17, #18).
- Cierres técnicos sin errores ni desviaciones (#15, #24, #25).
- Angular 22.2, y la ruta crítica leída de `browser-stats.json` (#36).
- Topes de tiempo por job a cuatro veces lo medido y apt con corte y reintento (#35).
- Las E2E de dominio miden con el axe común de WCAG 2.2 AA, `target-size` incluido.
- Pisos de cobertura de `core` y `security` al valor medido.

### Dependencias

- Actualizaciones de Dependabot (#5, #6, #31, #33, #34) y `npm audit fix` (#35).
- `source-map-js` 1.2.2 por GHSA-68fv-2mgg-jv7q.

[0.1.0]: https://github.com/eflowcr/wms_advanced_web/releases/tag/v0.1.0
