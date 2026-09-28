/*
 * API pública de @ewms/showroom: única entrada legal a la librería; nada de afuera entra a
 * src/lib/** directo (fronteras en eslint.config.js).
 */
export { showroomRoutes } from './lib/showroom.routes';

/** Para que el shell nombre una página del catálogo (favorito, pestaña) con su nombre traducido. */
export { catalogKeyFor } from './lib/catalog';
