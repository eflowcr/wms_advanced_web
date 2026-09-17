import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { Icon, ICON_CATEGORIES, type IconName, type IconSize } from '@ewms/design-system';

interface SizeSample {
  readonly size: IconSize;
  readonly width: string;
  readonly stroke: string;
}

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
 * /design-system/iconografia -- the closed icon catalogue (ADR 0011).
 *
 * Token values are read live from the CSS custom properties, never written
 * here: if tokens.css changes, this page follows (Showroom spec, 5.3).
 */
@Component({
  selector: 'ewms-showroom-iconography',
  imports: [Icon],
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

  protected readonly sizes = signal<readonly SizeSample[]>(
    SIZES.map((size) => ({ size, width: '…', stroke: '…' })),
  );
  protected readonly copied = signal<IconName | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));

    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) {
        return;
      }
      const root = view.getComputedStyle(this.document.documentElement);
      const read = (property: string) => root.getPropertyValue(property).trim() || '—';
      this.sizes.set(
        SIZES.map((size) => ({
          size,
          width: read(`--size-icon-${size}`),
          stroke: read(`--stroke-icon-${size}`),
        })),
      );
    });
  }

  protected async copy(name: IconName): Promise<void> {
    await this.document.defaultView?.navigator.clipboard?.writeText(name);
    this.copied.set(name);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(null), COPIED_FEEDBACK_MS);
  }
}
