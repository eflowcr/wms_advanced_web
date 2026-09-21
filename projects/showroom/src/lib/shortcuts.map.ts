import type { ShortcutMap } from '@ewms/design-system';

/**
 * Mapa propio del showroom, único archivo suyo que nombra teclas (no puede importar el shell
 * ni `@ewms/core`). Coincide con el del shell por intención; el porqué de cada tecla está allá.
 */
// El día que no deban diferir, uno pasa a un paquete compartido y este comentario se va.
export const SHOWROOM_SHORTCUT_MAP: ShortcutMap = {
  search: { key: '/', chord: ['/'] },
  create: { key: 'n', alt: true, chord: ['Alt', 'N'] },
  save: {
    key: 's',
    ctrl: true,
    preventDefault: true,
    insideTextFields: true,
    chord: ['Ctrl', 'S'],
  },
  cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },
  help: { key: '?', chord: ['?'] },
};
