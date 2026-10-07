# Matriz de seguridad por módulo

Diseño aprobado: agrupar pantallas siguiendo Catálogos y Configuración; reunir las pantallas internas en General. Mostrar el nombre del perfil, sus pantallas y acciones concedidas, y señalar cuándo se está viendo un borrador. Añadir «Solo con permisos» combinado con la búsqueda por pantalla o módulo. Las pantallas internas no son concesiones administrables. Ningún filtro modifica el perfil ni afecta al resumen global.

Implementación y verificación:

- [x] Probar primero el renderizado de grupos, resumen, filtro combinado y actualización del borrador sin pérdida de concesiones ocultas.
- [x] Implementar derivaciones de la matriz sobre el catálogo cerrado existente; mantener dependencias y autorización en pantalla, botón, atajo y gateway.
- [x] Añadir textos ES/EN y estados claros para concesiones completas, parciales y ausentes.
- [x] Verificar pruebas del dominio, flujo real de navegador, accesibilidad ES/EN en escritorio y móvil, tipos, lint, traducciones, builds y presupuestos.
- [x] Documentar el comportamiento y la integración de futuras pantallas y acciones en el repositorio y el vault.

No se incorporan concesiones masivas ni acciones de pantallas todavía en construcción. La autorización definitiva del servidor sigue siendo el contrato documentado para la integración backend.
