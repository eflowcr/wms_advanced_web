import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  TranslocoCurrencyPipe,
  TranslocoDatePipe,
  TranslocoDecimalPipe,
} from '@jsverse/transloco-locale';
import { BRAND_NAME } from '../brand';

@Component({
  imports: [TranslocoCurrencyPipe, TranslocoDatePipe, TranslocoDecimalPipe, TranslocoPipe],
  selector: 'app-home',
  templateUrl: './home.html',
  // El espaciado de «En construcción»: sin él el texto quedaba pegado al h1.
  host: { class: 'flex flex-col gap-6' },
})
export class Home {
  protected readonly brandName = BRAND_NAME;

  // Valores de los ejemplos provisionales de i18n.
  protected readonly unitCounts = [0, 1, 1250] as const;
  protected readonly today = new Date();
  protected readonly netWeightKg = 12345.678;
  protected readonly amount = 1250000;
  /** La moneda es dato del registro, nunca sale del idioma. */
  protected readonly amountCurrency = 'CRC';
}
