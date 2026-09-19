import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expectNoAxeViolations } from '@ewms/testing';
import { Card } from './card';
import { CardGroup } from './card-group';

/** The warehouse picker of the sheet: four cards, the last one unavailable. */
const WAREHOUSES = [
  { value: 'norte', name: 'Norte' },
  { value: 'central', name: 'Central' },
  { value: 'devoluciones', name: 'Devoluciones' },
  { value: 'sur', name: 'Sur' },
] as const;

@Component({
  template: `
    <ewms-card-group
      label="Almacén de destino"
      [value]="chosen()"
      [disabled]="groupDisabled()"
      (click)="clicks = clicks + 1"
    >
      @for (warehouse of warehouses; track warehouse.value) {
        <ewms-card
          [optionValue]="warehouse.value"
          [disabled]="warehouse.value === 'sur' && lastDisabled()"
        >
          <span>{{ warehouse.name }}</span>
        </ewms-card>
      }
    </ewms-card-group>
  `,
  imports: [Card, CardGroup],
})
class GroupHost {
  readonly warehouses = WAREHOUSES;
  readonly chosen = signal<unknown>(null);
  readonly groupDisabled = signal(false);
  readonly lastDisabled = signal(true);

  clicks = 0;
}

@Component({
  template: `
    <ewms-card>
      <h3 ewmsCardHeader>Resumen de bodega</h3>
      <p>12 recepciones abiertas</p>
      <div ewmsCardFooter>
        <button type="button">Ver detalle</button>
      </div>
    </ewms-card>
  `,
  imports: [Card],
})
class ContentHost {}

@Component({
  template: `
    <ewms-card-group label="Almacén" [formControl]="control">
      <ewms-card optionValue="norte"><span>Norte</span></ewms-card>
      <ewms-card optionValue="central"><span>Central</span></ewms-card>
    </ewms-card-group>
  `,
  imports: [Card, CardGroup, ReactiveFormsModule],
})
class ReactiveHost {
  readonly control = new FormControl<unknown>('central');
}

