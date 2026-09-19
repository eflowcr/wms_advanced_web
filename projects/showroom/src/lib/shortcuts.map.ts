import type { ShortcutMap } from '@ewms/design-system';

/**
 * THE SHOWROOM'S OWN MAP, and the only file in the showroom that names a key.
 *
 * NOT A DUPLICATE OF THE SHELL'S, and the distinction is the same one
 * `showroom.providers.ts` already makes for the table's chrome: the showroom
 * may not import `@ewms/core` and may not import the shell, so it provides its
 * own implementation of a token the library defines. Writing it out here is
 * also the honest test of the arrangement -- if providing a map once were
 * awkward, this file is where it would show.
 *
 * The bindings match the shell's deliberately: the pattern pages demonstrate
 * the application's shortcuts, and a catalogue that taught different keys from
 * the product would be worse than no catalogue. They are the same by intent
 * and free to differ, which is the honest state of affairs -- the day they
 * must not differ, one of them moves into a shared package and this comment
 * comes out.
 *
 * Every reason a binding is what it is, is written in the shell's map. It is
 * not repeated here, because two copies of a rationale drift exactly like two
 * copies of a number.
 */
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
