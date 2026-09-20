import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATALOG, STATUS_LABELS } from '../catalog';

/**
 * Landing page of the internal showroom.
 *
 * The index it shows is THE catalogue (catalog.ts), the same constant the
 * sidebar and the search read. Two lists would disagree inside a fortnight,
 * and the point of the catalogue is to be the place where you find out what
 * already exists before writing it again.
 */
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
