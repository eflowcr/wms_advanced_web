import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  TranslocoCurrencyPipe,
  TranslocoDatePipe,
  TranslocoDecimalPipe,
} from '@jsverse/transloco-locale';
import { CATALOG, STATUS_LABELS } from '../catalog';
import { Prose } from '../ui/prose';

/** Portada del showroom. Su índice es catalog.ts, la misma lista que la barra lateral y la búsqueda. */
@Component({
  selector: 'ewms-showroom-home',
  imports: [
    Prose,
    RouterLink,
    TranslocoCurrencyPipe,
    TranslocoDatePipe,
    TranslocoDecimalPipe,
    TranslocoPipe,
  ],
  templateUrl: './showroom-home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomHome {
  protected readonly catalog = CATALOG;
  protected readonly statusLabels = STATUS_LABELS;

  // Valores de los ejemplos de idioma y formato regional.
  protected readonly unitCounts = [0, 1, 1250] as const;
  protected readonly today = new Date();
  protected readonly netWeightKg = 12345.678;
  protected readonly amount = 1250000;
  /** La moneda es dato del registro, nunca sale del idioma. */
  protected readonly amountCurrency = 'CRC';
}
