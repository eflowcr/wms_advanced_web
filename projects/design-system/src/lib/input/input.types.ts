import type { FieldSize } from '../field/field.types';

export type InputType = 'text' | 'number' | 'password' | 'search' | 'textarea';

/**
 * Left padding when a prefix icon is in the box: the field's own padding, plus
 * the 16 px icon, plus 8 px of air. 34 / 36 / 38 -- it tracks the padding scale
 * rather than being one flat number, so the caret sits the same distance from
 * the icon at every size.
 */
export const PREFIX_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'pl-8.5',
  md: 'pl-9',
  lg: 'pl-9.5',
};

/**
 * Left offset of that icon, which is exactly the field's horizontal padding:
 * the icon lines up with where the text would have started.
 */
export const PREFIX_ICON_OFFSET_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'left-2.5',
  md: 'left-3',
  lg: 'left-3.5',
};

/**
 * Right padding when the suffix is in the box.
 *
 * One value for all three sizes, unlike the prefix, because the suffix is not
 * an icon: it is an `ewms-icon-button`, and the smallest one that exists is a
 * 32 px square. 4 px of inset on each side of it is 40, whatever the field's own
 * padding would have been.
 */
export const SUFFIX_PADDING_CLASS = 'pr-10';
