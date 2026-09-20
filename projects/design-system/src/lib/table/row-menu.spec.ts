import { menuItemClasses, moveMenuIndex } from './row-menu';
import type { MenuItem } from './table.types';

const ITEMS: readonly MenuItem[] = [
  { id: 'ver', label: 'Ver detalle' },
  { id: 'imprimir', label: 'Imprimir', disabled: true },
  { id: 'duplicar', label: 'Duplicar' },
  { id: 'anular', label: 'Anular', tone: 'danger', separatorBefore: true },
];

describe('moveMenuIndex', () => {
  it('skips what cannot be chosen', () => {
    // From "Ver detalle" the next stop is "Duplicar": stopping on the
    // disabled "Imprimir" would make the arrows feel broken on exactly the
    // rows where an action happens to be unavailable.
    expect(moveMenuIndex(ITEMS, 0, 1)).toBe(2);
    expect(moveMenuIndex(ITEMS, 2, -1)).toBe(0);
  });

  it('stops at the ends rather than wrapping', () => {
    // The same rule as the listbox, and shared with it: the arrows are how
    // somebody finds out where the list ends, and a walk that silently jumps
    // back to the top hides that. Escape is how you leave.
    expect(moveMenuIndex(ITEMS, 3, 1)).toBe(3);
    expect(moveMenuIndex(ITEMS, 0, -1)).toBe(0);
  });

  it('opens on the first enabled entry, from nothing', () => {
    expect(moveMenuIndex(ITEMS, -1, 1)).toBe(0);
  });

  it('opens on the last enabled entry when the walk starts upwards', () => {
    expect(moveMenuIndex(ITEMS, -1, -1)).toBe(3);
  });

  it('has nowhere to go when every entry is disabled', () => {
    const none: readonly MenuItem[] = [{ id: 'a', label: 'A', disabled: true }];
    expect(moveMenuIndex(none, -1, 1)).toBe(-1);
    expect(moveMenuIndex([], -1, 1)).toBe(-1);
  });
});

describe('menuItemClasses', () => {
  it('colours only the destructive entry', () => {
    expect(menuItemClasses(ITEMS[3] as MenuItem, false)).toContain('text-danger');
    expect(menuItemClasses(ITEMS[0] as MenuItem, false)).not.toContain('text-danger');
  });

  it('shows a disabled entry as unavailable rather than as dangerous', () => {
    // Danger and disabled together would read as a red entry somebody is
    // being invited to press.
    const disabled = { ...(ITEMS[3] as MenuItem), disabled: true };
    const classes = menuItemClasses(disabled, false);
    expect(classes).toContain('text-disabled');
    expect(classes).not.toContain('text-danger');
  });

  it('marks the active entry, and never a disabled one', () => {
    expect(menuItemClasses(ITEMS[0] as MenuItem, true)).toContain('bg-ghost-hover');
    expect(menuItemClasses(ITEMS[1] as MenuItem, true)).not.toContain('bg-ghost-hover');
  });
});
