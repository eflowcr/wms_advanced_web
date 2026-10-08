import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ApplicationInitStatus, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '@ewms/core';
import { DialogService } from '@ewms/design-system';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { Subject } from 'rxjs';
import { provideEwmsDesignSystem } from '../design-system.providers';
import { DICTIONARIES } from '../i18n.testing';
import { SECOND_FACTOR, type SecondFactor } from './second-factor';
import { StepUpDialog, verifySecondFactor } from './step-up-dialog';

const CHALLENGE = 'Bearer error="insufficient_user_authentication", acr_values="urn:ewms:acr:otp"';

async function render(factor: SecondFactor, language: 'es' | 'en' = 'es') {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [StepUpDialog],
    providers: [
      provideI18nTesting(DICTIONARIES),
      provideEwmsDesignSystem(),
      { provide: DialogRef, useValue: { close } },
      { provide: DIALOG_DATA, useValue: CHALLENGE },
      { provide: SECOND_FACTOR, useValue: factor },
    ],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  await TestBed.inject(LanguageService).use(language);
  const fixture = TestBed.createComponent(StepUpDialog);
  await fixture.whenStable();
  return { fixture, close, root: fixture.nativeElement as HTMLElement };
}

async function submit(
  root: HTMLElement,
  code: string,
  fixture: { whenStable(): Promise<unknown>; detectChanges(): void },
) {
  const input = root.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
  input.value = code;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('StepUpDialog', () => {

  it('asks the adapter for the code and closes validated', async () => {
    const verify = vi.fn(async () => undefined);
    const { fixture, close, root } = await render({ inputKey: 'shell.stepUp.otp', verify });
    expect(root.querySelector('h2')?.textContent).toContain('Confirme su identidad');
    await expectNoAxeViolations(root);
    await submit(root, '123456', fixture);
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(true));
    expect(verify).toHaveBeenCalledWith('123456');
  });

  it('a rejected code says so and stays open; cancel closes without the action', async () => {
    const verify = vi.fn(async () => {
      throw new Error('invalid');
    });
    const { fixture, close, root } = await render({ inputKey: 'shell.stepUp.otp', verify }, 'en');
    await submit(root, '000000', fixture);
    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('The code is not valid'),
    );
    expect(close).not.toHaveBeenCalled();
    [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Cancel'))!
      .click();
    expect(close).toHaveBeenCalledWith(false);
    // La preferencia de idioma persiste: vuelve al español para las demás suites.
    await TestBed.inject(LanguageService).use('es');
  });

  it('opens with the design-system texts and resolves on close', async () => {
    const closed = new Subject<boolean | undefined>();
    const open = vi.fn(() => ({ closed }));
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(DICTIONARIES), { provide: DialogService, useValue: { open } }],
    });
    const result = verifySecondFactor(TestBed.inject(EnvironmentInjector), CHALLENGE);
    expect(open).toHaveBeenCalledWith(
      StepUpDialog,
      expect.objectContaining({ data: CHALLENGE, dismissOnBackdrop: false }),
    );
    closed.next(undefined);
    expect(await result).toBe(false);
  });
});
