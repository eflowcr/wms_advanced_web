import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DESIGN_SYSTEM_VERSION, SplitButton, type SplitAction } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

/** Verificada contra split-button.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description: 'Texto de la acción principal, ya traducido. También nombra el menú.',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description: 'Ícono de la acción principal, del catálogo cerrado.',
  },
  {
    name: 'actions',
    type: 'readonly SplitAction[]',
    default: '[]',
    description: '{ id, label, icon?, disabled? }. Una deshabilitada se ve y las flechas la saltan.',
  },
  {
    name: '(primary)',
    type: 'output<void>',
    default: '—',
    description: 'La acción principal: el botón con texto.',
  },
  {
    name: '(action)',
    type: 'output<string>',
    default: '—',
    description: 'El id de la alternativa elegida en el menú.',
  },
];

const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'Los dos botones: variante Secondary', token: '--color-bg-secondary' },
  { part: 'Borde, uno solo entre los dos', token: '--color-border-strong' },
  { part: 'Fondo del menú', token: '--color-surface' },
  { part: 'Elevación del menú', token: '--shadow-md' },
  { part: 'Fila activa del menú', token: '--color-ghost-hover' },
  { part: 'Anillo de foco', token: '--focus-ring-shadow' },
];

const FORMATS: readonly SplitAction[] = [
  { id: 'pdf', label: 'PDF', icon: 'file-text' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV' },
  { id: 'label', label: 'Etiquetas (sin impresora)', icon: 'label-print', disabled: true },
];

/**
 * /design-system/components/split-button: la acción que se usa casi siempre, con las
 * alternativas a un clic. El patrón «Descargar / PDF / Excel / CSV».
 */
@Component({
  selector: 'ewms-showroom-split-button',
  templateUrl: './split-button.html',
  imports: [SplitButton, DemoFrame, PropTable, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSplitButton {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly formats = FORMATS;

  /** Lo último que se pidió, para que se vea qué salida disparó cada gesto. */
  protected readonly last = signal('(todavía nada)');

  protected readonly snippet = [
    '<ewms-split-button',
    "  [label]=\"'comun.descargar' | transloco\"",
    '  icon="download"',
    '  [actions]="formatos()"',
    '  (primary)="exportar(\'pdf\')"',
    '  (action)="exportar($event)"',
    '/>',
  ].join('\n');

  protected export(format: string): void {
    this.last.set(format);
  }
}
