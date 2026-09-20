import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { Icon, ICON_CATEGORIES, type IconName, type IconSize } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenValue } from '../../ui/token-value';

const SIZES: readonly IconSize[] = ['sm', 'md', 'lg', 'xl'];

/** How long the "Copiado" confirmation stays visible. */
export const COPIED_FEEDBACK_MS = 2000;

/** The icons that sit on the navy top bar, shown on both grounds. */
const TOP_BAR: readonly IconName[] = [
  'menu',
  'search',
  'bell',
  'help-circle',
  'settings',
  'operator',
  'logout',
];

/**
 * /design-system/foundations/icons -- the closed icon catalogue (ADR 0011).
 *
 * Moved here from /design-system/iconografia when the routes went to English;
 * the old path stays as a permanent redirect (showroom.routes.ts).
 *
 * The page is otherwise unchanged by design. What did change: the live token
 * reading it used to do by hand now goes through <ewms-token-value>, and the
 * two grounds through <ewms-demo-frame>. This page is where that pattern came
 * from -- it was extracted into the widget rather than reinvented there.
 */
@Component({
  selector: 'ewms-showroom-iconography',
  imports: [Icon, DemoFrame, TokenValue],
  templateUrl: './iconography.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomIconography {
  private readonly document = inject(DOCUMENT);

  protected readonly groups = [
    { id: 'domain', title: 'Dominio', names: ICON_CATEGORIES.domain },
    { id: 'interface', title: 'Interfaz', names: ICON_CATEGORIES.interface },
  ] as const;
  protected readonly total = ICON_CATEGORIES.domain.length + ICON_CATEGORIES.interface.length;
  protected readonly topBar = TOP_BAR;
  protected readonly sizes = SIZES;

  protected readonly copied = signal<IconName | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected async copy(name: IconName): Promise<void> {
    await this.document.defaultView?.navigator.clipboard?.writeText(name);
    this.copied.set(name);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(null), COPIED_FEEDBACK_MS);
  }
}
