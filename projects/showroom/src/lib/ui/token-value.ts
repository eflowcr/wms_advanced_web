import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TokenReader } from './token-reader';
import { referencedTokens, type TokenChain } from './tokens';

/**
 * Widget 5.3 — the token viewer. The most important of the four.
 *
 * Shows a token, the chain down to its primitive, and the value the browser
 * actually computed. Nothing on the page writes the value: if tokens.css
 * changes, this follows on the next reload.
 *
 * A token nobody declared renders as missing, visibly. `pending` softens the
 * wording without hiding the fact, for the handful of tokens that tokens.css
 * itself records as not decided yet: an undeclared token is a defect, an
 * undeclared token the source says is pending is information, and the
 * catalogue should not shout the same way at both.
 *
 * The read happens after the first render because it needs the stylesheets to
 * be in the document -- the same reason the iconography page already read its
 * sizes this way, which is where this pattern was extracted from.
 */
@Component({
  selector: 'ewms-token-value',
  templateUrl: './token-value.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class TokenValue {
  readonly token = input.required<string>();
  /** Draw a colour chip before the name. */
  readonly swatch = input<boolean>(false);
  /** This token is knowingly undeclared; say "pendiente" and not "falta". */
  readonly pending = input<boolean>(false);

  private readonly reader = inject(TokenReader);

  /**
   * Flipped once the stylesheets are in the document. The read cannot happen
   * during construction -- there is nothing to walk yet -- which is the same
   * reason the iconography page already deferred its own read.
   */
  private readonly rendered = signal(false);

  /**
   * Recomputed when `token` changes, not captured once. An earlier version
   * read the chain inside afterNextRender and stored it, which quietly showed
   * a stale chain for the lifetime of any instance whose input later moved.
   */
  protected readonly chain = computed<TokenChain | null>(() =>
    this.rendered() ? this.reader.chain(this.token()) : null,
  );

  protected readonly swatchColour = computed(() => `var(${this.token()})`);

  /**
   * A chip is drawn only when the value really is a colour.
   *
   * A caller asks for a swatch per table, not per row, so a table that mixes
   * colours with radii and type sizes asked for one on every row and got a
   * column of empty outlined boxes next to the tokens that are not colours --
   * which reads as "this colour is blank" rather than "this is not a colour".
   * Asking the parser is the only way to tell, and it is the same parser the
   * contrast maths goes through.
   */
  protected readonly showSwatch = computed(() => {
    if (!this.swatch()) {
      return false;
    }
    const chain = this.chain();
    if (!chain || chain.status === 'missing') {
      return false;
    }
    /*
     * Two ways to the same answer, because either one can come back useless.
     * The computed value is the substituted colour in a browser; an engine
     * that has not substituted it hands back the `var()` text instead, and
     * then the end of the chain -- the primitive's own declaration, read from
     * the stylesheet rather than from the cascade -- is the one that answers.
     *
     * A CANDIDATE STILL CONTAINING A REFERENCE IS THROWN AWAY RATHER THAN
     * ASKED ABOUT, because asking gives a confident wrong answer: a
     * declaration containing `var()` is syntactically valid whatever it turns
     * out to hold, so the parser accepts it, and the computed colour then
     * falls back to the inherited one. That is how `--focus-ring-shadow` --
     * two lengths and two colours -- came back looking like a colour and drew
     * itself a chip.
     */
    const candidates = [chain.value, chain.links[chain.links.length - 1]?.declared ?? ''];
    return candidates.some(
      (value) =>
        value !== '' && referencedTokens(value).length === 0 && this.reader.colour(value) !== null,
    );
  });

  /** The chain minus the token itself: what it points at, in order. */
  protected readonly parents = computed(() => this.chain()?.links.slice(1) ?? []);

  constructor() {
    afterNextRender(() => this.rendered.set(true));
  }
}
