import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DESIGN_SYSTEM_VERSION, SplitButton, type SplitAction } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';

/**
 * Verificada contra split-button.ts.
 * t(showroom.splitButton.props.label, showroom.splitButton.props.icon,
 *   showroom.splitButton.props.actions, showroom.splitButton.props.primary,
 *   showroom.splitButton.props.action)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.splitButton.props.label',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description: 'showroom.splitButton.props.icon',
  },
  {
    name: 'actions',
    type: 'readonly SplitAction[]',
    default: '[]',
    description: 'showroom.splitButton.props.actions',
  },
  {
    name: '(primary)',
    type: 'output<void>',
    default: '—',
    description: 'showroom.splitButton.props.primary',
  },
  {
    name: '(action)',
    type: 'output<string>',
    default: '—',
    description: 'showroom.splitButton.props.action',
  },
];

/**
 * t(showroom.splitButton.anatomy.parts.buttons, showroom.splitButton.anatomy.parts.border,
 *   showroom.splitButton.anatomy.parts.menuSurface, showroom.splitButton.anatomy.parts.menuElevation,
 *   showroom.splitButton.anatomy.parts.activeRow, showroom.splitButton.anatomy.parts.focusRing)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.splitButton.anatomy.parts.buttons', token: '--color-bg-secondary' },
  { part: 'showroom.splitButton.anatomy.parts.border', token: '--color-border-strong' },
  { part: 'showroom.splitButton.anatomy.parts.menuSurface', token: '--color-surface' },
  { part: 'showroom.splitButton.anatomy.parts.menuElevation', token: '--shadow-md' },
  { part: 'showroom.splitButton.anatomy.parts.activeRow', token: '--color-ghost-hover' },
  { part: 'showroom.splitButton.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
];

/**
 * /design-system/components/split-button: la acción que se usa casi siempre, con las
 * alternativas a un clic. El patrón «Descargar / PDF / Excel / CSV».
 */
@Component({
  selector: 'ewms-showroom-split-button',
  templateUrl: './split-button.html',
  imports: [SplitButton, DemoFrame, PropTable, Prose, TokenValue, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSplitButton {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  /**
   * El menú recibe las etiquetas ya traducidas. PDF, Excel y CSV son nombres de formato: no se
   * traducen.
   * t(showroom.splitButton.demo.labels)
   */
  protected readonly formats = translated((t): readonly SplitAction[] => [
    { id: 'pdf', label: 'PDF', icon: 'file-text' },
    { id: 'xlsx', label: 'Excel' },
    { id: 'csv', label: 'CSV' },
    {
      id: 'label',
      label: t('showroom.splitButton.demo.labels'),
      icon: 'label-print',
      disabled: true,
    },
  ]);

  /** Lo último que se pidió, para que se vea qué salida disparó cada gesto. `null` hasta el primero. */
  protected readonly last = signal<string | null>(null);

  protected readonly snippet = [
    '<ewms-split-button',
    '  [label]="\'comun.descargar\' | transloco"',
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
