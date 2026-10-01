import { rowClasses, rowMarkClasses } from './table.types';

describe('the row matrix', () => {
  it('TINTS THE EXCEPTIONS AND WHAT IS COMPLETED; neutral goes plain, with hover', () => {
    expect(rowClasses(false, 'danger')).toContain('bg-row-danger');
    expect(rowClasses(false, 'warning')).toContain('bg-row-warning');
    // Completada, en el verde de su badge (decisión del usuario, 2026-09-30).
    expect(rowClasses(false, 'success')).toContain('bg-row-success');
    expect(rowClasses(false, null)).toContain('hover:bg-row-hover');
  });

  it('selected wins over any tint; the side bar is only for exceptions', () => {
    expect(rowClasses(true, 'success')).toBe('group bg-row-selected');
    expect(rowMarkClasses('danger')).toBe('shadow-row-mark-danger');
    expect(rowMarkClasses(null)).toBe('');
  });
});
