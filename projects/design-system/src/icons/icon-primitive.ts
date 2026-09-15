/**
 * Geometry of one icon, as data.
 *
 * icons.generated.ts is a table of these. The <ewms-icon> template walks the
 * list and binds each attribute, so an icon never reaches the DOM as markup
 * (no innerHTML, no DomSanitizer). Presentation attributes (stroke, fill,
 * stroke-width, linecap, linejoin) are deliberately absent: the component sets
 * them once on the <svg>.
 *
 * Tabler 3 ships every outline icon as <path> only; the other shapes are here
 * so a future custom icon drawn with them goes through the same pipeline.
 */
export interface IconPath {
  readonly type: 'path';
  readonly d: string;
}

export interface IconCircle {
  readonly type: 'circle';
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface IconRect {
  readonly type: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx?: number;
  readonly ry?: number;
}

export interface IconLine {
  readonly type: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export type IconPrimitive = IconPath | IconCircle | IconRect | IconLine;
