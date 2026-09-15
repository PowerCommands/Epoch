import { globeOrientation, type PlanetaryView } from '../systems/rendering/PlanetaryProjection';

export type FlightPoint = { x: number; y: number };
type Vector = { x: number; y: number; z: number };
export const ICBM_ASCENT_MS = 1800;
export const ICBM_GLOBE_MS = 3700;
export const ICBM_FLIGHT_MS = 7900;
export const ICBM_RETURN_MS = 1500;
export const clampFlight = (n: number): number => Math.max(0, Math.min(1, n));
export const smoothFlight = (n: number): number => { const t = clampFlight(n); return t * t * (3 - 2 * t); };
export const mixFlight = (a: number, b: number, t: number): number => a + (b - a) * t;

const vector = (longitude: number, latitude: number): Vector => ({ x: Math.sin(longitude) * Math.cos(latitude),
  y: Math.sin(latitude), z: Math.cos(longitude) * Math.cos(latitude) });
const dot = (a: Vector, b: Vector): number => a.x * b.x + a.y * b.y + a.z * b.z;
const normalized = (v: Vector): Vector => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};

/** Great-circle travel crosses seams and poles without jumping through the
 * earth. Antipodal locations have a stable, explicitly chosen orbital plane. */
export function ballisticSurfacePoint(origin: FlightPoint, target: FlightPoint, progress: number, view: PlanetaryView): FlightPoint {
  const p = clampFlight(progress);
  if (p === 0) return { ...origin };
  if (p === 1) return { ...target };
  const from = globeOrientation(origin.x, origin.y, view), to = globeOrientation(target.x, target.y, view);
  const a = vector(from.longitude, from.latitude), b = vector(to.longitude, to.latitude);
  const cosine = Math.max(-1, Math.min(1, dot(a, b))), angle = Math.acos(cosine);
  let point: Vector;
  if (cosine > 0.9999) point = normalized({ x: mixFlight(a.x, b.x, p), y: mixFlight(a.y, b.y, p), z: mixFlight(a.z, b.z, p) });
  else {
    let tangent = { x: b.x - a.x * cosine, y: b.y - a.y * cosine, z: b.z - a.z * cosine };
    if (Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-6) {
      const axis = Math.abs(a.y) < 0.8 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const projection = dot(a, axis);
      tangent = { x: axis.x - a.x * projection, y: axis.y - a.y * projection, z: axis.z - a.z * projection };
    }
    tangent = normalized(tangent);
    point = { x: a.x * Math.cos(angle * p) + tangent.x * Math.sin(angle * p),
      y: a.y * Math.cos(angle * p) + tangent.y * Math.sin(angle * p),
      z: a.z * Math.cos(angle * p) + tangent.z * Math.sin(angle * p) };
  }
  const u = 0.5 + Math.atan2(point.x, point.z) / (2 * Math.PI);
  const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, point.y))) / Math.PI;
  const surface = view.surface ?? { originX: 0, originY: 0, width: view.mapWidth, height: view.mapHeight, shearX: 0 };
  return { x: surface.originX + u * surface.width + v * surface.shearX, y: surface.originY + v * surface.height };
}

/** Exaggerated altitude remains readable even for a strike on a nearby tile. */
export function ballisticAltitude(progress: number): number {
  return Math.sin(Math.PI * clampFlight(progress)) ** 0.8 * 0.58;
}

export function icbmImpactHoldMs(nuclear: boolean, intercepted: boolean): number {
  return intercepted ? 1800 : nuclear ? 6500 : 3000;
}
