import { version } from '../../package.json';

/**
 * La versión de @ewms/design-system, tomada de su propio package.json en tiempo de
 * compilación. Se exporta porque el showroom muestra qué versión estás mirando, y
 * una versión tipeada a mano está mal la primera vez que se sube la librería. El
 * showroom no puede leer ese package.json: cruzar a otro proyecto por ruta relativa
 * es lo que la API pública existe para impedir.
 */
export const DESIGN_SYSTEM_VERSION: string = version;
