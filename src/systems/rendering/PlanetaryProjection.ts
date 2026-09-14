/** Pure projection shared by the camera's input conversion and GPU uniforms. */
export interface PlanetaryView {
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
  strength: number;
  surface?: PlanetarySurface;
  navigation?: { longitude: number; latitude: number; centerX: number; centerY: number };
}

/** Painted axial-map parallelogram, independent of its rectangular camera bounds. */
export interface PlanetarySurface {
  originX: number;
  originY: number;
  width: number;
  height: number;
  shearX: number;
}

export function hexPlanetarySurface(columns: number, rows: number, tileSize: number): PlanetarySurface {
  const radius = tileSize / 2;
  // The outer tile centres bound an entirely painted parallelogram. Using the
  // bounding box of the hex outlines would include empty zigzag edge pockets.
  return { originX: radius - (columns === 1 ? radius / 4 : 0),
    originY: radius - (rows === 1 ? radius / 4 : 0),
    width: Math.max(radius / 2, (columns - 1) * Math.sqrt(3) * radius),
    height: Math.max(radius / 2, (rows - 1) * 1.5 * radius),
    shearX: (rows - 1) * Math.sqrt(3) * radius / 2 };
}

function globeSurface(view: PlanetaryView): PlanetarySurface {
  return view.surface ?? { originX: 0, originY: 0, width: view.mapWidth, height: view.mapHeight, shearX: 0 };
}

export function globeOrientation(x: number, y: number, view: PlanetaryView): { longitude: number; latitude: number } {
  const surface = globeSurface(view);
  const v = Math.max(0, Math.min(1, (y - surface.originY) / surface.height));
  const u = Math.max(0, Math.min(1, (x - surface.originX - v * surface.shearX) / surface.width));
  return { longitude: (u - 0.5) * GLOBE_LONGITUDE_SPAN, latitude: (v - 0.5) * Math.PI };
}

// The finite map covers one visual revolution; this creates no tile adjacency.
export const GLOBE_LONGITUDE_SPAN = Math.PI * 2;
export const GLOBE_LATITUDE_LIMIT = Math.PI * 0.44;
export function wrapLongitude(value: number): number {
  return ((value + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

export function globeDestination(view: PlanetaryView): { x: number; y: number } {
  const nav = view.navigation!;
  const surface = globeSurface(view);
  const u = 0.5 + nav.longitude / GLOBE_LONGITUDE_SPAN, v = 0.5 + nav.latitude / Math.PI;
  return { x: surface.originX + surface.width * u + surface.shearX * v,
    y: surface.originY + surface.height * v };
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
  const surface = globeSurface(view);
  const stretch = view.navigation ? k : 0;
  const width = view.mapWidth + (surface.width - view.mapWidth) * stretch;
  const height = view.mapHeight + (surface.height - view.mapHeight) * stretch;
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
    shear: surface.shearX / surface.height * stretch,
    scaleX: Math.min(limitX, radius * (1 - k) + width * view.zoom / (2 * Math.PI) * k),
    scaleY: Math.min(limitY, radius * (1 - k) + height * view.zoom / Math.PI * k),
  };
}

/** Maps a displayed point to the unfiltered camera image; null is beyond the limb. */
export function unprojectPlanetary(x: number, y: number, view: PlanetaryView): { x: number; y: number } | null {
  if (view.strength <= 0) return { x, y };
  const { radius, scaleX, scaleY, shear } = planetaryParameters(view);
  const bend = Math.sqrt(view.strength);
  const px = (x - view.width / 2) * bend / radius;
  const py = (y - view.height / 2) * bend / radius;
  const r2 = px * px + py * py;
  if (r2 >= 1) return null;
  const z = Math.sqrt(1 - r2);
  let longitude = Math.atan2(px, z);
  let latitude = Math.asin(py);
  let offsetX = 0, offsetY = 0;
  if (view.navigation) {
    const nav = view.navigation;
    const yaw = nav.longitude * view.strength;
    const pitch = nav.latitude * view.strength;
    const rotatedY = py * Math.cos(pitch) + z * Math.sin(pitch);
    const rotatedZ = z * Math.cos(pitch) - py * Math.sin(pitch);
    longitude = wrapLongitude(Math.atan2(px, rotatedZ) + yaw) - yaw;
    latitude = Math.asin(Math.max(-1, Math.min(1, rotatedY))) - pitch;
    const destination = globeDestination(view);
    offsetX = (destination.x - nav.centerX) * view.zoom;
    offsetY = (destination.y - nav.centerY) * view.zoom;
  }
  return {
    x: view.width / 2 + offsetX + (longitude * scaleX + shear * latitude * scaleY) / bend,
    y: view.height / 2 + offsetY + latitude * scaleY / bend,
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
