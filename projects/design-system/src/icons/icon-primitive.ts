/**
 * Geometry of one icon, as data.
 *
 * icons.generated.ts is a table of these. The <ewms-icon> template walks the
 * list and binds `d`, so an icon never reaches the DOM as markup (no innerHTML,
 * no DomSanitizer). Presentation attributes (stroke, fill, stroke-width,
 * linecap, linejoin) are deliberately absent: the component sets them once on
 * the <svg>.
 *
 * Only <path>, on purpose (ADR 0011): Tabler outline ships every icon as paths
 * and so does the custom pallet. A shape drawn as <circle>, <rect> or <line>
 * is converted to a path before it enters the set, which is what any editor
 * does on export. One element type means one template branch and nothing that
 * no icon reaches.
 */
export interface IconPath {
  readonly type: 'path';
  readonly d: string;
}

export type IconPrimitive = IconPath;
