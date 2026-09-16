/*
 * Public API surface of @ewms/design-system
 *
 * This is the ONLY legal entry point into this library. Nothing outside it may
 * reach into src/lib/** directly -- see the boundary rules in eslint.config.js.
 */
export { Icon, type IconSize } from './lib/icon/icon';
export {
  ICON_CATEGORIES,
  type IconCategory,
  type IconName,
} from './icons/icons.generated';
