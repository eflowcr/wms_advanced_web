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

/*
 * Feedback (DS-3). Two formats of one message, one vocabulary of severity.
 *
 * `FeedbackVariant` is exported once, from the banner, and the toast uses the
 * same type: a screen that raises a danger banner and a danger toast must not
 * be able to spell the two differently.
 *
 * Info is called Info and is painted `neutral`. There is no `info` colour
 * family and there is not going to be one -- the blue means "you click this"
 * (Fundamentos de Marca).
 */
export { Banner, type FeedbackVariant } from './lib/banner/banner';
export { ToastService } from './lib/toast/toast.service';
export { ToastOutlet, type Toast } from './lib/toast/toast-outlet';

/*
 * Cards (DS-3). One component, two uses, decided by where it is written: an
 * option when it is inside an `ewms-card-group`, a container anywhere else.
 */
export { Card } from './lib/card/card';
export { CardGroup } from './lib/card/card-group';

/*
 * Dialog (DS-3). Over @angular/cdk/dialog: the focus trap, the role, the
 * inert background and the focus restoration are the CDK's, and are not
 * rebuilt here. What this library adds is the two shapes a dialog takes.
 *
 * The confirmation component itself is NOT exported: a consumer calls
 * `confirm()` and gets a promise. A second way to raise a confirmation is how
 * two confirmations in one application end up looking different.
 */
export { DialogService, type OpenDialogOptions } from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogTone } from './lib/dialog/dialog.types';

/*
 * Search select (DS-3, REQ-FE-DS3-001).
 *
 * `SearchSource<T>` is the data contract the backend will be asked for, not a
 * wrapper over an endpoint that exists. The component knows nothing about
 * HTTP; moving from a demo source to a real one changes an implementation of
 * that interface and nothing else.
 *
 * No in-memory implementation ships from here. A demo source is demo code and
 * lives with the demo; the library would carry it into every production bundle
 * for the sake of one page.
 */
export {
  SearchSelect,
  type SearchDisplay,
  type SearchPage,
  type SearchSelectMessages,
  type SearchSource,
  type SearchStatus,
} from './lib/search-select/search-select';
export { SEARCH_PAGE_SIZE } from './lib/search-select/search-source';
