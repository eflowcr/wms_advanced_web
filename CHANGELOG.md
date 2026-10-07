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

### Dependencias

- Actualizaciones de Dependabot (#5, #6).

### Pendiente de fusión

Si se fusionan antes de la etiqueta, entran también las ramas `STG-LAYOUT` (el marco con
capas por token, cajón y comentarios de tres líneas) y `STG-BASE` (fronteras en lista
blanca, ruta crítica con techo, E2E contra producción, Trusted Types, CI endurecido y el
resto de la base). Sus números de PR los da GitHub al abrirlos.

[0.1.0]: https://github.com/eflowcr/wms_advanced_web/releases/tag/v0.1.0
