import Phaser from 'phaser';
import { CITY_BASE_HEALTH } from '../data/cities';
import type { City } from '../entities/City';
import type { Producible } from '../types/producible';
import { getBuildingSpritePath, getCorporationSpritePath, getUnitSpritePath, getWonderSpritePath } from '../utils/assetPaths';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import type { ProductionSystem } from './ProductionSystem';
import { TileMap } from './TileMap';
import type { WonderSystem } from './WonderSystem';

const CITY_BANNER_DEPTH = 17;
const CITY_BANNER_OFFSET_Y = -30;
const PANEL_HEIGHT = 32;
const PANEL_RADIUS = 16;
const PANEL_BORDER_COLOR = 0xd9c58b;
const PANEL_SHADOW_COLOR = 0x000000;
const DIVIDER_COLOR = 0xb8b0c3;
const SLOT_BACKGROUND_COLOR = 0x1a2130;
const SLOT_BORDER_COLOR = 0xd9c58b;
const HEALTH_EMPTY_COLOR = 0x292929;
const HEALTH_TRACK_COLOR = 0x121214;
const LEFT_SECTION_WIDTH = 38;
const CONTENT_LEFT_PADDING = 8;
const CONTENT_RIGHT_PADDING = 8;
const CONTENT_GAP = 6;
const RIGHT_SLOT_SIZE = 27;
const RIGHT_SLOT_RADIUS = 13.5;
const DIVIDER_HEIGHT = 24;
const HEALTH_BAR_HEIGHT = 6;
const HEALTH_SEGMENT_COUNT = 10;
const HEALTH_SEGMENT_GAP = 2;
const NAME_MAX_WIDTH = 101;
const NAME_FONT_SIZE = 13;
const NAME_MIN_FONT_SIZE = 9;
const POPULATION_FONT_SIZE = 13;
const PRODUCTION_ICON_INSET = 2;

interface CityBannerView {
  container: Phaser.GameObjects.Container;
  chrome: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  populationText: Phaser.GameObjects.Text;
  productionImage: Phaser.GameObjects.Image;
  productionMask: Phaser.GameObjects.Graphics;
  productionFallbackText: Phaser.GameObjects.Text;
}

