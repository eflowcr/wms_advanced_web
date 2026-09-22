import { _CdkPrivateStyleLoader } from '@angular/cdk/private';
import type { Provider } from '@angular/core';

/**
 * El CDK cuelga un `<style>` en tiempo de ejecución al abrir el primer overlay, y la CSP
 * (`style-src 'self'`, sin hash ni nonce) lo bloqueaba con un error en consola. Sus dos hojas
 * (`overlay-prebuilt.css`, `a11y-prebuilt.css`) ya entran por `styles.css`: acá se calla el cargador.
 */
export const CDK_STYLES_FROM_STYLESHEET: Provider = {
  provide: _CdkPrivateStyleLoader,
  useValue: { load: (): void => undefined },
};
