/** Pure projection shared by the camera's input conversion and GPU uniforms. */
export interface PlanetaryView {
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
  strength: number;
}

export function planetaryZoomRange(width: number, height: number, mapWidth: number, mapHeight: number) {
  const fit = Math.min(width / mapWidth, height / mapHeight);
  // Keep the existing cover overview flat; add altitude below it.
  const start = Math.min(0.65, Math.max(width / mapWidth, height / mapHeight));
  return { start, min: Math.min(fit * 0.82, start * 0.42) };
}

export function planetaryStrength(zoom: number, start: number, min: number): number {
  const t = Math.max(0, Math.min(1, Math.log(start / zoom) / Math.log(start / min)));
  return t * t * (3 - 2 * t);
}

export function planetaryParameters(view: PlanetaryView) {
  const radius = Math.min(view.width, view.height) * 0.43;
  const k = view.strength;
  const bend = Math.sqrt(k);
  // A camera filter only has the visible framebuffer. Keep the inverse
  // footprint inside it while the horizon first enters the viewport.
  const px = view.width * bend / (2 * radius);
  const py = view.height * bend / (2 * radius);
  const longitude = Math.atan2(px, Math.sqrt(Math.max(0, 1 - px * px - py * py)));
  const limitX = bend > 0 ? view.width * bend / (2 * longitude) : radius;
  const limitY = bend > 0 ? view.height * bend / (2 * Math.asin(Math.min(1, py))) : radius;
  return {
    radius,
    longitude,
    scaleX: Math.min(limitX, radius * (1 - k) + view.mapWidth * view.zoom / (2 * Math.PI) * k),
    scaleY: Math.min(limitY, radius * (1 - k) + view.mapHeight * view.zoom / Math.PI * k),
  };
}

/** Maps a displayed point to the unfiltered camera image; null is beyond the limb. */
export function unprojectPlanetary(x: number, y: number, view: PlanetaryView): { x: number; y: number } | null {
  if (view.strength <= 0) return { x, y };
  const { radius, scaleX, scaleY } = planetaryParameters(view);
  const bend = Math.sqrt(view.strength);
  const px = (x - view.width / 2) * bend / radius;
  const py = (y - view.height / 2) * bend / radius;
  const r2 = px * px + py * py;
  if (r2 >= 1) return null;
  const z = Math.sqrt(1 - r2);
  return {
    x: view.width / 2 + Math.atan2(px, z) * scaleX / bend,
    y: view.height / 2 + Math.asin(py) * scaleY / bend,
  };
}

/** Visible source footprint, used to constrain panning without pinning the
 * planet to a corner when the flat framebuffer is wider than the map. */
export function planetaryHalfExtents(view: PlanetaryView): { x: number; y: number } {
  if (view.strength <= 0) return { x: view.width / (2 * view.zoom), y: view.height / (2 * view.zoom) };
  const { radius, longitude, scaleX, scaleY } = planetaryParameters(view);
  const bend = Math.sqrt(view.strength);
  return {
    x: longitude * scaleX / (bend * view.zoom),
    y: Math.asin(Math.min(1, view.height * bend / (2 * radius))) * scaleY / (bend * view.zoom),
  };
}