export class CityBannerRenderer {
  private readonly banners = new Map<string, CityBannerView>();
  private readonly loadingTextures = new Set<string>();
  private readonly missingTextures = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly productionSystem: ProductionSystem,
    private readonly wonderSystem?: WonderSystem,
  ) {
    this.rebuildAll();
  }

  refreshCity(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation) {
      this.removeBanner(city.id);
      return;
    }

    const view = this.banners.get(city.id) ?? this.createBanner(city.id);
    const world = this.tileMap.tileToWorld(city.tileX, city.tileY);
    const production = this.getVisibleProduction(city.id);
    const name = city.name.toUpperCase();
    const textColor = toCssColor(nation.secondaryColor);
    const textStrokeColor = toCssColor(darkenColor(nation.color, 0.35));

    view.container.setScrollFactor(1);
    view.container.setScale(1);
    view.container.setPosition(world.x, world.y + CITY_BANNER_OFFSET_Y);
    fitTextToWidth(view.nameText, name, NAME_MAX_WIDTH, NAME_FONT_SIZE, NAME_MIN_FONT_SIZE);
    view.nameText.setColor(textColor);
    view.nameText.setStroke(textStrokeColor, 3);
    view.populationText.setText(`${city.population}`);
    view.populationText.setColor(textColor);
    view.populationText.setStroke(textStrokeColor, 3);
    view.productionFallbackText.setColor(textColor);
    view.productionFallbackText.setStroke(textStrokeColor, 3);

    const middleWidth = Math.max(
      Math.ceil(view.nameText.width),
      RIGHT_SLOT_SIZE * 2,
    );
    const panelWidth = LEFT_SECTION_WIDTH
      + CONTENT_LEFT_PADDING
      + middleWidth
      + CONTENT_GAP
      + RIGHT_SLOT_SIZE
      + CONTENT_RIGHT_PADDING;
    const left = -panelWidth / 2;
    const top = -PANEL_HEIGHT / 2;
    const populationCenterX = left + (LEFT_SECTION_WIDTH / 2);
    const dividerX = left + LEFT_SECTION_WIDTH;
    const contentLeft = dividerX + CONTENT_LEFT_PADDING;
    const slotCenterX = left + panelWidth - CONTENT_RIGHT_PADDING - RIGHT_SLOT_RADIUS;
    const nameBaselineY = -5;
    const healthBarY = 6;
    const healthBarWidth = slotCenterX - RIGHT_SLOT_RADIUS - CONTENT_GAP - contentLeft;

    this.drawChrome(
      view.chrome,
      city,
      nation.color,
      left,
      top,
      panelWidth,
      populationCenterX,
      dividerX,
      contentLeft,
      healthBarY,
      healthBarWidth,
      slotCenterX,
    );

    view.nameText.setPosition(contentLeft, nameBaselineY);
    view.populationText.setPosition(populationCenterX, 0);
    this.refreshProductionMask(view, world.x + slotCenterX, world.y + CITY_BANNER_OFFSET_Y);
    this.refreshProductionSlot(view, production, slotCenterX);
  }

  rebuildAll(): void {
    const seen = new Set<string>();

    for (const city of this.cityManager.getAllCities()) {
      seen.add(city.id);
      this.refreshCity(city);
    }

    for (const cityId of this.banners.keys()) {
      if (seen.has(cityId)) continue;
      this.removeBanner(cityId);
    }
  }

  removeBanner(cityId: string): void {
    const view = this.banners.get(cityId);
    if (!view) return;
    view.productionImage.clearMask(false);
    view.container.destroy(true);
    view.productionMask.destroy();
    this.banners.delete(cityId);
  }

  shutdown(): void {
    for (const view of this.banners.values()) {
      view.productionImage.clearMask(false);
      view.container.destroy(true);
      view.productionMask.destroy();
    }
    this.banners.clear();
  }

  private createBanner(cityId: string): CityBannerView {
    const container = this.scene.add.container(0, 0);
    container.setDepth(CITY_BANNER_DEPTH);

    const chrome = this.scene.add.graphics();
    const nameText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: `${NAME_FONT_SIZE}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#160d20',
      strokeThickness: 3,
    }).setOrigin(0, 0.5);

    const populationText = this.scene.add.text(0, 0, '1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${POPULATION_FONT_SIZE}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1b1026',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0.5);

    const productionImage = this.scene.add.image(0, 0, 'unit_warrior')
      .setVisible(false);
    const productionMask = this.scene.add.graphics();
    productionMask.setVisible(false);
    productionImage.setMask(productionMask.createGeometryMask());

    const productionFallbackText = this.scene.add.text(0, 0, '-', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#121212',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0.5);

    container.add([
      chrome,
      nameText,
      populationText,
      productionImage,
      productionFallbackText,
    ]);

    const view: CityBannerView = {
      container,
      chrome,
      nameText,
      populationText,
      productionImage,
      productionMask,
      productionFallbackText,
    };
    this.banners.set(cityId, view);
    return view;
  }

  private drawChrome(
    graphics: Phaser.GameObjects.Graphics,
    city: City,
    nationColor: number,
    left: number,
    top: number,
    panelWidth: number,
    populationCenterX: number,
    dividerX: number,
    healthBarX: number,
    healthBarY: number,
    healthBarWidth: number,
    slotCenterX: number,
  ): void {
    const hpRatio = Phaser.Math.Clamp(city.health / CITY_BASE_HEALTH, 0, 1);
    const hpColor = getHealthColor(hpRatio);
    const segmentWidth = (healthBarWidth - (HEALTH_SEGMENT_GAP * (HEALTH_SEGMENT_COUNT - 1))) / HEALTH_SEGMENT_COUNT;

    graphics.clear();

    graphics.fillStyle(PANEL_SHADOW_COLOR, 0.3);
    graphics.fillRoundedRect(left, top + 2, panelWidth, PANEL_HEIGHT, PANEL_RADIUS);

    graphics.fillStyle(nationColor, 0.96);
    graphics.fillRoundedRect(left, top, panelWidth, PANEL_HEIGHT, PANEL_RADIUS);

    graphics.fillStyle(darkenColor(nationColor, 0.55), 0.98);
    graphics.fillCircle(populationCenterX, 0, (PANEL_HEIGHT / 2) - 2);

    graphics.lineStyle(2, PANEL_BORDER_COLOR, 1);
    graphics.strokeRoundedRect(left, top, panelWidth, PANEL_HEIGHT, PANEL_RADIUS);

    graphics.lineStyle(2, DIVIDER_COLOR, 0.5);
    graphics.beginPath();
    graphics.moveTo(dividerX, -DIVIDER_HEIGHT / 2);
    graphics.lineTo(dividerX, DIVIDER_HEIGHT / 2);
    graphics.strokePath();

    graphics.fillStyle(HEALTH_TRACK_COLOR, 0.98);
    graphics.fillRoundedRect(
      healthBarX - 4,
      healthBarY - 2,
      healthBarWidth + 8,
      HEALTH_BAR_HEIGHT + 4,
      4,
    );

    for (let index = 0; index < HEALTH_SEGMENT_COUNT; index += 1) {
      const segmentX = healthBarX + (index * (segmentWidth + HEALTH_SEGMENT_GAP));
      const fillRatio = Phaser.Math.Clamp((hpRatio * HEALTH_SEGMENT_COUNT) - index, 0, 1);

      graphics.fillStyle(HEALTH_EMPTY_COLOR, 1);
      graphics.fillRoundedRect(segmentX, healthBarY, segmentWidth, HEALTH_BAR_HEIGHT, 2);

      if (fillRatio <= 0) continue;
      graphics.fillStyle(hpColor, 1);
      graphics.fillRoundedRect(segmentX, healthBarY, segmentWidth * fillRatio, HEALTH_BAR_HEIGHT, 2);
    }

    graphics.fillStyle(SLOT_BACKGROUND_COLOR, 1);
    graphics.fillCircle(slotCenterX, 0, RIGHT_SLOT_RADIUS);
    graphics.lineStyle(2, SLOT_BORDER_COLOR, 1);
    graphics.strokeCircle(slotCenterX, 0, RIGHT_SLOT_RADIUS);

    if (city.isCapital) {
      graphics.fillStyle(PANEL_BORDER_COLOR, 0.9);
      graphics.fillCircle(slotCenterX - RIGHT_SLOT_RADIUS + 5, -RIGHT_SLOT_RADIUS + 5, 2);
    }
  }

  private refreshProductionSlot(
    view: CityBannerView,
    production: Producible | undefined,
    slotCenterX: number,
  ): void {
    const { textureKey, fallbackLabel } = this.getProductionPresentation(production);

    view.productionImage.setPosition(slotCenterX, 0);
    view.productionFallbackText.setPosition(slotCenterX, 0);

    if (textureKey && this.scene.textures.exists(textureKey)) {
      view.productionImage.setTexture(textureKey);
      const frame = this.scene.textures.getFrame(textureKey);
      if (frame) {
        const maxSize = RIGHT_SLOT_SIZE - (PRODUCTION_ICON_INSET * 2);
        const scale = Math.min(
          maxSize / frame.width,
          maxSize / frame.height,
        );
        view.productionImage.setDisplaySize(frame.width * scale, frame.height * scale);
      }
      view.productionImage.setVisible(true);
      view.productionFallbackText.setVisible(false);
      return;
    }

    view.productionImage.setVisible(false);
    view.productionFallbackText.setText(fallbackLabel);
    view.productionFallbackText.setVisible(true);
  }

  private refreshProductionMask(view: CityBannerView, x: number, y: number): void {
    view.productionMask.clear();
    view.productionMask.setPosition(x, y);
    view.productionMask.fillStyle(0xffffff, 1);
    view.productionMask.fillCircle(0, 0, RIGHT_SLOT_RADIUS - PRODUCTION_ICON_INSET);
  }

  private getProductionPresentation(production: Producible | undefined): {
    textureKey?: string;
    fallbackLabel: string;
  } {
    if (!production) {
      return { fallbackLabel: '-' };
    }

    if (production.kind === 'unit') {
      const textureKey = this.ensureProductionTexture(
        'unit',
        production.unitType.id,
        getUnitSpritePath(production.unitType.id),
      );
      return {
        textureKey,
        fallbackLabel: getAbbreviation(production.unitType.name),
      };
    }

    if (production.kind === 'wonder') {
      const textureKey = this.ensureProductionTexture(
        'wonder',
        production.wonderType.id,
        getWonderSpritePath(production.wonderType.id),
      );
      return {
        textureKey,
        fallbackLabel: getAbbreviation(production.wonderType.name),
      };
    }

    if (production.kind === 'corporation') {
      const textureKey = this.ensureProductionTexture(
        'corporation',
        production.corporationType.id,
        getCorporationSpritePath(production.corporationType.id),
      );
      return {
        textureKey,
        fallbackLabel: getAbbreviation(production.corporationType.name),
      };
    }

    const textureKey = this.ensureProductionTexture(
      'building',
      production.buildingType.id,
      getBuildingSpritePath(production.buildingType.id),
    );
    return {
      textureKey,
      fallbackLabel: getAbbreviation(production.buildingType.name),
    };
  }

  private getVisibleProduction(cityId: string): Producible | undefined {
    const production = this.productionSystem.getProduction(cityId)?.item;
    if (
      production?.kind === 'wonder' &&
      this.wonderSystem?.isWonderBuilt(production.wonderType.id) === true
    ) {
      return undefined;
    }
    return production;
  }

  private ensureProductionTexture(kind: Producible['kind'], id: string, path: string): string | undefined {
    const textureKey = `city_banner_${kind}_${id}`;
    if (this.scene.textures.exists(textureKey)) return textureKey;
    if (this.loadingTextures.has(textureKey) || this.missingTextures.has(textureKey)) return undefined;

    const onLoadError = (file: Phaser.Loader.File): void => {
      if (file.key !== textureKey) return;
      this.loadingTextures.delete(textureKey);
      this.missingTextures.add(textureKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    };

    this.loadingTextures.add(textureKey);
    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingTextures.delete(textureKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.rebuildAll();
    });
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.scene.load.image(textureKey, path);
    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
    return undefined;
  }

}

function fitTextToWidth(
  text: Phaser.GameObjects.Text,
  value: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
): void {
  text.setFontSize(maxFontSize);
  text.setText(value);

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    text.setFontSize(fontSize);
    text.setText(value);
    if (text.width <= maxWidth || fontSize === minFontSize) {
      return;
    }
  }
}

function getHealthColor(hpRatio: number): number {
  if (hpRatio > 0.66) return 0x5cae0d;
  if (hpRatio > 0.33) return 0xc1a125;
  return 0xc4514a;
}

function darkenColor(color: number, factor: number): number {
  const red = Math.max(0, Math.floor(((color >> 16) & 0xff) * factor));
  const green = Math.max(0, Math.floor(((color >> 8) & 0xff) * factor));
  const blue = Math.max(0, Math.floor((color & 0xff) * factor));
  return (red << 16) | (green << 8) | blue;
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function getAbbreviation(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
