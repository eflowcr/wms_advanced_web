import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { Button, Icon, ICON_CATEGORIES, type IconName, type IconSize } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

const SIZES: readonly IconSize[] = ['sm', 'md', 'lg', 'xl'];

/** Cuánto queda visible la confirmación «Copiado». */
export const COPIED_FEEDBACK_MS = 2000;

/** Íconos de la barra superior navy, mostrados sobre ambos fondos. */
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
 * Los dos grupos del catálogo; `title` es la clave de su nombre, los íconos no se traducen.
 * t(showroom.icons.groups.domain, showroom.icons.groups.interface)
 */
const GROUPS = [
  { id: 'domain', title: 'showroom.icons.groups.domain', names: ICON_CATEGORIES.domain },
  { id: 'interface', title: 'showroom.icons.groups.interface', names: ICON_CATEGORIES.interface },
] as const;

/**
 * Catálogo cerrado de íconos (ADR 0011). Antes vivía en /design-system/iconografia (redirección
 * en showroom.routes.ts). De acá se extrajo la lectura en vivo que hoy hace <ewms-token-value>.
 */
@Component({
  selector: 'ewms-showroom-iconography',
  imports: [Button, Icon, DemoFrame, Prose, TokenValue, TranslocoPipe],
  templateUrl: './iconography.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomIconography {
  private readonly document = inject(DOCUMENT);

  protected readonly groups = GROUPS;
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
