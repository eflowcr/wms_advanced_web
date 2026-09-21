import { bootstrapApplication } from '@angular/platform-browser';
import { DictionaryUnavailableError } from '@ewms/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  if (err instanceof DictionaryUnavailableError) {
    showStartupFailure();
  }
  console.error(err);
});

/**
 * Caso B de i18n.md: sin diccionario, Angular no tiene con qué hablar. Revela el aviso
 * estático de index.html y engancha el reintento acá porque la CSP bloquea un onclick en línea.
 */
function showStartupFailure(): void {
  const notice = document.getElementById('startup-failure');
  if (!notice) {
    return;
  }
  notice
    .querySelector('button')
    ?.addEventListener('click', () => window.location.reload(), { once: true });
  notice.hidden = false;
}
