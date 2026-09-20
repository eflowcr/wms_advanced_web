import {
  LISTBOX_OPTION_BASE_CLASSES,
  LISTBOX_PANEL_CLASSES,
  LISTBOX_SELECTED_WEIGHT,
  listboxOptionClasses,
} from '../listbox/listbox.types';

/**
 * One row of the panel.
 *
 * `label` is the text a person reads, already translated by the consumer --
 * the design system speaks no language (ADR 0008). `value` is what the form
 * receives, and it is `unknown` on purpose: an id, a code, an enum member or a
 * whole object are all legitimate, and narrowing it here would push every
 * consumer into a cast.
 */
export interface SelectOption {
  label: string;
  value: unknown;
}

/**
 * THE PANEL AND THE ROWS NOW LIVE IN `listbox/`, AND THIS FILE ONLY NAMES
 * THEM.
 *
 * They moved there in DS-3 when `ewms-search-select` arrived, because
 * REQ-FE-DS3-001 HG-04 forbids a second panel or a second keyboard alongside
 * this one. Nothing about the Select changed: the names below are the ones its
 * template and its spec already used, which is what made the extraction
 * provable rather than merely plausible.
 *
 * Virtual scrolling for lists past a hundred options is noted in the ficha and
 * deliberately still absent: it is an optimisation with no consumer, and the
 * answer for a list that long is `ewms-search-select`, which pages.
 */
export const SELECT_PANEL_CLASSES = LISTBOX_PANEL_CLASSES;
export const SELECT_OPTION_BASE_CLASSES = LISTBOX_OPTION_BASE_CLASSES;
export const SELECT_SELECTED_WEIGHT = LISTBOX_SELECTED_WEIGHT;
export const selectOptionClasses = listboxOptionClasses;