describe('Card', () => {
  describe('as an option inside a group', () => {
    let fixture: ComponentFixture<GroupHost>;
    let host: GroupHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [GroupHost, Card, CardGroup],
      }).compileComponents();
      fixture = TestBed.createComponent(GroupHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    function radios(): HTMLElement[] {
      return [...fixture.nativeElement.querySelectorAll('[role="radio"]')] as HTMLElement[];
    }

    it('is a radiogroup with one radio per card', () => {
      const group = fixture.nativeElement.querySelector('[role="radiogroup"]') as HTMLElement;
      expect(group.getAttribute('aria-label')).toBe('Almacén de destino');
      expect(radios().length).toBe(WAREHOUSES.length);
    });

    it('is ONE tab stop, entered at the first enabled card when nothing is chosen', () => {
      expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
        '-1',
        null,
      ]);
    });

    it('moves the tab stop to the chosen card', async () => {
      host.chosen.set('devoluciones');
      await settle();
      expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual([
        '-1',
        '-1',
        '0',
        null,
      ]);
    });

    it('marks the chosen card three ways: aria-checked, the border and a check', async () => {
      host.chosen.set('central');
      await settle();

      const chosen = radios()[1] as HTMLElement;
      expect(chosen.getAttribute('aria-checked')).toBe('true');
      expect(chosen.className).toContain('bg-row-selected');
      expect(chosen.className).toContain('border-(--color-bg-primary)');
      expect(chosen.querySelector('svg')).not.toBeNull();
    });

    it('chooses on click', async () => {
      radios()[1]?.click();
      await settle();
      expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');
      expect(radios()[0]?.getAttribute('aria-checked')).toBe('false');
    });

    it('does not choose a disabled card, by click or otherwise', async () => {
      const disabled = radios()[3] as HTMLElement;
      expect(disabled.getAttribute('aria-disabled')).toBe('true');
      disabled.click();
      await settle();
      expect(disabled.getAttribute('aria-checked')).toBe('false');
    });

    describe('the keyboard, as a radio group answers it', () => {
      function press(index: number, key: string): void {
        radios()[index]?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }

      it('the arrows move AND choose: selection follows the focus', async () => {
        radios()[0]?.click();
        await settle();

        press(0, 'ArrowDown');
        await settle();
        expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');

        press(1, 'ArrowRight');
        await settle();
        expect(radios()[2]?.getAttribute('aria-checked')).toBe('true');

        press(2, 'ArrowUp');
        await settle();
        expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');
      });

      it('skips the disabled card and wraps round the ends', async () => {
        radios()[2]?.click();
        await settle();

        // Sur is disabled, so the next one after Devoluciones is Norte again.
        press(2, 'ArrowDown');
        await settle();
        expect(radios()[0]?.getAttribute('aria-checked')).toBe('true');

        press(0, 'ArrowUp');
        await settle();
        expect(radios()[2]?.getAttribute('aria-checked')).toBe('true');
      });

      it('an arrow from nothing chosen picks an end, forwards or backwards', async () => {
        press(0, 'ArrowDown');
        await settle();
        expect(radios()[0]?.getAttribute('aria-checked')).toBe('true');
      });

      it('Space chooses the focused card', async () => {
        press(2, ' ');
        await settle();
        expect(radios()[2]?.getAttribute('aria-checked')).toBe('true');
      });

      it('leaves Enter to the form around it', async () => {
        press(2, 'Enter');
        await settle();
        expect(radios()[2]?.getAttribute('aria-checked')).toBe('false');
      });

      it('moves the focus with the choice', async () => {
        radios()[0]?.click();
        await settle();
        radios()[0]?.focus();
        press(0, 'ArrowDown');
        await settle();
        expect(document.activeElement).toBe(radios()[1]);
      });
    });

    describe('quien deshabilita gana', () => {
      it('a disabled group disables every card and empties the tab order', async () => {
        host.groupDisabled.set(true);
        await settle();

        expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual([
          null,
          null,
          null,
          null,
        ]);
        radios()[0]?.click();
        await settle();
        expect(radios()[0]?.getAttribute('aria-checked')).toBe('false');
      });

      it('a disabled card stays disabled inside an enabled group', async () => {
        expect(radios()[3]?.getAttribute('aria-disabled')).toBe('true');
        expect(radios()[0]?.getAttribute('aria-disabled')).toBeNull();
      });

      it('an all-disabled group has no tab stop and no keyboard', async () => {
        host.groupDisabled.set(true);
        await settle();
        radios()[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        await settle();
        expect(radios().some((radio) => radio.getAttribute('aria-checked') === 'true')).toBe(false);
      });
    });

    it('drops a card from the group when it is removed', async () => {
      host.lastDisabled.set(false);
      await settle();
      expect(radios().map((radio) => radio.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
        '-1',
        '-1',
      ]);
    });

    it('has no axe violations', async () => {
      host.chosen.set('central');
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });

  describe('as a form control', () => {
    let fixture: ComponentFixture<ReactiveHost>;
    let host: ReactiveHost;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ReactiveHost, Card, CardGroup, ReactiveFormsModule],
      }).compileComponents();
      fixture = TestBed.createComponent(ReactiveHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    function radios(): HTMLElement[] {
      return [...fixture.nativeElement.querySelectorAll('[role="radio"]')] as HTMLElement[];
    }

    it('shows the value the form already holds', () => {
      expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');
    });

    it('writes the chosen value back to the form and marks it touched', async () => {
      expect(host.control.touched).toBe(false);
      radios()[0]?.click();
      await settle();
      expect(host.control.value).toBe('norte');
      expect(host.control.touched).toBe(true);
    });

    it('follows the form when the form disables it', async () => {
      host.control.disable();
      await settle();
      expect(radios()[0]?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('as a plain container', () => {
    let fixture: ComponentFixture<ContentHost>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [ContentHost, Card] }).compileComponents();
      fixture = TestBed.createComponent(ContentHost);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('takes no role, no tab position and no checked state', () => {
      const box = fixture.nativeElement.querySelector('ewms-card > div') as HTMLElement;
      expect(box.getAttribute('role')).toBeNull();
      expect(box.getAttribute('tabindex')).toBeNull();
      expect(box.getAttribute('aria-checked')).toBeNull();
    });

    it('projects header, body and footer', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Resumen de bodega');
      expect(text).toContain('12 recepciones abiertas');
      expect(text).toContain('Ver detalle');
    });

    it('ignores a click: it is not a control', async () => {
      const box = fixture.nativeElement.querySelector('ewms-card > div') as HTMLElement;
      box.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(box.querySelector('[aria-checked]')).toBeNull();
    });

    it('has no axe violations', async () => {
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});
