/*
 * Public API surface of @ewms/design-system
 *
 * This is the ONLY legal entry point into this library. Nothing outside it may
 * reach into src/lib/** directly -- see the boundary rules in eslint.config.js.
 */
export { DESIGN_SYSTEM_VERSION } from './lib/version';
export { Icon, type IconSize } from './lib/icon/icon';
export { Text, type TextVariant } from './lib/text/text';
export {
  Button,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './lib/button/button';
export { IconButton } from './lib/icon-button/icon-button';
export { Tooltip, type TooltipPosition } from './lib/tooltip/tooltip';

/*
 * Form primitives (DS-2). All four implement ControlValueAccessor through the
 * one base in lib/forms, so `formControlName` and `ngModel` reach every one of
 * them the same way.
 *
 * `FieldSize` and `FieldState` are exported once, from the field module, and
 * shared by Input and Select: the two use the same control scale by rule, not
 * by coincidence, and a second name for it would let them drift apart.
 */
export { type FieldSize, type FieldState } from './lib/field/field.types';
export { Input, type InputType } from './lib/input/input';
export { Checkbox } from './lib/checkbox/checkbox';
export { Radio } from './lib/radio/radio';
export { Toggle } from './lib/toggle/toggle';
export { Select, type SelectOption } from './lib/select/select';
export { ICON_CATEGORIES, type IconCategory, type IconName } from './icons/icons.generated';
