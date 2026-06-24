// Resolutie-onafhankelijke logische canvas-ruimte. x/y zijn het MIDDELPUNT van een
// item in deze logische eenheden; scale is een factor op BASE (item-breedte).
// De getoonde canvas mag elke pixelgrootte hebben (aspect 3:4); posities zijn dus
// proportioneel en de thumbnail-render matcht exact.
export const W = 1000;
export const H = 1333;
export const BASE = 300; // logische item-breedte bij scale 1
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;

export interface Placed {
  key: number; // lokale stabiele sleutel
  item_id: number;
  url: string; // cutout (of fallback) om te tonen
  x: number;
  y: number;
  scale: number;
  rotation: number; // graden
  z: number;
}

export interface Pt {
  x: number;
  y: number;
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDeg = (a: Pt, b: Pt): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// Schaal+rotatie uit een transform-/pinch-gebaar t.o.v. de begin-afstand/-hoek.
export function transform(
  baseScale: number,
  baseRotation: number,
  initialDist: number,
  initialAngle: number,
  curDist: number,
  curAngle: number
): { scale: number; rotation: number } {
  return {
    scale: clampScale(initialDist ? (baseScale * curDist) / initialDist : baseScale),
    rotation: baseRotation + (curAngle - initialAngle)
  };
}
