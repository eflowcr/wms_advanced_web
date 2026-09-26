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
 * Única puerta a los valores vivos de los tokens. Es dueña del escaneo de hojas (caro, estable
 * hasta recargar) y del elemento sonda del parser de color. Ver la nota de tokens.ts.
 */
@Injectable({ providedIn: 'root' })
export class TokenReader {
  private readonly document = inject(DOCUMENT);
  private declarations: ReadonlyMap<string, string> | null = null;
  private probe: HTMLElement | null = null;

  /** Texto declarado de cada propiedad de la raíz, escaneado una vez. */
  private allDeclarations(): ReadonlyMap<string, string> {
    this.declarations ??= readDeclarations(this.document);
    return this.declarations;
  }

  // Sonda fuera del layout y del árbol de accesibilidad. `display: none` y no fuera de pantalla:
  // el color computado no necesita layout, y un elemento con tamaño puede ensanchar la página.
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

  /** Valor sustituido de un token, o cadena vacía si no tiene. */
  value(name: string): string {
    const view = this.document.defaultView;
    if (!view) {
      return '';
    }
    return view.getComputedStyle(this.document.documentElement).getPropertyValue(name).trim();
  }

  /** El token, su declaración, el primitivo en que termina y el valor final. */
  chain(name: string): TokenChain {
    return resolveChain(name, this.allDeclarations(), this.value(name));
  }

  /** Canales de cualquier color que acepte el parser CSS, token o literal. */
  colour(value: string): Rgb | null {
    const view = this.document.defaultView;
    const probe = this.colourProbe();
    if (!view || !probe || !value) {
      return null;
    }
    return parseColor(view, probe, value);
  }

  /** Canales del valor de un token. */
  colourOf(name: string): Rgb | null {
    return this.colour(this.value(name));
  }

  /** Contraste entre dos tokens, o null si alguno no es color (y eso también se muestra). */
  ratio(foreground: string, background: string): number | null {
    const front = this.colourOf(foreground);
    const back = this.colourOf(background);
    return front && back ? contrastRatio(front, back) : null;
  }

  /** Primitivos de tokens.css en orden de declaración: un tono nuevo aparece sin editar la página. */
  primitiveNames(): readonly string[] {
    return [...this.allDeclarations()]
      .filter(([, declared]) => isPrimitiveValue(declared))
      .map(([name]) => name);
  }

  /**
   * Primitivos `--<familia>-<tono>` agrupados por familia. El tono debe ser numérico y final,
   * así los translúcidos (sufijo alfa tras el tono) quedan fuera de la rampa.
   */
  toneFamilies(families: readonly string[]): readonly { family: string; names: string[] }[] {
    const names = this.primitiveNames();
    return families.map((family) => ({
      family,
      names: names.filter((name) => new RegExp(`^--${family}-\\d+$`).test(name)),
    }));
  }

  /** Primitivos translúcidos de una familia (tono más sufijo alfa); la página los muestra aparte. */
  alphaPrimitives(family: string): readonly string[] {
    const pattern = new RegExp(`^--${family}-\\d+-a\\d+$`);
    return this.primitiveNames().filter((name) => pattern.test(name));
  }
}
