import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessStore } from './access-store';
import { Can } from './can';

@Component({
  imports: [Can],
  template: `
    <button *ewmsCan="code()" type="button">Crear</button>
    <ng-container *ewmsCan="'security.users:update'">texto</ng-container>
  `,
})
class Host {
  readonly code = signal('security.users:create');
}

describe('*ewmsCan', () => {
  let access: AccessStore;
  const root = () => fixture.nativeElement as HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    access = TestBed.inject(AccessStore);
    access.status.set('ready');
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('renders nothing without the permission: it hides, it does not disable', () => {
    expect(root().querySelector('button')).toBeNull();
    expect(root().textContent).not.toContain('texto');
  });

  it('appears and disappears with every change of grants, without reloading', async () => {
    access.grants.set({ 'security.users:create': ['p'] });
    await fixture.whenStable();
    const button = root().querySelector('button');
    expect(button?.getAttribute('data-ewms-can')).toBe('security.users:create');

    access.grants.set({ 'security.users:create': ['p'], 'security.users:update': ['p'] });
    await fixture.whenStable();
    expect(root().querySelector('button')).toBe(button);
    expect(root().textContent).toContain('texto');

    access.grants.set({});
    await fixture.whenStable();
    expect(root().querySelector('button')).toBeNull();
    expect(root().textContent).not.toContain('texto');
  });

  it('follows a change of code and closes when access is not ready', async () => {
    access.grants.set({ 'security.users:create': ['p'], 'security.users:export': ['p'] });
    await fixture.whenStable();
    fixture.componentInstance.code.set('security.users:export');
    await fixture.whenStable();
    expect(root().querySelector('button')?.getAttribute('data-ewms-can')).toBe(
      'security.users:export',
    );
    access.status.set('loading');
    await fixture.whenStable();
    expect(root().querySelector('button')).toBeNull();
  });
});
