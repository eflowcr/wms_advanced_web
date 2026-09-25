import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CATALOG, STATUS_LABELS } from '../catalog';
import { Prose } from '../ui/prose';

/** Portada del showroom. Su índice es catalog.ts, la misma lista que la barra lateral y la búsqueda. */
@Component({
  selector: 'ewms-showroom-home',
  imports: [Prose, RouterLink, TranslocoPipe],
  templateUrl: './showroom-home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomHome {
  protected readonly catalog = CATALOG;
  protected readonly statusLabels = STATUS_LABELS;
}
