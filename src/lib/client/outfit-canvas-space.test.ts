import { describe, expect, it } from 'vitest';
import { angleDeg, clampScale, dist, MAX_SCALE, MIN_SCALE, transform } from './outfit-canvas-space';

describe('canvas-space math', () => {
  it('dist', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('angleDeg', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
  });

  it('clampScale bounds', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });

  it('transform doubles scale when distance doubles', () => {
    const { scale } = transform(1, 0, 100, 0, 200, 0);
    expect(scale).toBe(2);
  });

  it('transform adds rotation delta', () => {
    const { rotation } = transform(1, 10, 100, 30, 100, 75);
    expect(rotation).toBe(55); // 10 + (75-30)
  });

  it('transform clamps and survives zero initial distance', () => {
    expect(transform(1, 0, 0, 0, 50, 0).scale).toBe(1); // geen NaN
  });
});
