import { describe, it, expect } from 'vitest';
import {
  isNearPoint, clampZoom, zoomViewbox, panViewbox, deriveViewbox, pointsToSvg, screenToViewbox,
} from '../canvasGeom';

describe('isNearPoint', () => {
  it('true within tol, false outside', () => {
    expect(isNearPoint([0,0],[1,1],2)).toBe(true);
    expect(isNearPoint([0,0],[10,10],2)).toBe(false);
  });
});
describe('clampZoom', () => {
  it('clamps', () => {
    expect(clampZoom(0.05, 0.2, 5)).toBe(0.2);
    expect(clampZoom(99, 0.2, 5)).toBe(5);
    expect(clampZoom(1, 0.2, 5)).toBe(1);
  });
});
describe('zoomViewbox', () => {
  it('keeps the center point stationary in viewBox space', () => {
    const vb = [0,0,1000,1000];
    const out = zoomViewbox(vb, 0.5, [500,500]);
    expect(out).toEqual([250,250,500,500]);
  });
});
describe('panViewbox', () => {
  it('shifts min by delta', () => {
    expect(panViewbox([0,0,1000,1000], 10, -20)).toEqual([10,-20,1000,1000]);
  });
});
describe('deriveViewbox', () => {
  it('builds string from natural size', () => {
    expect(deriveViewbox(800, 600)).toBe('0 0 800 600');
  });
});
describe('pointsToSvg', () => {
  it('joins points', () => {
    expect(pointsToSvg([[0,0],[10,5]])).toBe('0,0 10,5');
  });
});
describe('screenToViewbox', () => {
  it('uses inverse CTM', () => {
    const fakeSvg = {
      createSVGPoint: () => ({ x:0, y:0, matrixTransform(m){ return m.apply(this); } }),
      getScreenCTM: () => ({
        inverse: () => ({ apply: (p) => ({ x: (p.x-10)/2, y: (p.y-20)/2 }) }),
      }),
    };
    expect(screenToViewbox({ clientX: 110, clientY: 220 }, fakeSvg)).toEqual([50, 100]);
  });
});
