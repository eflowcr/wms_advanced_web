import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  familyBoxClasses,
  familyIcon,
  type SemanticFamily,
} from '../feedback/feedback.types';
import { Icon } from '../icon/icon';

/**
 * A small label that says what state something is in.
 *
 * BORN INSIDE THE TABLE AND DELIBERATELY NOT LIVING THERE. Its first consumer
 * is the Table's `badge` column, but nothing about it is table-shaped: a
 * detail header, a card and a list row all need to say "con incidencia" the
 * same way, and a badge that only existed inside the table would be copied by
 * hand the first time one of them did.
 *
 * ALWAYS ICON **AND** TEXT. The colour is never the only signal (WCAG 1.4.1),
 * and unlike the Banner this component has no room for a second line -- so the
 * text is the label itself and the icon is decorative beside it. That is why
 * `label` is required and there is no icon-only mode: an icon-only badge is a
 * colour with a picture on it.
 *
 * `Badge/Neutral` uses surface + text rather than solid + white, because the
 * neutral solid reaches only 4.19:1 (Fundamentos de Marca). The other three
 * follow it so the four look like one family.
 */
@Component({
  selector: 'ewms-badge',
  templateUrl: './badge.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Badge {
  /**
   * Which of the four. Named by the COLOUR FAMILY and not by a message
   * vocabulary: nobody says "an info row".
   */
  readonly variant = input<SemanticFamily>('neutral');

  /** The words. Required, and already translated (ADR 0008). */
  readonly label = input.required<string>();

  protected readonly boxClasses = computed(() => familyBoxClasses(this.variant()));

  protected readonly iconName = computed(() => familyIcon(this.variant()));
}
