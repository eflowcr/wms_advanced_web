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
})
export class Home {
  protected readonly brandName = BRAND_NAME;

  // Sample values for the provisional i18n examples.
  protected readonly unitCounts = [0, 1, 1250] as const;
  protected readonly today = new Date();
  protected readonly netWeightKg = 12345.678;
  protected readonly amount = 1250000;
  /** The currency is data of the record, never derived from the language. */
  protected readonly amountCurrency = 'CRC';
}
