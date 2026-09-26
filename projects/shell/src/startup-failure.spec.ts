import { DictionaryUnavailableError, RuntimeConfigInvalidError } from '@ewms/core';
import { showStartupFailure, startupFailureCause } from './startup-failure';

/** La forma del aviso de index.html: los dos mensajes de cada causa, y el reintento. */
function mountNotice(): HTMLElement {
  document.body.replaceChildren();
  const notice = document.createElement('div');
  notice.id = 'startup-failure';
  notice.hidden = true;
  for (const [cause, lang, hidden] of [
    ['dictionary', 'es', false],
    ['dictionary', 'en', false],
    ['config', 'es', true],
    ['config', 'en', true],
  ] as const) {
    const message = document.createElement('p');
    message.dataset['cause'] = cause;
    message.lang = lang;
    message.hidden = hidden;
    notice.append(message);
  }
  notice.append(document.createElement('button'));
  document.body.append(notice);
  return notice;
}

const shown = (notice: HTMLElement) =>
  [...notice.querySelectorAll<HTMLElement>('[data-cause]')]
    .filter((message) => !message.hidden)
    .map((message) => `${message.dataset['cause']}/${message.lang}`);

describe('the startup failure notice', () => {
  it('an invalid configuration shows the notice, with the configuration message', () => {
    const notice = mountNotice();

    const cause = startupFailureCause(new RuntimeConfigInvalidError('unknown field(s) x'));
    expect(cause).toBe('config');
    showStartupFailure(document, 'config', () => undefined);

    expect(notice.hidden).toBe(false);
    expect(shown(notice)).toEqual(['config/es', 'config/en']);
  });

  it('a missing dictionary shows the language message, as before', () => {
    const notice = mountNotice();

    expect(startupFailureCause(new DictionaryUnavailableError('es'))).toBe('dictionary');
    showStartupFailure(document, 'dictionary', () => undefined);

    expect(shown(notice)).toEqual(['dictionary/es', 'dictionary/en']);
  });

  it('any other error is not the notice’s to explain', () => {
    expect(startupFailureCause(new Error('boom'))).toBeNull();
  });

  it('without the notice in the page, it does nothing and does not throw', () => {
    document.body.replaceChildren();

    expect(() => showStartupFailure(document, 'config', () => undefined)).not.toThrow();
  });
});

describe('the retry button', () => {
  it('reloads, once', () => {
    const notice = mountNotice();
    const reload = vi.fn();

    showStartupFailure(document, 'config', reload);
    const retry = notice.querySelector('button');
    retry?.click();
    retry?.click();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
