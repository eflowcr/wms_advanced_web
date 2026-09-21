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
    // De «Ver detalle» a «Duplicar»: frenar en «Imprimir» deshabilitado rompe las flechas.
    expect(moveMenuIndex(ITEMS, 0, 1)).toBe(2);
    expect(moveMenuIndex(ITEMS, 2, -1)).toBe(0);
  });

  it('stops at the ends rather than wrapping', () => {
    // Misma regla que el listbox: no da la vuelta, así se nota el final. Escape sale.
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
    // Peligro más deshabilitada se leería como una entrada roja que invita a pulsarla.
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
