/*
 * Public API surface of @ewms/showroom
 *
 * This is the ONLY legal entry point into this library. Nothing outside it may
 * reach into src/lib/** directly -- see the boundary rules in eslint.config.js.
 *
 * The showroom is deliberately near-empty in Fase 0: it exposes just the lazy
 * route tree the shell mounts at /design-system. Component galleries land in Fase 2.
 */
export { showroomRoutes } from './lib/showroom.routes';
