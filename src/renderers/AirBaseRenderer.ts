import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';
import type { AirBaseSite, AirOperationsSystem } from '../systems/AirOperationsSystem';
import type { UnitManager } from '../systems/UnitManager';
import type { CityManager } from '../systems/CityManager';
import type { SelectionManager } from '../systems/SelectionManager';
import type { Unit } from '../entities/Unit';
import { getUnitSpriteKey } from '../utils/assetPaths';

// The representative aircraft sits above the building sprite (depth 14) but
// below real ground units (depth 18), so a unit standing on the tile still
// reads on top. The capacity badge floats just above that.
const AIRCRAFT_DEPTH = 16;
const BADGE_DEPTH = 16.6;
// The stationed aircraft is drawn a little smaller than a free unit so the
// airbase building underneath stays legible.
const AIRCRAFT_TILE_FILL_SCALE = 0.62;
const BADGE_OFFSET_Y = 20;

const BADGE_FONT = 'Arial, sans-serif';
const BADGE_TEXT_COLOR = '#f6fbff';
const BADGE_FILL = 0x101820;
const BADGE_FILL_ALPHA = 0.86;
const BADGE_BORDER = 0xd8e2ee;
const BADGE_BORDER_FULL = 0xffb347;
const BADGE_PAD_X = 6;
const BADGE_PAD_Y = 2;

interface AirBaseVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  badgeBg: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text;
}

/**
 * Draws stationed aircraft and a compact ✈ current/max badge on top of
 * air-capable buildings (Airfield / Air Base) so the map shows at a glance
 * that aircraft are based there and how many of the base's slots are used.
 *
 * Pure presentation: occupancy and capacity are read from AirOperationsSystem
 * (the authoritative basing state), never duplicated here, and the sprites are
 * non-interactive so SelectionManager still resolves clicks to the aircraft
 * beneath. Carrier bases are excluded — the carrier renders as its own unit and
 * shows a cargo badge already.
 */
export class AirBaseRenderer {
  private readonly visuals = new Map<string, AirBaseVisual>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly air: AirOperationsSystem,
    unitManager: UnitManager,
    cityManager: CityManager,
    private readonly selection: SelectionManager,
    private readonly visible: (x: number, y: number) => boolean,
  ) {
    unitManager.onUnitChanged((event) => {
      if (event.unit.unitType.aircraftRole || event.unit.unitType.aircraftCapacity) this.refreshAll();
    });
    cityManager.onCityChanged((event) => {
      if (event.reason === 'buildingsChanged' || event.reason === 'removed' || event.reason === 'ownershipTransferred') {
        this.refreshAll();
      }
    });
    this.air.onFlight(() => this.refreshAll());
    this.selection.onSelectionChanged(() => this.refreshAll());
    this.refreshAll();
  }

  refreshAll(): void {
    const seen = new Set<string>();
    for (const site of this.air.allSites()) {
      if (site.base.kind !== 'city') continue;
      if (!this.visible(site.x, site.y)) continue;
      const key = `${site.base.kind}:${site.base.id}`;
      seen.add(key);
      this.renderSite(key, site);
    }
    for (const [key, visual] of this.visuals) {
      if (seen.has(key)) continue;
      this.destroyVisual(visual);
      this.visuals.delete(key);
    }
  }

  shutdown(): void {
    for (const visual of this.visuals.values()) this.destroyVisual(visual);
    this.visuals.clear();
  }

  private renderSite(key: string, site: AirBaseSite): void {
    const aircraft = this.air.aircraftAt(site.base);
    const { x, y } = this.tileMap.tileToWorld(site.x, site.y);

    let visual = this.visuals.get(key);
    if (!visual) {
      visual = this.createVisual();
      this.visuals.set(key, visual);
    }
    visual.container.setPosition(x, y);

    const representative = this.pickRepresentative(aircraft);
    const textureKey = representative ? getUnitSpriteKey(representative.unitType.id) : '';
    if (representative && this.scene.textures.exists(textureKey)) {
      const rect = this.tileMap.getTileRect(site.x, site.y);
      const size = Math.min(rect.width, rect.height) * AIRCRAFT_TILE_FILL_SCALE;
      visual.sprite.setTexture(textureKey);
      visual.sprite.setDisplaySize(size, size);
      visual.sprite.setVisible(true);
    } else {
      visual.sprite.setVisible(false);
    }

    this.drawBadge(visual, aircraft.length, site.capacity);
  }

  /**
   * Prefer showing the selected aircraft when one of the base's aircraft is
   * selected; otherwise a deterministic aircraft (stable id order) so the
   * visible plane does not flicker between renders.
   */
  private pickRepresentative(aircraft: Unit[]): Unit | undefined {
    const selected = this.selection.getSelected();
    if (selected?.kind === 'unit') {
      const match = aircraft.find((unit) => unit.id === selected.unit.id);
      if (match) return match;
    }
    return aircraft[0];
  }

  private drawBadge(visual: AirBaseVisual, count: number, capacity: number): void {
    visual.badge.setText(`✈ ${count} / ${capacity}`);
    const width = visual.badge.width + BADGE_PAD_X * 2;
    const height = visual.badge.height + BADGE_PAD_Y * 2;
    visual.badge.setPosition(0, BADGE_OFFSET_Y);

    const full = capacity > 0 && count >= capacity;
    visual.badgeBg.clear();
    visual.badgeBg.fillStyle(BADGE_FILL, BADGE_FILL_ALPHA);
    visual.badgeBg.fillRoundedRect(-width / 2, BADGE_OFFSET_Y - height / 2, width, height, 4);
    visual.badgeBg.lineStyle(1, full ? BADGE_BORDER_FULL : BADGE_BORDER, full ? 0.9 : 0.45);
    visual.badgeBg.strokeRoundedRect(-width / 2, BADGE_OFFSET_Y - height / 2, width, height, 4);
  }

  private createVisual(): AirBaseVisual {
    const sprite = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    const badgeBg = this.scene.add.graphics();
    const badge = this.scene.add
      .text(0, BADGE_OFFSET_Y, '', {
        fontFamily: BADGE_FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: BADGE_TEXT_COLOR,
      })
      .setOrigin(0.5, 0.5);

    const container = this.scene.add.container(0, 0, [sprite, badgeBg, badge]);
    container.setDepth(AIRCRAFT_DEPTH);
    badgeBg.setDepth(BADGE_DEPTH - 0.1);
    badge.setDepth(BADGE_DEPTH);
    // Purely decorative: never intercept pointer events so SelectionManager
    // resolves clicks to the aircraft/city/tile underneath.
    container.disableInteractive();
    return { container, sprite, badgeBg, badge };
  }

  private destroyVisual(visual: AirBaseVisual): void {
    visual.badge.destroy();
    visual.badgeBg.destroy();
    visual.sprite.destroy();
    visual.container.destroy();
  }
}
