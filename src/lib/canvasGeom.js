// Pure geometry helpers for the SVG layout builder. No React, no DOM globals.

export function isNearPoint(a, b, tol) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy) <= tol;
}

export function clampZoom(scale, min, max) {
  return Math.min(max, Math.max(min, scale));
}

// factor < 1 zooms in (smaller viewBox), > 1 zooms out. center is in viewBox coords.
export function zoomViewbox(viewbox, factor, center) {
  const [minX, minY, w, h] = viewbox;
  const nw = w * factor;
  const nh = h * factor;
  const nx = center[0] - (center[0] - minX) * factor;
  const ny = center[1] - (center[1] - minY) * factor;
  return [nx, ny, nw, nh];
}

export function panViewbox(viewbox, dx, dy) {
  return [viewbox[0] + dx, viewbox[1] + dy, viewbox[2], viewbox[3]];
}

export function deriveViewbox(naturalW, naturalH) {
  return `0 0 ${naturalW} ${naturalH}`;
}

export function pointsToSvg(points) {
  return points.map((p) => `${p[0]},${p[1]}`).join(' ');
}

// Convert a mouse/pointer event (clientX/clientY) to viewBox coordinates.
export function screenToViewbox(evt, svgEl) {
  const pt = svgEl.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const inv = svgEl.getScreenCTM().inverse();
  const res = pt.matrixTransform ? pt.matrixTransform(inv) : inv.apply(pt);
  return [res.x, res.y];
}
