/**
 * The product name. A brand name is not translated, so it is not a dictionary
 * key: as a key it would invite someone to "translate" it one day (i18n.md,
 * "Nombres de marca").
 *
 * index.html repeats it in <title> and in the startup-failure notice, which
 * render before Angular exists and cannot import this.
 */
export const BRAND_NAME = 'eWMS Advance';
