import type { City } from '../entities/City';
import type { CityViewTileBreakdown } from '../systems/CityViewData';
import { getBuildingSpritePath, getUnitSpritePath, getWonderSpritePath } from '../utils/assetPaths';

type CloseCallback = () => void;
type PlacementRequestCallback = (buildingId: string) => void;
type PlacementCancelCallback = () => void;
type BuyTileRequestCallback = () => void;
type RenameRequestCallback = (cityId: string, name: string) => void;
type UnitRequestCallback = (unitId: string) => void;
type WonderRequestCallback = (wonderId: string) => void;
type QueueRemoveRequestCallback = (index: number) => void;
type QueueBuyRequestCallback = (index: number) => void;
type CityViewMode = 'production' | 'queue';
type ProductionAccordionId = 'units' | 'buildings' | 'wonders';

export interface CityViewBuildingOption {
  id: string;
  name: string;
  cost: number;
  placement: 'land' | 'water';
  disabled?: boolean;
  reason?: string;
}

export interface CityViewUnitOption {
  id: string;
  name: string;
  cost: number;
  disabled?: boolean;
  reason?: string;
}

export interface CityViewWonderOption {
  id: string;
  name: string;
  cost: number;
  description: string;
  disabled?: boolean;
  reason?: string;
}

export interface CityViewPlacementPanelState {
  active: boolean;
  mode?: 'building' | 'wonder';
  buildingId?: string;
  buildingName?: string;
  wonderId?: string;
  wonderName?: string;
  underConstructionLabel?: string;
}

export interface CityViewTilePurchaseState {
  visible: boolean;
  enabled: boolean;
  buttonLabel: string;
  detailText?: string;
}

export interface CityViewQueueItem {
  index: number;
  name: string;
  spritePath?: string;
  progress: number;
  cost: number;
  turnsRemaining: number;
  blockedReason?: string;
  active: boolean;
  buyCost?: number;
  buyLabel?: string;
  canBuy?: boolean;
}

export class CityView {
  private readonly root: HTMLDivElement;
  private readonly headerEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly titleInputEl: HTMLInputElement;
  private readonly renameButton: HTMLButtonElement;
  private readonly statsEl: HTMLDivElement;
  private readonly nextTileEl: HTMLDivElement;
  private readonly modeButtonsEl: HTMLDivElement;
  private readonly productionModeButton: HTMLButtonElement;
  private readonly queueModeButton: HTMLButtonElement;
  private readonly modeContentEl: HTMLDivElement;
  private readonly placementStatusEl: HTMLDivElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly closeCallbacks: CloseCallback[] = [];
  private readonly placementRequestCallbacks: PlacementRequestCallback[] = [];
  private readonly placementCancelCallbacks: PlacementCancelCallback[] = [];
  private readonly buyTileRequestCallbacks: BuyTileRequestCallback[] = [];
  private readonly renameRequestCallbacks: RenameRequestCallback[] = [];
  private readonly unitRequestCallbacks: UnitRequestCallback[] = [];
  private readonly wonderRequestCallbacks: WonderRequestCallback[] = [];
  private readonly queueRemoveRequestCallbacks: QueueRemoveRequestCallback[] = [];
  private readonly queueBuyRequestCallbacks: QueueBuyRequestCallback[] = [];
  private currentCityId: string | null = null;
  private mode: CityViewMode = 'production';
  private readonly accordionExpanded: Record<ProductionAccordionId, boolean> = {
    units: true,
    buildings: false,
    wonders: false,
  };
  private open = false;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private editingTitleCityId: string | null = null;
  private lastRenderState: {
    city: City;
    unitOptions: CityViewUnitOption[];
    buildingOptions: CityViewBuildingOption[];
    placementState: CityViewPlacementPanelState;
    tilePurchaseState: CityViewTilePurchaseState;
    wonderOptions: CityViewWonderOption[];
    queueItems: CityViewQueueItem[];
  } | null = null;

