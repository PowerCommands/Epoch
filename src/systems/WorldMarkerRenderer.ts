import Phaser from 'phaser';
import type { TileMap } from './TileMap';
import type { DiagnosticSystem } from './DiagnosticSystem';
import type { WorldMarkerSystem } from './WorldMarkerSystem';
import type { WorldMarker } from '../types/WorldMarker';

const MARKER_COLORS: Record<string, number> = {
  islandDiscovery: 0x38d5ff,
};

export class WorldMarkerRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly unsubscribeVisibility: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly worldMarkerSystem: WorldMarkerSystem,
    diagnosticSystem: DiagnosticSystem,
  ) {
    this.graphics = scene.add.graphics().setDepth(58);
    this.unsubscribeVisibility = diagnosticSystem.subscribeVisibility((open) => {
      this.setVisible(open);
    });
    this.refresh();
    this.setVisible(diagnosticSystem.isOpen());
  }

  refresh(): void {
    this.graphics.clear();
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;

    for (const marker of this.worldMarkerSystem.getAllMarkers()) {
      this.drawMarker(marker);
    }
  }

  shutdown(): void {
    this.unsubscribeVisibility();
    this.graphics.destroy();
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;
  }

  private setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    for (const label of this.labels) label.setVisible(visible);
  }

  private drawMarker(marker: WorldMarker): void {
    const color = MARKER_COLORS[marker.type] ?? 0xffffff;
    const center = this.tileMap.tileToWorld(marker.x, marker.y);
    const tileSize = this.tileMap.getTileSize();
    const markerRadius = marker.radius !== undefined
      ? Math.max(0, marker.radius) * tileSize * 0.75
      : 0;

    if (markerRadius > 0) {
      this.graphics.lineStyle(2, color, 0.45);
      this.graphics.strokeCircle(center.x, center.y, markerRadius);
    }

    this.graphics.fillStyle(color, 0.85);
    this.graphics.fillCircle(center.x, center.y, Math.max(5, tileSize * 0.12));
    this.graphics.lineStyle(1, 0x00151c, 0.9);
    this.graphics.strokeCircle(center.x, center.y, Math.max(5, tileSize * 0.12));

    if (!marker.name) return;
    const label = this.scene.add.text(center.x, center.y - Math.max(14, tileSize * 0.35), marker.name, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#bff7ff',
      stroke: '#00151c',
      strokeThickness: 3,
    })
      .setOrigin(0.5, 1)
      .setDepth(59);
    this.labels.push(label);
  }
}
