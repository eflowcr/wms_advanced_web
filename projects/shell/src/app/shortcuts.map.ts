import type { ShortcutMap } from '@ewms/design-system';

/**
 * THE ONLY FILE IN THE APPLICATION THAT NAMES A KEY (REQ-FE-DS4-001 RFE-01).
 *
 * A screen registers `create`; it never registers `Alt+N`. That is what makes
 * changing a combination the edit of one line here, and it is why the help
 * dialog needs no maintenance: it reads this object.
 *
 * `shortcuts.spec.ts` checks the claim rather than trusting it -- it greps the
 * shell's and the showroom's sources for every key in this map and fails if
 * one is spelled anywhere else.
 *
 * The four actions are the ones RFE-02 fixes, in the order somebody meets
 * them: find something, make something, keep it, back out. `help` is the
 * fifth, and it belongs to the engine rather than to a screen.
 */
export const SHORTCUT_MAP: ShortcutMap = {
  /**
   * A printable character, and the riskiest binding in the map: it is what a
   * barcode can contain and what a person types without meaning anything by
   * it. RFE-04 keeps it out of text fields, RFE-05 keeps it out of scans, and
   * the switch in the help dialog turns it off outright (WCAG 2.2 2.1.4).
   */
  search: { key: '/', chord: ['/'] },

  /**
   * Alt and not Ctrl: Ctrl+N opens a browser window and cannot be taken back
   * from it. Alt+N is free in Chrome on Windows, which is the floor's
   * combination -- and the one still to check against NVDA, which is written
   * down in §15 of the REQ rather than assumed away.
   */
  create: { key: 'n', alt: true, chord: ['Alt', 'N'] },

  /**
   * `preventDefault` WHETHER OR NOT ANYBODY REGISTERED `save`.
   *
   * A screen with nothing to save must still not let the browser write a
   * half-drawn page to disk while the person believes they saved their work.
   * It is the one binding whose default is cancelled unconditionally, and the
   * engine reads that off this line rather than knowing the key.
   *
   *
   * `insideTextFields` IS A FINDING AGAINST RFE-04, NOT A LIBERTY TAKEN.
   *
   * RFE-04 says combinations with a modifier do not fire inside a text field,
   * and then says in the same paragraph that "Ctrl+S inside a field must save
   * the form, not the browser's document". PACQ-02.3 settles it: it saves.
   * That is plainly the right answer -- somebody hits Ctrl+S while typing INTO
   * the form they mean to save -- and it is also why "inside text fields" is a
   * property of the binding rather than a rule about modifiers: Alt+N inside a
   * field must NOT create (PACQ-02.5), and both are combinations. Carried into
   * v1.1 of the REQ.
   */
  save: {
    key: 's',
    ctrl: true,
    preventDefault: true,
    insideTextFields: true,
    chord: ['Ctrl', 'S'],
  },

  /**
   * The single binding that survives a text field (RFE-04's only exception).
   * Half the time somebody wants to cancel, the focus is inside the field they
   * are filling in -- so a cancel that needed the focus elsewhere would be a
   * cancel nobody could reach.
   */
  cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },

  /** `?` is Shift+/ and reports as one character, so it is bare like `/`. */
  help: { key: '?', chord: ['?'] },
};
