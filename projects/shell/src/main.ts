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
 * Case B of i18n.md, "Cuando el diccionario no carga": no dictionary loaded,
 * so nothing Angular renders could say anything. The notice is static HTML in
 * index.html, written in both languages; this only reveals it and wires the
 * retry button (an inline onclick would be blocked by the CSP).
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
