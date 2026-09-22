/*
 * API pública de @ewms/showroom: única entrada legal a la librería; nada de afuera entra a
 * src/lib/** directo (fronteras en eslint.config.js).
 */
export { showroomRoutes } from './lib/showroom.routes';

export { provideShowroomDesignSystem } from './lib/showroom.providers';

/** Para que el shell nombre un favorito del showroom con el nombre del catálogo. */
export { catalogNameFor } from './lib/catalog';
