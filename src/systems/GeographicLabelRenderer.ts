import Phaser from 'phaser';
import type { TileMap } from './TileMap';
import type { WorldMarkerSystem } from './WorldMarkerSystem';
import type { WorldMarker } from '../types/WorldMarker';
import { isGeographicMarker, normalizeGeographicCategory } from '../types/geographicMarker';
import { getGeographicMarkerStyle } from '../data/geographicMarkers';

// Cartographic labels sit just below units (18) so unit sprites stay readable,
// but above terrain/ambient (≤16). Non-interactive: they never consume input.
const GEOGRAPHIC_LABEL_DEPTH = 17;

/**
 * Renders `geographic` World Markers as elegant, world-anchored cartographic
 * text directly over the map — no pins, borders, backgrounds, tooltips, or
 * gameplay interaction. Presentation is fully data-driven via
 * {@link getGeographicMarkerStyle}; this class contains no gameplay logic and
 * touches no gameplay state.
 *
 * Text is added in world space, so it stays geographically anchored while the
 * camera pans and scales naturally with zoom.
 */
export class GeographicLabelRenderer {
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly worldMarkerSystem: WorldMarkerSystem,
  ) {
    this.refresh();
  }

  refresh(): void {
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;

    for (const marker of this.worldMarkerSystem.getAllMarkers()) {
      if (!isGeographicMarker(marker)) continue;
      this.drawLabel(marker);
    }
  }

  shutdown(): void {
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;
  }

  private drawLabel(marker: WorldMarker): void {
    const text = (marker.name ?? '').trim();
    if (!text) return;

    const category = normalizeGeographicCategory(marker.category ?? marker.metadata?.category);
    const style = getGeographicMarkerStyle(category);
    const center = this.tileMap.tileToWorld(marker.x, marker.y);
    const tileSize = this.tileMap.getTileSize();
    const fontSize = Math.round(
      Math.min(style.maxFontSize, Math.max(style.minFontSize, tileSize * style.fontScale)),
    );
    const display = style.uppercase ? text.toUpperCase() : text;

    const label = this.scene.add.text(center.x, center.y, display, {
      fontFamily: style.fontFamily,
      fontSize: `${fontSize}px`,
      fontStyle: style.fontStyle,
      color: style.color,
      stroke: style.strokeColor,
      strokeThickness: style.strokeThickness,
    })
      .setOrigin(0.5, 0.5)
      .setAlpha(style.alpha)
      .setDepth(GEOGRAPHIC_LABEL_DEPTH);
    label.setLetterSpacing(style.letterSpacing);
    this.labels.push(label);
  }
}
