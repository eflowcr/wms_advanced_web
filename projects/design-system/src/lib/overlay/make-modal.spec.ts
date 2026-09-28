import { makeModal } from './make-modal';

/** Un elemento con su marca `data-<name>` y, si hace falta, su capa en línea. */
function element(tag: string, name: string, style = ''): HTMLElement {
  const created = document.createElement(tag);
  created.setAttribute(`data-${name}`, '');
  created.style.cssText = style;
  return created;
}

describe('makeModal', () => {
  let page: HTMLElement;

  // La página del marco en chico: cabecera sobre el velo, el diálogo y su velo, contenido y marca de agua.
  beforeEach(() => {
    const status = element('p', 'status');
    status.setAttribute('role', 'status');
    const main = element('main', 'main');
    main.append(status, element('p', 'text'));
    const body = element('div', 'body');
    body.append(element('div', 'dialog'), element('button', 'veil', 'position: fixed; z-index: 10'), main);
    const already = element('p', 'already');
    already.setAttribute('inert', '');
    page = element('div', 'page');
    page.append(
      element('header', 'header', 'position: sticky; z-index: 20'),
      body,
      element('footer', 'stamp', 'position: fixed; z-index: 5'),
      already,
    );
    document.body.appendChild(page);
  });

  afterEach(() => page.remove());

  const find = (name: string): Element => page.querySelector(`[data-${name}]`)!;
  const inert = (name: string): boolean => find(name).hasAttribute('inert');
  const open = (): (() => void) => makeModal(find('dialog'), find('veil'), 'Menú principal');

  it('names the dialog and declares it modal', () => {
    open();

    expect(find('dialog').getAttribute('role')).toBe('dialog');
    expect(find('dialog').getAttribute('aria-modal')).toBe('true');
    expect(find('dialog').getAttribute('aria-label')).toBe('Menú principal');
  });

  it('makes inert every branch the veil covers, and leaves the dialog and its veil alone', () => {
    open();

    expect(inert('dialog')).toBe(false);
    expect(inert('veil')).toBe(false);
    expect(inert('body')).toBe(false);
    expect(inert('stamp')).toBe(true);
    expect(inert('text')).toBe(true);
  });

  it('keeps alive what announces and what paints above the veil', () => {
    open();

    expect(inert('status')).toBe(false);
    expect(inert('main')).toBe(false);
    expect(inert('header')).toBe(false);
  });

  it('undoes only what it did: what was already inert stays so', () => {
    open()();

    expect([...page.querySelectorAll('[inert]')]).toEqual([find('already')]);
    expect(find('dialog').hasAttribute('role')).toBe(false);
    expect(find('dialog').hasAttribute('aria-modal')).toBe(false);
  });
});