  constructor() {
    const mount = document.getElementById('app-layout');
    if (!mount) throw new Error('Missing #app-layout');

    this.root = document.createElement('div');
    this.root.className = 'city-view-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'city-view-panel';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'city-view-header';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'city-view-title';

    this.titleInputEl = document.createElement('input');
    this.titleInputEl.type = 'text';
    this.titleInputEl.maxLength = 40;
    this.titleInputEl.spellcheck = false;
    this.titleInputEl.style.cssText = `
      display: none;
      min-width: 220px;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(8, 12, 18, 0.92);
      color: #eef3fb;
      font: inherit;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      outline: none;
    `;
    this.titleInputEl.addEventListener('keydown', this.handleTitleInputKeyDown);
    this.titleInputEl.addEventListener('blur', this.handleTitleInputBlur);

    this.renameButton = document.createElement('button');
    this.renameButton.type = 'button';
    this.renameButton.textContent = '✎';
    this.renameButton.title = 'Rename city';
    this.renameButton.setAttribute('aria-label', 'Rename city');
    this.renameButton.style.cssText = `
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.06);
      color: #eef3fb;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    `;
    this.renameButton.addEventListener('click', this.handleRenameButtonClick);

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex; align-items:center; gap:10px; min-width:0; flex:1 1 auto;';
    titleRow.append(this.titleEl, this.titleInputEl, this.renameButton);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'city-view-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      for (const callback of this.closeCallbacks) callback();
    });

    this.headerEl.append(titleRow, closeButton);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'city-view-stats';

    this.nextTileEl = document.createElement('div');
    this.nextTileEl.className = 'city-view-next';

    this.placementStatusEl = document.createElement('div');
    this.placementStatusEl.className = 'city-view-placement city-view-current-production';

    this.modeButtonsEl = document.createElement('div');
    this.modeButtonsEl.className = 'city-view-mode-buttons';

    this.productionModeButton = this.createModeButton('production', 'Production');
    this.queueModeButton = this.createModeButton('queue', 'Queue');
    this.modeButtonsEl.append(this.productionModeButton, this.queueModeButton);

    this.modeContentEl = document.createElement('div');
    this.modeContentEl.className = 'city-view-mode-content';

    const hint = document.createElement('div');
    hint.className = 'city-view-hint';
    hint.textContent = 'Drag the planned expansion tile to retarget culture growth, or choose a building below to place it on a cyan tile.';

    panel.append(this.headerEl, this.statsEl, this.nextTileEl, this.placementStatusEl, this.modeButtonsEl, this.modeContentEl, hint);
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

    this.headerEl.addEventListener('mousedown', this.handleHeaderMouseDown);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
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

  onBuyTileRequested(callback: BuyTileRequestCallback): void {
    this.buyTileRequestCallbacks.push(callback);
  }

  onRenameRequested(callback: RenameRequestCallback): void {
    this.renameRequestCallbacks.push(callback);
  }

  onUnitRequested(callback: UnitRequestCallback): void {
    this.unitRequestCallbacks.push(callback);
  }

  onWonderRequested(callback: WonderRequestCallback): void {
    this.wonderRequestCallbacks.push(callback);
  }

  onQueueRemoveRequested(callback: QueueRemoveRequestCallback): void {
    this.queueRemoveRequestCallbacks.push(callback);
  }

  onQueueBuyRequested(callback: QueueBuyRequestCallback): void {
    this.queueBuyRequestCallbacks.push(callback);
  }

  isOpenForCity(cityId: string): boolean {
    return this.open && this.currentCityId === cityId;
  }

  getOpenCityId(): string | null {
    return this.open ? this.currentCityId : null;
  }

  show(
    city: City,
    unitOptions: CityViewUnitOption[],
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
    tilePurchaseState: CityViewTilePurchaseState,
    wonderOptions: CityViewWonderOption[],
    queueItems: CityViewQueueItem[],
  ): void {
    if (this.currentCityId !== city.id) this.resetViewState();
    this.currentCityId = city.id;
    this.open = true;
    this.root.style.display = 'block';
    this.render(city, unitOptions, buildingOptions, placementState, tilePurchaseState, wonderOptions, queueItems);
  }

  refresh(
    city: City,
    unitOptions: CityViewUnitOption[],
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
    tilePurchaseState: CityViewTilePurchaseState,
    wonderOptions: CityViewWonderOption[],
    queueItems: CityViewQueueItem[],
  ): void {
    if (!this.isOpenForCity(city.id)) return;
    this.render(city, unitOptions, buildingOptions, placementState, tilePurchaseState, wonderOptions, queueItems);
  }

  close(): void {
    this.open = false;
    this.currentCityId = null;
    this.lastRenderState = null;
    this.stopTitleEditing(false);
    this.root.style.display = 'none';
    this.dragging = false;
    this.hideTooltip();
  }

  shutdown(): void {
    this.headerEl.removeEventListener('mousedown', this.handleHeaderMouseDown);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    this.titleInputEl.removeEventListener('keydown', this.handleTitleInputKeyDown);
    this.titleInputEl.removeEventListener('blur', this.handleTitleInputBlur);
    this.renameButton.removeEventListener('click', this.handleRenameButtonClick);
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
      `<div><strong>Resource</strong> ${breakdown.resourceName ?? 'None'}</div>`,
      `<div><strong>Improvement</strong> ${breakdown.improvementName ?? 'None'}</div>`,
      `<div><strong>Improvement Work</strong> ${formatImprovementConstruction(breakdown)}</div>`,
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
    if (breakdown.resourceYieldBonus) {
      rows.splice(6, 0, `<div><strong>Resource bonus</strong> ${formatResourceYieldBonus(breakdown.resourceYieldBonus)}</div>`);
    }
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

  private readonly handleHeaderMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input')) return;

    const rect = this.root.getBoundingClientRect();
    this.dragging = true;
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    event.preventDefault();
  };

  private readonly handleDocumentMouseMove = (event: MouseEvent): void => {
    if (!this.dragging || !this.open) return;

    const left = clamp(event.clientX - this.dragOffsetX, 0, Math.max(0, window.innerWidth - this.root.offsetWidth));
    const top = clamp(event.clientY - this.dragOffsetY, 0, Math.max(0, window.innerHeight - this.root.offsetHeight));
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
  };

  private readonly handleDocumentMouseUp = (): void => {
    this.dragging = false;
  };

  private readonly handleRenameButtonClick = (): void => {
    if (!this.currentCityId) return;
    this.startTitleEditing();
  };

  private readonly handleTitleInputKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitTitleEdit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stopTitleEditing(false);
    }
  };

  private readonly handleTitleInputBlur = (): void => {
    if (!this.editingTitleCityId) return;
    this.stopTitleEditing(false);
  };

  private render(
    city: City,
    unitOptions: CityViewUnitOption[],
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
    tilePurchaseState: CityViewTilePurchaseState,
    wonderOptions: CityViewWonderOption[],
    queueItems: CityViewQueueItem[],
  ): void {
    this.lastRenderState = {
      city,
      unitOptions,
      buildingOptions,
      placementState,
      tilePurchaseState,
      wonderOptions,
      queueItems,
    };
    const isEditingCurrentCity = this.editingTitleCityId === city.id;
    if (!isEditingCurrentCity) {
      this.titleEl.textContent = city.name;
      this.titleInputEl.value = city.name;
    }
    this.syncTitleEditingState(isEditingCurrentCity);

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

    this.renderTilePurchase(tilePurchaseState);

    this.renderPlacementStatus(placementState);
    this.syncModeButtons();
    if (this.mode === 'queue') {
      this.renderQueueMode(queueItems);
    } else {
      this.renderProductionMode(unitOptions, buildingOptions, placementState, wonderOptions);
    }
  }

  private renderProductionMode(
    unitOptions: CityViewUnitOption[],
    buildingOptions: CityViewBuildingOption[],
    placementState: CityViewPlacementPanelState,
    wonderOptions: CityViewWonderOption[],
  ): void {
    const units = this.renderProductionAccordion('units', 'Units', unitOptions, (grid, option) => {
      const button = this.createProductionButton(
        getUnitSpritePath(option.id),
        option.reason
          ? `${option.name} (${option.cost}) - ${option.reason}`
          : `${option.name} (${option.cost})`,
      );
      button.disabled = option.disabled ?? false;
      if (option.reason) button.title = option.reason;
      button.addEventListener('click', () => {
        if (button.disabled) return;
        for (const callback of this.unitRequestCallbacks) callback(option.id);
      });
      grid.append(button);
    }, 'No units available.');

    const buildings = this.renderProductionAccordion('buildings', 'Buildings', buildingOptions, (grid, option) => {
      const button = this.createProductionButton(
        getBuildingSpritePath(option.id),
        option.reason
          ? `${option.name} (${option.cost}) - ${option.reason}`
          : `${option.name} (${option.cost}) - ${option.placement}`,
      );
      if (placementState.active && placementState.buildingId === option.id) {
        button.classList.add('city-view-placement-button-active');
      }
      button.disabled = option.disabled ?? false;
      if (option.reason) button.title = option.reason;
      button.addEventListener('click', () => {
        if (button.disabled) return;
        for (const callback of this.placementRequestCallbacks) callback(option.id);
      });
      grid.append(button);
    }, 'No building placements available for this city.');

    const wonders = this.renderProductionAccordion('wonders', 'Wonders', wonderOptions, (grid, option) => {
      const suffix = option.reason ? ` — ${option.reason}` : '';
      const button = this.createProductionButton(
        getWonderSpritePath(option.id),
        `${option.name} (${option.cost})${suffix}`,
      );
      button.disabled = option.disabled ?? false;
      button.title = option.description;
      button.addEventListener('click', () => {
        if (button.disabled) return;
        for (const callback of this.wonderRequestCallbacks) callback(option.id);
      });
      grid.append(button);
    }, 'No wonders available — research a prerequisite tech.');

    this.modeContentEl.replaceChildren(units, buildings, wonders);
  }

  private renderTilePurchase(tilePurchaseState: CityViewTilePurchaseState): void {
    this.nextTileEl.replaceChildren();
    this.nextTileEl.style.display = tilePurchaseState.visible ? 'block' : 'none';
    if (!tilePurchaseState.visible) return;

    const row = document.createElement('div');
    row.className = 'city-view-placement-status-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-view-placement-button';
    button.textContent = tilePurchaseState.buttonLabel;
    button.disabled = !tilePurchaseState.enabled;
    button.addEventListener('click', () => {
      for (const callback of this.buyTileRequestCallbacks) callback();
    });
    row.append(button);

    this.nextTileEl.append(row);

    if (tilePurchaseState.detailText) {
      const detail = document.createElement('div');
      detail.className = tilePurchaseState.enabled ? 'city-view-hint' : 'city-view-placement-empty';
      detail.textContent = tilePurchaseState.detailText;
      detail.style.marginTop = '10px';
      this.nextTileEl.append(detail);
    }
  }

  private renderPlacementStatus(placementState: CityViewPlacementPanelState): void {
    const statusRow = document.createElement('div');
    statusRow.className = 'city-view-placement-status-row';

    const statusText = document.createElement('div');
    statusText.textContent = placementState.active && placementState.mode === 'wonder' && placementState.wonderName
      ? `Placing ${placementState.wonderName}: click a cyan tile`
      : placementState.active && placementState.buildingName
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
  }

  private renderQueueMode(queueItems: CityViewQueueItem[]): void {
    const section = document.createElement('div');
    section.className = 'city-view-placement city-view-queue-section';

    const title = document.createElement('div');
    title.className = 'city-view-placement-status';
    title.textContent = 'Production Queue';
    section.append(title);

    if (queueItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'city-view-placement-empty';
      empty.textContent = 'No production queued.';
      section.append(empty);
      this.modeContentEl.replaceChildren(section);
      return;
    }

    for (const item of queueItems) {
      section.append(this.createQueueItem(item));
    }

    this.modeContentEl.replaceChildren(section);
  }

  private renderProductionAccordion<T>(
    id: ProductionAccordionId,
    title: string,
    options: T[],
    renderOption: (grid: HTMLDivElement, option: T) => void,
    emptyText: string,
  ): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'city-view-placement city-view-accordion';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'city-view-accordion-header';
    header.setAttribute('aria-expanded', String(this.accordionExpanded[id]));
    header.textContent = `${this.accordionExpanded[id] ? '▾' : '▸'} ${title}`;
    section.append(header);

    const grid = document.createElement('div');
    grid.className = 'city-view-placement-buttons city-view-production-grid';
    if (options.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'city-view-placement-empty';
      empty.textContent = emptyText;
      grid.append(empty);
    } else {
      for (const option of options) renderOption(grid, option);
    }
    section.append(grid);

    const syncExpanded = (): void => {
      header.textContent = `${this.accordionExpanded[id] ? '▾' : '▸'} ${title}`;
      header.setAttribute('aria-expanded', String(this.accordionExpanded[id]));
      grid.style.display = this.accordionExpanded[id] ? '' : 'none';
    };
    header.addEventListener('click', () => {
      this.accordionExpanded[id] = !this.accordionExpanded[id];
      syncExpanded();
    });
    syncExpanded();

    return section;
  }

  private createQueueItem(item: CityViewQueueItem): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'city-view-queue-item';

    const icon = document.createElement('img');
    icon.className = 'city-view-production-icon';
    icon.alt = '';
    icon.decoding = 'async';
    if (item.spritePath) {
      icon.src = item.spritePath;
      icon.addEventListener('error', () => { icon.style.display = 'none'; });
    } else {
      icon.style.display = 'none';
    }

    const body = document.createElement('div');
    body.className = 'city-view-queue-body';

    const title = document.createElement('div');
    title.className = 'city-view-queue-title';
    title.textContent = `${item.index + 1}. ${item.name}${item.active ? ' [active]' : ''}`;

    const turns = item.blockedReason
      ? 'blocked'
      : `${item.turnsRemaining} turn${item.turnsRemaining !== 1 ? 's' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'city-view-queue-meta';
    meta.textContent = `${item.progress}/${item.cost} production • ${turns}`;

    const progress = document.createElement('div');
    progress.className = 'city-view-queue-progress';
    const fill = document.createElement('div');
    fill.style.width = `${Math.max(0, Math.min(100, Math.floor((item.progress / Math.max(1, item.cost)) * 100)))}%`;
    progress.append(fill);

    body.append(title, meta, progress);
    if (item.blockedReason) {
      const reason = document.createElement('div');
      reason.className = 'city-view-placement-empty';
      reason.textContent = item.blockedReason;
      body.append(reason);
    }

    const actions = document.createElement('div');
    actions.className = 'city-view-queue-actions';

    if (item.buyCost !== undefined) {
      const buyButton = document.createElement('button');
      buyButton.type = 'button';
      buyButton.className = 'city-view-placement-button';
      buyButton.textContent = item.buyLabel ?? (item.canBuy ? `Buy ${item.buyCost}` : `Need ${item.buyCost}`);
      buyButton.disabled = !item.canBuy;
      buyButton.addEventListener('click', () => {
        if (buyButton.disabled) return;
        for (const callback of this.queueBuyRequestCallbacks) callback(item.index);
      });
      actions.append(buyButton);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'city-view-placement-button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      for (const callback of this.queueRemoveRequestCallbacks) callback(item.index);
    });
    actions.append(removeButton);

    row.append(icon, body, actions);
    return row;
  }

  private createModeButton(mode: CityViewMode, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-view-placement-button city-view-mode-button';
    button.textContent = label;
    button.addEventListener('click', () => {
      this.mode = mode;
      this.syncModeButtons();
      this.renderLastState();
    });
    return button;
  }

  private syncModeButtons(): void {
    this.productionModeButton.classList.toggle('city-view-placement-button-active', this.mode === 'production');
    this.queueModeButton.classList.toggle('city-view-placement-button-active', this.mode === 'queue');
  }

  private resetViewState(): void {
    this.mode = 'production';
    this.accordionExpanded.units = true;
    this.accordionExpanded.buildings = false;
    this.accordionExpanded.wonders = false;
  }

  private renderLastState(): void {
    if (!this.lastRenderState) return;
    this.render(
      this.lastRenderState.city,
      this.lastRenderState.unitOptions,
      this.lastRenderState.buildingOptions,
      this.lastRenderState.placementState,
      this.lastRenderState.tilePurchaseState,
      this.lastRenderState.wonderOptions,
      this.lastRenderState.queueItems,
    );
  }

  private createProductionButton(spritePath: string, labelText: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-view-placement-button city-view-production-button';

    const icon = document.createElement('img');
    icon.className = 'city-view-production-icon';
    icon.src = spritePath;
    icon.alt = '';
    icon.decoding = 'async';
    icon.addEventListener('error', () => {
      icon.style.display = 'none';
    });

    const label = document.createElement('span');
    label.textContent = labelText;

    button.append(icon, label);
    return button;
  }

  private startTitleEditing(): void {
    if (!this.currentCityId) return;
    this.editingTitleCityId = this.currentCityId;
    this.syncTitleEditingState(true);
    this.titleInputEl.focus();
    this.titleInputEl.select();
  }

  private commitTitleEdit(): void {
    if (!this.editingTitleCityId) return;

    const nextName = this.titleInputEl.value.trim().replace(/\s+/g, ' ');
    if (nextName.length === 0) {
      this.stopTitleEditing(false);
      return;
    }

    const cityId = this.editingTitleCityId;
    this.stopTitleEditing(false);
    for (const callback of this.renameRequestCallbacks) callback(cityId, nextName);
  }

  private stopTitleEditing(keepInputValue: boolean): void {
    if (!keepInputValue) {
      this.titleInputEl.value = this.titleEl.textContent ?? '';
    }
    this.editingTitleCityId = null;
    this.syncTitleEditingState(false);
  }

  private syncTitleEditingState(isEditing: boolean): void {
    this.titleEl.style.display = isEditing ? 'none' : '';
    this.titleInputEl.style.display = isEditing ? 'block' : 'none';
    this.renameButton.style.display = isEditing ? 'none' : 'inline-flex';
  }
}

function formatResourceYieldBonus(yieldBonus: {
  food: number;
  production: number;
  gold: number;
  science: number;
  culture: number;
  happiness: number;
}): string {
  const parts = [
    { label: 'Food', value: yieldBonus.food },
    { label: 'Production', value: yieldBonus.production },
    { label: 'Gold', value: yieldBonus.gold },
    { label: 'Science', value: yieldBonus.science },
    { label: 'Culture', value: yieldBonus.culture },
    { label: 'Happiness', value: yieldBonus.happiness },
  ]
    .filter((part) => part.value !== 0)
    .map((part) => `${part.value > 0 ? '+' : ''}${part.value} ${part.label}`);

  return parts.length > 0 ? parts.join(', ') : '+0';
}

function formatImprovementConstruction(breakdown: CityViewTileBreakdown): string {
  if (!breakdown.improvementConstructionName) return 'None';
  const remaining = breakdown.improvementConstructionRemainingTurns ?? 0;
  return `${breakdown.improvementConstructionName}: ${remaining} turns remaining`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
