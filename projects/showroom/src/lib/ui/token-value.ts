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
 * Widget 5.3, visor de tokens: el token, su cadena hasta el primitivo y el valor computado.
 * Un token sin declarar se muestra como faltante; con `pending` se dice «pendiente», porque
 * tokens.css lo registra como no decidido: información, no defecto.
 */
@Component({
  selector: 'ewms-token-value',
  templateUrl: './token-value.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class TokenValue {
  readonly token = input.required<string>();
  /** Dibuja una muestra de color antes del nombre. */
  readonly swatch = input<boolean>(false);
  /** Token sin declarar a sabiendas: dice «pendiente» y no «falta». */
  readonly pending = input<boolean>(false);

  private readonly reader = inject(TokenReader);

  // Pasa a true tras el primer render: antes las hojas de estilo no están en el documento.
  private readonly rendered = signal(false);

  // Se recalcula al cambiar `token`; guardarlo una vez en afterNextRender mostraba una cadena vieja.
  protected readonly chain = computed<TokenChain | null>(() =>
    this.rendered() ? this.reader.chain(this.token()) : null,
  );

  protected readonly swatchColour = computed(() => `var(${this.token()})`);

  // Muestra solo si el valor es de verdad un color: la muestra se pide por tabla y, en tablas
  // mixtas, dibujaba cajas vacías que parecían «color en blanco». Decide el mismo parser del contraste.
  protected readonly showSwatch = computed(() => {
    if (!this.swatch()) {
      return false;
    }
    const chain = this.chain();
    if (!chain || chain.status === 'missing') {
      return false;
    }
    // Dos candidatos: el valor computado y, si el motor no sustituyó, la declaración del primitivo.
    // Uno que aún tenga `var()` se descarta: el parser lo acepta y hereda un color, y así
    // `--focus-ring-shadow` parecía color y se dibujaba muestra.
    const candidates = [chain.value, chain.links[chain.links.length - 1]?.declared ?? ''];
    return candidates.some(
      (value) =>
        value !== '' && referencedTokens(value).length === 0 && this.reader.colour(value) !== null,
    );
  });

  /** La cadena sin el token mismo: a qué apunta, en orden. */
  protected readonly parents = computed(() => this.chain()?.links.slice(1) ?? []);

  constructor() {
    afterNextRender(() => this.rendered.set(true));
  }
}
