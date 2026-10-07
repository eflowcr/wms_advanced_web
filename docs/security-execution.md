# Seguridad y Usuarios: diseño y ejecución

Alcance autorizado: simulación frontend en memoria, catálogo cerrado y perfiles con concesiones positivas. Sin persistencia, autenticación ni endpoints definitivos. Se preservan los cambios locales de CSV/TSV.

Arquitectura: core publica contratos, catálogo, cálculo y estado de acceso. El dominio security implementa el puerto asíncrono y las pantallas. El shell conecta el adaptador exclusivamente en una compilación explícita de demostración; producción permanece sin identidad ni concesiones. La navegación, pestañas y favoritos consumen la misma decisión que las acciones.

Las asignaciones son tuplas exactas usuario/perfil/almacén/propietario. Cada acción requiere acceso a su pantalla. Las escrituras validan versión, autoridad en todos los alcances afectados, ausencia de autoescalamiento y conservación de administrador por contexto. El cambio de identidad/contexto aborta operaciones previas y vacía datos protegidos.

## Incrementos y aceptación

- [x] Catálogo y cálculo: pruebas de unión, procedencia, denegación y aislamiento exacto.
- [x] Integración: URL, revocación, navegación, favoritos, pestañas, contexto y respuestas tardías.
- [x] Seguridad: edición con resumen, asignaciones, validación, autoridad y concurrencia.
- [x] Usuarios: consulta, búsqueda, filtros, formulario y estado; exportación/TSV independiente.
- [x] Verificación: controles existentes, compilación, presupuestos, navegador ES/EN y móvil, documentación y bóveda.

Ejecución cerrada siguiendo el loop inspeccionar/probar/implementar/verificar/corregir/documentar. El alcance frontend está implementado y verificado; las decisiones operativas del backend conservan su registro separado.

## Reproducción

1. En el repositorio, ejecutar `npm start` y abrir `/configuracion/perfiles` (Seguridad) o `/configuracion/usuarios` (Usuarios).
2. En la franja de demostración elegir actor y contexto exacto A/X o B/Y. Administrador puede gestionar ambos ámbitos; Consulta puede consultar e inspeccionar, sin escribir ni exportar. Operación limitada puede crear/editar usuarios en A/X y solo consultar en B/Y.
3. Crear un perfil, habilitar una acción y confirmar su dependencia de consulta. Revisar el resumen antes de guardar. Asignarlo a Rosa Consulta en una tupla exacta y comprobar los perfiles de procedencia del acceso resultante.
4. Abrir Usuarios con Operación limitada, comenzar una edición y cambiar a B/Y: el borrador y los datos anteriores se retiran. Abrir Seguridad con Administrador y cambiar a Operación limitada A/X: se revoca la pantalla, se cierran sus pestañas y se redirige al inicio.
5. Recargar reinicia los datos. Usuarios, perfiles y concesiones nunca se guardan en `localStorage`, `sessionStorage` ni cookies.

`npm run build:demo` genera `dist/shell-demo/browser`; `npm run build` genera `dist/shell/browser`. Son artefactos distintos. Producción carece del selector y del actor sintético conectado; las URL operativas se deniegan sin un proveedor de acceso válido. No se modifica esa política para hacer pasar las pruebas.

## Contratos y reglas

| Contrato | Responsabilidad |
| --- | --- |
| `@ewms/core/security` | Catálogo cerrado, tipos, unión/procedencia, estado de acceso y guard |
| `@ewms/security` | Rutas y pantallas lazy; adaptador `MemorySecurityGateway` |
| `@ewms/core/locale` | Proveedor de formatos en el entorno diferido del shell |
| `SecurityGateway` | Lecturas y escrituras asíncronas, actor/contexto, `AbortSignal`, versiones y suscripción a cambios |
| `Table.allowExport` | Predicado genérico del consumidor que controla CSV y copiado al ejecutar; el DS no conoce capacidades |
| `FavoritesNav.visible` | Predicado de visibilidad que conserva las preferencias sin exponer destinos revocados |

- Una capacidad de acción necesita la consulta de su pantalla en el perfil que la concede. No existen comodines, denegaciones competitivas ni permisos directos por usuario. Las concesiones iniciales del administrador son una lista explícita: ampliar el catálogo no concede funciones futuras.
- Los contextos válidos son combinaciones registradas, nunca el producto de listas independientes. Inactivos o identidades desconocidas no reciben acceso.
- Consultar Seguridad, administrar perfiles, asignar perfiles e inspeccionar acceso son capacidades independientes. La inspección exige autoridad también en el contexto consultado.
- El adaptador revalida después de la latencia. Las escrituras necesitan autoridad en todos los contextos afectados, no pueden otorgar capacidades fuera de la autoridad del actor ni autoescalarlo, y deben conservar un usuario activo con las cuatro capacidades administrativas en cada contexto.
- Los cambios de asignaciones preservan las tuplas fuera del alcance editable. Las lecturas no exponen usuarios de otros ámbitos. Un usuario nuevo sin asignaciones permanece asociado al contexto de creación para su gestión sintética.
- Perfiles y usuarios usan su versión; asignaciones usan la versión de la instantánea. Un conflicto mantiene el borrador y exige una decisión explícita. No se reintenta una escritura rechazada.
- `AccessStore` aborta solicitudes y vacía concesiones al cambiar actor/contexto. Las páginas retiran datos y borradores correspondientes y descartan respuestas antiguas. Guard, menú, favoritos, pestañas, botones, menú de fila, atajos y exportación consumen la misma decisión.

