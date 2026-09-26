import { DictionaryUnavailableError, RuntimeConfigInvalidError } from '@ewms/core';

/** Por qué no arrancó, en los casos que el aviso de index.html sabe decir. */
export type StartupFailureCause = 'dictionary' | 'config';

/** El caso del aviso, o `null` si el error no es uno que el aviso explique. */
export function startupFailureCause(error: unknown): StartupFailureCause | null {
  if (error instanceof DictionaryUnavailableError) {
    return 'dictionary';
  }
  return error instanceof RuntimeConfigInvalidError ? 'config' : null;
}

/**
 * Revela el aviso estático de index.html con el mensaje de su causa: sin diccionario o sin
 * configuración, Angular no tiene con qué hablar. El reintento se engancha acá porque la CSP
 * bloquea un onclick en línea (i18n.md, caso B).
 */
export function showStartupFailure(
  document: Document,
  cause: StartupFailureCause,
  reload: () => void,
): void {
  const notice = document.getElementById('startup-failure');
  if (!notice) {
    return;
  }
  for (const message of notice.querySelectorAll<HTMLElement>('[data-cause]')) {
    message.hidden = message.dataset['cause'] !== cause;
  }
  notice
    .querySelector('button')
    ?.addEventListener('click', () => reload(), { once: true });
  notice.hidden = false;
}
