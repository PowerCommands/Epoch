import type { City } from '../entities/City';
import type { CityViewTileBreakdown } from '../systems/CityViewData';

type CloseCallback = () => void;
type PlacementRequestCallback = (buildingId: string) => void;
type PlacementCancelCallback = () => void;

export interface CityViewBuildingOption {
  id: string;
  name: string;
  placement: 'land' | 'water';
  disabled?: boolean;
  reason?: string;
}

export interface CityViewPlacementPanelState {
  active: boolean;
  buildingId?: string;
  buildingName?: string;
  underConstructionLabel?: string;
}

export class CityView {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly statsEl: HTMLDivElement;
  private readonly nextTileEl: HTMLDivElement;
  private readonly placementStatusEl: HTMLDivElement;
  private readonly placementButtonsEl: HTMLDivElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly closeCallbacks: CloseCallback[] = [];
  private readonly placementRequestCallbacks: PlacementRequestCallback[] = [];
  private readonly placementCancelCallbacks: PlacementCancelCallback[] = [];
  private currentCityId: string | null = null;
  private open = false;

  constructor() {
    const mount = document.getElementById('app-layout');
    if (!mount) throw new Error('Missing #app-layout');

    this.root = document.createElement('div');
    this.root.className = 'city-view-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'city-view-panel';

    const header = document.createElement('div');
    header.className = 'city-view-header';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'city-view-title';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'city-view-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      for (const callback of this.closeCallbacks) callback();
    });

    header.append(this.titleEl, closeButton);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'city-view-stats';

    this.nextTileEl = document.createElement('div');
    this.nextTileEl.className = 'city-view-next';

    const placementSection = document.createElement('div');
    placementSection.className = 'city-view-placement';

    this.placementStatusEl = document.createElement('div');
    this.placementStatusEl.className = 'city-view-placement-status';

    this.placementButtonsEl = document.createElement('div');
    this.placementButtonsEl.className = 'city-view-placement-buttons';

    placementSection.append(this.placementStatusEl, this.placementButtonsEl);

    const hint = document.createElement('div');
    hint.className = 'city-view-hint';
    hint.textContent = 'Drag the planned expansion tile to retarget culture growth, or choose a building below to place it on a cyan tile.';

    panel.append(header, this.statsEl, this.nextTileEl, placementSection, hint);
    this.root.append(panel);
    mount.append(this.root);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'city-view-tooltip';
    this.tooltipEl.style.cssText = `
      position: fixed;
      z-index: 1300;
      display: none;
      min-width: 220px;
      max-width: 300px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      background: rgba(10, 12, 16, 0.96);
      color: #eef3fb;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
      font-family: monospace;
      font-size: 12px;
      line-height: 1.45;
      pointer-events: none;
      white-space: normal;
    `;
    document.body.append(this.tooltipEl);
  }

  onCloseRequested(callback: CloseCallback): void {
    this.closeCallbacks.push(callback);
  }

  onPlacementRequested(callback: PlacementRequestCallback): void {
    this.placementRequestCallbacks.push(callback);
  }

  onPlacementCancelled(callback: PlacementCancelCallback): void {
    this.placementCancelCallbacks.push(callback);
  }

  isOpenForCity(cityId: string): boolean {
    return this.open && this.currentCityId === cityId;
  }

  show(
    city: City,
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
  ): void {
    this.currentCityId = city.id;
    this.open = true;
    this.root.style.display = 'block';
    this.render(city, buildingOptions, placementState);
  }

  refresh(
    city: City,
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
  ): void {
    if (!this.isOpenForCity(city.id)) return;
    this.render(city, buildingOptions, placementState);
  }

  close(): void {
    this.open = false;
    this.currentCityId = null;
    this.root.style.display = 'none';
    this.hideTooltip();
  }

  shutdown(): void {
    this.root.remove();
    this.tooltipEl.remove();
  }

  showTooltip(
    breakdown: CityViewTileBreakdown,
    screenX: number,
    screenY: number,
  ): void {
    const rows = [
      `<div><strong>Tile</strong> (${breakdown.coord.x}, ${breakdown.coord.y})</div>`,
      `<div><strong>Terrain</strong> ${breakdown.terrainType}</div>`,
      `<div><strong>Improvement</strong> ${breakdown.improvementName ?? 'None'}</div>`,
      `<div><strong>Building</strong> ${breakdown.buildingName ?? 'None'}</div>`,
      `<div><strong>Construction</strong> ${breakdown.buildingConstructionName ?? 'None'}</div>`,
      `<div><strong>Status</strong> ${breakdown.notes.length > 0 ? breakdown.notes.join(', ') : 'None'}</div>`,
      '<div style="margin-top:6px;"><strong>Yields</strong></div>',
      `<div>Food: ${breakdown.yields.food}</div>`,
      `<div>Production: ${breakdown.yields.production}</div>`,
      `<div>Gold: ${breakdown.yields.gold}</div>`,
      `<div>Science: ${breakdown.yields.science}</div>`,
      `<div>Culture: ${breakdown.yields.culture}</div>`,
      `<div>Happiness: ${breakdown.yields.happiness}</div>`,
    ];
    this.tooltipEl.innerHTML = rows.join('');
    this.tooltipEl.style.display = 'block';

    const width = this.tooltipEl.offsetWidth || 240;
    const height = this.tooltipEl.offsetHeight || 180;
    const left = Math.min(window.innerWidth - width - 12, screenX + 16);
    const top = Math.min(window.innerHeight - height - 12, screenY + 16);
    this.tooltipEl.style.left = `${Math.max(12, left)}px`;
    this.tooltipEl.style.top = `${Math.max(12, top)}px`;
  }

  hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  private render(
    city: City,
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
  ): void {
    this.titleEl.textContent = city.name;

    const statRows = [
      `Population: ${city.population}`,
      `Culture: ${city.culture}`,
      `Owned tiles: ${city.ownedTileCoords.length}`,
      `Worked tiles: ${city.workedTileCoords.length}`,
    ];

    this.statsEl.replaceChildren(...statRows.map((text) => {
      const row = document.createElement('div');
      row.className = 'city-view-stat';
      row.textContent = text;
      return row;
    }));

    this.nextTileEl.textContent = city.nextExpansionTileCoord
      ? `Planned next expansion: (${city.nextExpansionTileCoord.x}, ${city.nextExpansionTileCoord.y})`
      : 'Planned next expansion: none';

    this.renderPlacementOptions(buildingOptions, placementState);
  }

  private renderPlacementOptions(
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
  ): void {
    this.placementButtonsEl.replaceChildren();

    const statusRow = document.createElement('div');
    statusRow.className = 'city-view-placement-status-row';

    const statusText = document.createElement('div');
    statusText.textContent = placementState.active && placementState.buildingName
      ? `Placing ${placementState.buildingName}: click a cyan tile`
      : placementState.underConstructionLabel
        ? `Under construction: ${placementState.underConstructionLabel}`
        : 'Building placement: choose a building to highlight valid tiles';
    statusRow.append(statusText);

    if (placementState.active) {
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'city-view-placement-cancel';
      cancelButton.textContent = 'Cancel';
      cancelButton.addEventListener('click', () => {
        for (const callback of this.placementCancelCallbacks) callback();
      });
      statusRow.append(cancelButton);
    }

    this.placementStatusEl.replaceChildren(statusRow);

    if (buildingOptions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'city-view-placement-empty';
      empty.textContent = 'No building placements available for this city.';
      this.placementButtonsEl.append(empty);
      return;
    }

    for (const option of buildingOptions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-view-placement-button';
      if (placementState.active && placementState.buildingId === option.id) {
        button.classList.add('city-view-placement-button-active');
      }
      button.disabled = option.disabled ?? false;
      button.textContent = `${option.name} (${option.placement})`;
      if (option.reason) button.title = option.reason;
      button.addEventListener('click', () => {
        for (const callback of this.placementRequestCallbacks) callback(option.id);
      });
      this.placementButtonsEl.append(button);
    }
  }
}