## Evidencia del loop

Las pruebas detectaron y guiaron correcciones de aislamiento: conservar asignaciones invisibles al editar un ámbito, impedir inspección en un contexto fuera de autoridad y comprobar versiones de usuarios después de esperar. También cubren colisiones de creación concurrente, último administrador, duplicados, dependencia de consulta y respuestas tardías.

La revisión del navegador corrigió semántica de listas de definición vacías, contraste de las filas de asignaciones y controles de pruebas que asumían acceso operativo en producción. Las pruebas móviles comprueban la trampa de foco y el contenido bajo `inert`, preservando las regiones vivas. El showroom verifica también arrastre real con el separador visible.

Para mantener los presupuestos se separaron los puntos de entrada de seguridad y formatos, y se difirió la ayuda de atajos con seguimiento de tareas pendientes. El cálculo de ruta crítica incluye los chunks necesarios del shell diferido; no se incrementaron sus límites.

Una ejecución local superpuesta de Vitest y Playwright produjo saturación de memoria y tiempos de espera. Se detuvo exclusivamente ese árbol de pruebas. Iconografía todavía agotó su tiempo con cuatro trabajadores, un problema local ya registrado en la bóveda; Vitest local utiliza un trabajador y CI conserva su runner. La verificación de cierre se ejecuta con ese límite, sin aumentar tiempos máximos, reintentos ni reducir cobertura.

## Verificación final

Resultados fechados el 2026-10-05. Comandos: `npm run typecheck`, `npm test`, `npm run lint`, `lint:tokens`, `lint:icons`, `lint:shortcuts`, `lint:click-budget`, `lint:ds`, `lint:i18n`, `lint:comments`, `lint:identifiers`, `npm run build:libs`, `npm run build`, `npm run build:demo`, `lint:critical-path`, Playwright smoke/domain/showroom y `npm run vault:check -- ../eWMS_Advance`.

| Comprobación | Resultado |
| --- | --- |
| Typecheck, ESLint y nueve compuertas `lint:*` | Aprobadas |
| Shell / Core / Design system / Shared | 58 / 95 / 754 / 3 pruebas aprobadas, con sus pisos originales |
| Showroom unitario completo | 369 pruebas aprobadas; cobertura 99,08% / 94,67% / 98,07% / 99,05%, con sus pisos originales |
| Seguridad | 19 pruebas aprobadas; cobertura 74,15% / 71,45% / 79,90% / 80,53% (sentencias / ramas / funciones / líneas) |
| Herramientas del repositorio | 308 pruebas aprobadas |
| Bibliotecas | Las siete compiladas con ng-packagr; incluye las entradas secundarias de Core |
| Producción / demostración | Ambas compiladas en directorios separados |
| Carga inicial de producción | 365,92 kB < 378 kB |
| Ruta crítica de `/` | 526,95 kB < 537 kB; cierre de 35 archivos |
| Showroom en navegador | 224 pruebas aprobadas |
| Smoke / dominio en navegador | 15 / 10 pruebas aprobadas sobre los artefactos finales |
| Bóveda | Enlaces, redacción, referencias, frontmatter y tokens: cero hallazgos |

La ejecución integral local de `npm test` detectó un tiempo agotado de cinco segundos en `ShowroomTable` («carries the eight blocks, in order»), con 368 de las 369 pruebas del showroom aprobadas. Su diagnóstico filtrado aprobó las 20 pruebas de Tabla; la cobertura reducida de ese diagnóstico no se aceptó como comprobación del catálogo completo. La revalidación posterior con `npx ng test showroom --no-watch` aprobó las 369 pruebas y los cuatro umbrales completos, sin cambiar el límite de cinco segundos. La última secuencia devolvió código cero para showroom completo, Seguridad con su piso elevado y smoke/domain. En conjunto, las seis suites unitarias aprobaron 1.298 pruebas; herramientas aprobaron 308 y navegador 249. No se presenta la ejecución inicialmente interrumpida de `npm test` como una corrida integral exitosa.

Los logs de ejecución y diagnóstico se conservan localmente en `.angular/cache/security-verification-20261005-01a10d14/`, fuera de los cambios de código. El informe conserva los resultados necesarios aunque se limpie la caché de Angular.

