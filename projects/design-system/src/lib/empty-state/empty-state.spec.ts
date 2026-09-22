import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { EmptyState, type EmptyStateAction, type EmptyStateKind } from './empty-state';

@Component({
  template: `
    <ewms-empty-state
      [kind]="kind()"
      title="Todavía no hay expediciones"
      [description]="description()"
      [action]="action()"
      [size]="size()"
    />
  `,
  imports: [EmptyState],
})
class TestHost {
  readonly kind = signal<EmptyStateKind>('no-data');
  readonly description = signal('Las crea el operario al cerrar una ola.');
  readonly size = signal<'compact' | 'page'>('page');
  runs = 0;
  readonly action = signal<EmptyStateAction | null>({
    label: 'Crear expedición',
    icon: 'plus',
    run: () => (this.runs += 1),
  });
}

/** Caso, ícono que lo dice y si se anuncia sin mover el foco. */
const KINDS: readonly (readonly [EmptyStateKind, string, boolean])[] = [
  ['no-data', 'package', false],
  ['no-results', 'search', true],
  ['error', 'alert-triangle', true],
  ['no-access', 'lock', false],
];

describe('EmptyState', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const box = (): HTMLElement => root().querySelector('[data-empty-state]') as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  for (const [kind, icon, announced] of KINDS) {
    it(`${kind}: its icon, and ${announced ? 'announced' : 'silent'}`, async () => {
      host.kind.set(kind);
      await settle();
      expect(box().dataset['emptyState']).toBe(kind);
      expect(box().querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(icon);
      expect(box().getAttribute('role')).toBe(announced ? 'status' : null);
    });
  }

  it('page is a heading; compact is a paragraph', async () => {
    expect(box().querySelector('h2')?.textContent).toContain('Todavía no hay expediciones');
    host.size.set('compact');
    await settle();
    expect(box().querySelector('h2')).toBeNull();
    expect(box().querySelector('p.text-h4')?.textContent).toContain('Todavía no hay');
  });

  it('runs its single action, and the literal title never becomes a native tooltip', async () => {
    (box().querySelector('[data-empty-action] button') as HTMLButtonElement).click();
    expect(host.runs).toBe(1);
    expect(root().querySelector('ewms-empty-state')?.hasAttribute('title')).toBe(false);
    host.action.set(null);
    await settle();
    expect(box().querySelector('[data-empty-action]')).toBeNull();
  });

  it('passes axe in both sizes', async () => {
    await expectNoAxeViolations(root());
    host.size.set('compact');
    host.kind.set('no-results');
    await settle();
    await expectNoAxeViolations(root());
  });
});
