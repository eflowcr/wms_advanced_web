import { DOCUMENT, inject, Injectable } from '@angular/core';
import {
  contrastRatio,
  isPrimitiveValue,
  parseColor,
  readDeclarations,
  resolveChain,
  type Rgb,
  type TokenChain,
} from './tokens';

/**
 * The one door to the live token values, shared by every page and widget.
 *
 * It owns two things nobody should own twice: the scan of the stylesheets
 * (which is not free, and whose answer cannot change without a reload) and the
 * hidden probe element the colour parser needs.
 *
 * Everything it returns comes from the running page. Nothing in the showroom
 * writes a token value by hand -- see the note at the top of tokens.ts.
 */
@Injectable({ providedIn: 'root' })
export class TokenReader {
  private readonly document = inject(DOCUMENT);
  private declarations: ReadonlyMap<string, string> | null = null;
  private probe: HTMLElement | null = null;

  /** Declared text of every root custom property, scanned once. */
  private allDeclarations(): ReadonlyMap<string, string> {
    this.declarations ??= readDeclarations(this.document);
    return this.declarations;
  }

  /**
   * The probe stays out of the layout and out of the accessibility tree. It is
   * `display: none` rather than moved off-screen because a computed colour
   * does not need the element to be laid out, and an off-screen element with a
   * size is one more thing that can widen a page.
   */
  private colourProbe(): HTMLElement | null {
    const body = this.document.body;
    if (!body) {
      return null;
    }
    if (!this.probe) {
      const element = this.document.createElement('span');
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
      body.appendChild(element);
      this.probe = element;
    }
    return this.probe;
  }

  /** The substituted value of a token, or an empty string when it has none. */
  value(name: string): string {
    const view = this.document.defaultView;
    if (!view) {
      return '';
    }
    return view.getComputedStyle(this.document.documentElement).getPropertyValue(name).trim();
  }

  /** The token, its declaration, the primitive it lands on, and the final value. */
  chain(name: string): TokenChain {
    return resolveChain(name, this.allDeclarations(), this.value(name));
  }

  /** Several at once, in the order asked for. */
  chains(names: readonly string[]): readonly TokenChain[] {
    return names.map((name) => this.chain(name));
  }

  /** Channels for any colour the CSS parser accepts, token or literal. */
  colour(value: string): Rgb | null {
    const view = this.document.defaultView;
    const probe = this.colourProbe();
    if (!view || !probe || !value) {
      return null;
    }
    return parseColor(view, probe, value);
  }

  /** Channels of a token's value. */
  colourOf(name: string): Rgb | null {
    return this.colour(this.value(name));
  }

  /**
   * The contrast between two tokens, or null when either is not a colour --
   * which is itself worth rendering, rather than showing a ratio against
   * something that was never a colour.
   */
  ratio(foreground: string, background: string): number | null {
    const front = this.colourOf(foreground);
    const back = this.colourOf(background);
    return front && back ? contrastRatio(front, back) : null;
  }

  /**
   * Every primitive declared in tokens.css, in declaration order. The colour
   * page builds its families from this instead of a list written here, so a
   * tone added to tokens.css shows up without anyone editing the page.
   */
  primitiveNames(): readonly string[] {
    return [...this.allDeclarations()]
      .filter(([, declared]) => isPrimitiveValue(declared))
      .map(([name]) => name);
  }

  /**
   * Primitives whose name is `--<family>-<tone>`, grouped by family, for the
   * families asked for. The tone suffix has to be numeric and final, which is
   * what keeps the translucent primitives (whose names carry an alpha suffix
   * after the tone) out of the tone ramps: they are a different kind of
   * primitive and the page shows them apart.
   */
  toneFamilies(families: readonly string[]): readonly { family: string; names: string[] }[] {
    const names = this.primitiveNames();
    return families.map((family) => ({
      family,
      names: names.filter((name) => new RegExp(`^--${family}-\\d+$`).test(name)),
    }));
  }

  /**
   * The translucent primitives of a family -- name is tone plus an alpha
   * suffix. They are primitives like any other, but they are not part of the
   * tone ramp and the page shows them on their own.
   */
  alphaPrimitives(family: string): readonly string[] {
    const pattern = new RegExp(`^--${family}-\\d+-a\\d+$`);
    return this.primitiveNames().filter((name) => pattern.test(name));
  }
}