La cobertura de cada biblioteca conserva su umbral existente. Seguridad añade una compuerta medida de 74/71/79/80 y pruebas del cálculo, adaptador, operaciones de páginas y plantilla real. Las pruebas de navegador usan los diccionarios reales ES/EN, axe con criterios WCAG aplicables y móvil/escritorio; los casos no convierten una revisión automatizada en certificación completa de accesibilidad.

## Matriz agrupada y revisión de concesiones

La matriz organiza el catálogo en General (destinos internos), Catálogos y Configuración, siguiendo las rutas del menú. La búsqueda admite nombre de pantalla o módulo; «Solo con permisos» muestra únicamente pantallas configurables con acceso concedido. Ambos filtros se combinan y no modifican el perfil ni el resumen global.

El resumen muestra el nombre del perfil y los totales de pantallas y acciones concedidas. Durante una edición refleja el borrador y lo indica explícitamente. Excluye destinos internos y acciones sin acceso a su pantalla. Cada tarjeta distingue acceso común, sin acceso, acceso parcial y acceso completo, con el número de acciones concedidas cuando corresponde. El acceso efectivo del usuario se consulta por separado y utiliza las asignaciones guardadas y su contexto.

Los controles de concesión requieren gestión vigente y se bloquean durante la escritura. Quitar el acceso de pantalla retira sus acciones dependientes; agregar una acción exige confirmar la concesión de pantalla cuando falta. Los filtros conservan permisos ocultos y cancelar restaura las concesiones guardadas. Si la tarjeta desaparece tras retirar su acceso con el filtro activo, el foco vuelve al filtro.

Para incorporar otra pantalla, se declara su ruta y capacidades concretas en `SCREEN_CATALOG`, se integra su decisión `AccessStore.can` en guard, navegación y cada ejecución de acción, y se añaden pruebas de permiso concedido, denegado y revocado. Las rutas `/catalogos/` y `/configuracion/` se agrupan automáticamente. Para un módulo nuevo, se amplían las claves de agrupación en `SecurityPage.moduleKey` y sus traducciones. El catálogo no concede automáticamente acciones nuevas ni expone botones operativos para pantallas en construcción.

La mejora de matriz se verificó entre el 2026-10-05 y el 2026-10-06: 19 pruebas del dominio aprobadas, con cobertura de 76,61% / 74,00% / 81,94% / 82,43% y los pisos existentes intactos. La corrida final de Playwright aprobó los 15 escenarios smoke y los 12 escenarios del dominio en 54,1 segundos, sin reintentos. Incluye conceder una acción con dependencia, asignarla en A/X, crear un usuario mediante el botón habilitado y verificar que B/Y conserva consulta. Las comprobaciones axe ES/EN esperan la matriz y tabla cargadas antes de analizar sus controles, en escritorio y móvil. La vigilancia de consola detecta también claves de Seguridad sin traducir.

Tipos, ESLint, compuertas visuales/i18n y bóveda aprobaron. Se compilaron la biblioteca de Seguridad, producción y demostración. La carga inicial conserva 365,92 kB y la ruta crítica 526,95 kB, dentro de 378/537 kB. La revisión independiente de código no encontró defectos materiales. Logs y capturas de esta mejora están en `.angular/cache/matrix-*`.

Una corrida previa de navegador detectó una recarga por fallo al cargar un chunk en producción; el caso aislado y las posteriores suites smoke completas aprobaron sin cambios en su contrato de denegación. Otra corrida identificó una espera incorrecta de Playwright al usar `uncheck()` sobre una casilla cuya tarjeta desaparece inmediatamente: el escenario ahora comprueba el estado inicial, hace clic y verifica la desaparición, el resumen y el foco. Se conservan ambos diagnósticos; los resultados finales corresponden a la corrida completa posterior.

## Backend y documentación

La simulación no implementa autenticación, sesiones reales, persistencia, auditoría operativa ni endpoints. El servidor deberá verificar cada petición y alcance, resolver identidad/contexto, aplicar concurrencia y las invariantes administrativas en una transacción y publicar su contrato OpenAPI. Debe validar además el alcance de creación de usuarios, la recuperación administrativa y la gobernanza de capacidades nuevas. Estas decisiones tienen responsables y disparadores en `01-Proyecto/Pendientes.md`.

La bóveda contiene el módulo `03-Modulos/Seguridad.md`, el contrato `05-API/Seguridad y usuarios.md`, el requisito `04-Requisitos/REQ-FE-SEC-001 - Seguridad y usuarios.md` y la decisión `02-Arquitectura/Decisiones/0020 - Perfiles con asignaciones por contexto.md`, con índices y arquitectura actualizados. La propuesta previa enlaza el estado implementado.

Los cambios quedan revisables en `STG-EXPORT-SECURITY`, preservando la protección previa contra fórmulas de CSV/TSV. No se ejecutan reset, limpieza destructiva, commit, merge, push ni despliegue.
