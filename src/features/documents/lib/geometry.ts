import type { NormalizedRect, Rotation } from '@/shared/api/contracts';

/**
 * Annotations are stored in normalized (0–1) coordinates of the UNROTATED page. That makes them
 * independent of zoom level, device pixel ratio and page rotation. These helpers map between the
 * stored space and the on-screen (rotated) space. Rotation is clockwise, as in PDF.
 */
export interface Point {
  x: number;
  y: number;
}

export function toViewPoint({ x, y }: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return { x, y };
    case 90:
      return { x: 1 - y, y: x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: y, y: 1 - x };
  }
}

export function toPagePoint({ x, y }: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return { x, y };
    case 90:
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: 1 - y, y: x };
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Normalized rectangle spanning two points (any drag direction). */
export function rectFromPoints(a: Point, b: Point): NormalizedRect {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  return { x: x1, y: y1, width: clamp01(Math.max(a.x, b.x)) - x1, height: clamp01(Math.max(a.y, b.y)) - y1 };
}

function mapRect(rect: NormalizedRect, map: (p: Point) => Point): NormalizedRect {
  return rectFromPoints(
    map({ x: rect.x, y: rect.y }),
    map({ x: rect.x + rect.width, y: rect.y + rect.height }),
  );
}

export const rectToView = (rect: NormalizedRect, rotation: Rotation) =>
  mapRect(rect, (p) => toViewPoint(p, rotation));
export const rectToPage = (rect: NormalizedRect, rotation: Rotation) =>
  mapRect(rect, (p) => toPagePoint(p, rotation));

/** Displayed aspect ratio (height / width) of a page after rotation. */
export const displayAspect = (width: number, height: number, rotation: Rotation) =>
  rotation === 90 || rotation === 270 ? width / height : height / width;
