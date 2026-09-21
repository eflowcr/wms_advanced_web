import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATALOG, STATUS_LABELS } from '../catalog';

/** Portada del showroom. Su índice es catalog.ts, la misma lista que la barra lateral y la búsqueda. */
@Component({
  selector: 'ewms-showroom-home',
  imports: [RouterLink],
  templateUrl: './showroom-home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomHome {
  protected readonly catalog = CATALOG;
  protected readonly statusLabels = STATUS_LABELS;
}
