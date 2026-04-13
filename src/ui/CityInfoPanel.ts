import Phaser from 'phaser';
import { City } from '../entities/City';
import { NationManager } from '../systems/NationManager';
import { CityManager } from '../systems/CityManager';
import { ResourceSystem } from '../systems/ResourceSystem';

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 180;
const PADDING = 12;
const MARGIN = 16;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;

/**
 * CityInfoPanel — fast panel i nedre vänstra hörnet.
 * Visas bara när en stad är vald. Visar namn, ägare, koordinater, mat
 * och produktion.
 */
export class CityInfoPanel {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly detailLabel: Phaser.GameObjects.Text;
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private currentCity: City | null = null;

  constructor(
    scene: Phaser.Scene,
    nationManager: NationManager,
    cityManager: CityManager,
    resourceSystem: ResourceSystem,
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;

    const { height } = scene.scale;
    const panelX = MARGIN;
    const panelY = height - PANEL_HEIGHT - MARGIN;

    this.bg = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.nameLabel = scene.add
      .text(panelX + PADDING, panelY + PADDING, '', {
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e8e8e8',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.detailLabel = scene.add
      .text(panelX + PADDING, panelY + PADDING + 32, '', {
        fontSize: '15px',
        color: '#c8c8c8',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.setVisible(false);

    // Uppdatera live om den visade stadens ägare genererat resurser
    resourceSystem.on((e) => {
      if (this.currentCity && this.currentCity.ownerId === e.nationId) {
        this.render(this.currentCity);
      }
    });
  }

  update(city: City | null): void {
    this.currentCity = city;
    if (city === null) {
      this.setVisible(false);
      return;
    }
    this.render(city);
    this.setVisible(true);
  }

  private render(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    const ownerName = nation?.name ?? 'Unknown';
    const res = this.cityManager.getResources(city.id);

    this.nameLabel.setText(city.name);
    this.detailLabel.setText([
      `Owner: ${ownerName}`,
      `Location: (${city.tileX}, ${city.tileY})`,
      '',
      `Food: ${res.food} (+${res.foodPerTurn}/turn)`,
      `Production: ${res.production} (+${res.productionPerTurn}/turn)`,
    ]);
  }

  private setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.nameLabel.setVisible(visible);
    this.detailLabel.setVisible(visible);
  }
}
