import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  TemplateRef,
} from '@angular/core';

/** One axis label of the matrix. `id` is what the cell template switches on. */
export interface MatrixAxis {
  readonly id: string;
  readonly label: string;
}

/** What a cell template receives. */
export interface MatrixCell {
  readonly variant: MatrixAxis;
  readonly state: MatrixAxis;
}

/**
 * Widget 5.1 — the state matrix. A real table: the header cells name the
 * states, the row headers name the variants, and a screen reader gets the same
 * grid a sighted reader does.
 *
 * THE WIDGET DOES NOT FORCE ANY STATE, AND THAT IS DELIBERATE.
 *
 * `:hover` and `:focus-visible` cannot be held still, so the matrix would show
 * four identical cells without help. The help belongs to the page, not here:
 * the page renders the real component and adds the token-backed utility for
 * the state it is illustrating (`[&_button]:bg-primary-hover` and friends), so
 * what you see is the component with the same token its own hover rule uses.
 *
 * Keeping that mapping in the page rather than in this widget means the
 * forcing sits next to the component it describes, where a reviewer comparing
 * it against the component's own classes will actually look.
 */
@Component({
  selector: 'ewms-state-matrix',
  templateUrl: './state-matrix.html',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateMatrix {
  readonly variants = input.required<readonly MatrixAxis[]>();
  readonly states = input.required<readonly MatrixAxis[]>();
  /** Names the table for assistive technology. */
  readonly caption = input.required<string>();

  /**
   * The heading of the row-header column.
   *
   * It defaults to `Variante` because that is what the first four component
   * pages put on that axis, but the axis is not always variants: the Text page
   * crosses variants against the ELEMENT they render, and the Input crosses
   * states against sizes. A column headed "Variante" over a list of states is
   * a table that lies about itself, so the heading is an input rather than a
   * word baked into the widget.
   */
  readonly rowHeader = input<string>('Variante');

  readonly cell = contentChild.required<TemplateRef<MatrixCell>>(TemplateRef);
}
