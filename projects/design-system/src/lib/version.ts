import { version } from '../../package.json';

/** Versión del package.json al compilar; el showroom la muestra y no puede leer ese archivo. */
export const DESIGN_SYSTEM_VERSION: string = version;
