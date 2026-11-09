import { describe, expect, it } from 'vitest';
import type { Rotation } from '@/shared/api/contracts';
import { displayAspect, rectFromPoints, rectToPage, rectToView, toPagePoint, toViewPoint } from './geometry';

describe('annotation geometry', () => {
  it.each<Rotation>([0, 90, 180, 270])('page ⇄ view mapping round-trips at %i°', (rotation) => {
    const point = { x: 0.2, y: 0.7 };
    const back = toPagePoint(toViewPoint(point, rotation), rotation);
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
  });

  it('rotates clockwise: top-left of the page ends up top-right at 90°', () => {
    expect(toViewPoint({ x: 0, y: 0 }, 90)).toEqual({ x: 1, y: 0 });
  });

  it('keeps a rectangle attached to the same content after rotation', () => {
    const rect = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };
    const viewed = rectToView(rect, 90);
    expect(viewed).toEqual({
      x: expect.closeTo(0.7),
      y: expect.closeTo(0.1),
      width: expect.closeTo(0.2),
      height: expect.closeTo(0.3),
    });
    const stored = rectToPage(viewed, 90);
    expect(stored.x).toBeCloseTo(rect.x);
    expect(stored.width).toBeCloseTo(rect.width);
  });

  it('normalizes drag direction and clamps to the page', () => {
    expect(rectFromPoints({ x: 1.2, y: 0.5 }, { x: 0.5, y: -0.1 })).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
  });

  it('swaps the aspect ratio for quarter turns', () => {
    expect(displayAspect(612, 792, 0)).toBeCloseTo(792 / 612);
    expect(displayAspect(612, 792, 90)).toBeCloseTo(612 / 792);
  });
});
