import { ALL_BUILDINGS, getBuildingById } from '../../data/buildings';
import { getImprovementById } from '../../data/improvements';
import { getLeaderById, getLeaderByNationId, getLeaderIdeologyByNationId } from '../../data/leaders';
import {
  describeIdeologyCompatibility,
  getIdeologyCompatibility,
} from '../../data/ideologyCompatibility';
import { getNaturalResourceById } from '../../data/naturalResources';
import type { Era } from '../../data/technologies';
import { ALL_UNIT_TYPES } from '../../data/units';
import { ALL_WONDERS } from '../../data/wonders';
import { CITY_BASE_DEFENSE, CITY_BASE_HEALTH } from '../../data/cities';
import { CORPORATIONS } from '../../data/corporations';
import { getManufacturedResourceById } from '../../data/manufacturedResources';
import { getResourceDisplayName } from '../../data/resources';
import type { City } from '../../entities/City';
import type { Nation } from '../../entities/Nation';
import type { Unit } from '../../entities/Unit';
import { calculateCityEconomy } from '../../systems/CityEconomy';
import type { CityManager } from '../../systems/CityManager';
import type { CityTerritorySystem } from '../../systems/CityTerritorySystem';
import type { DiplomacyManager } from '../../systems/DiplomacyManager';
import { MIN_WAR_TURNS_FOR_PEACE } from '../../systems/DiplomacyManager';
import type { AllianceManager } from '../../systems/diplomacy/AllianceManager';
import type { AllianceProposalContext } from '../../types/alliance';
import type { JointWarSystem } from '../../systems/diplomacy/JointWarSystem';
import type { JointWarKind } from '../../types/jointWar';
import type { DiscoverySystem } from '../../systems/DiscoverySystem';
import type { HistoricalTimelineService } from '../../systems/HistoricalTimelineService';
import type { EraSystem } from '../../systems/EraSystem';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import { formatPercent, formatHappinessStateLabel, luxuryResourceLabels } from '../happinessFormat';
import type { IGridSystem } from '../../systems/grid/IGridSystem';
import type { NationManager } from '../../systems/NationManager';
import type { BorderPressureSystem } from '../../systems/BorderPressureSystem';
import type { AIMilitaryEvaluationSystem, MilitaryComparison } from '../../systems/ai/AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from '../../systems/ai/AIMilitaryThreatEvaluationSystem';
import type { DiplomaticEvaluationSystem } from '../../systems/diplomacy/DiplomaticEvaluationSystem';
import type { DiplomaticAttitude } from '../../systems/diplomacy/DiplomaticEvaluationSystem';
import { canCityProduceUnit, getCityUnitProductionBlockReason } from '../../systems/ProductionRules';
import type { ProductionSystem, QueueEntryView } from '../../systems/ProductionSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { BuildImprovementPreview } from '../../systems/BuilderSystem';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { WonderSystem } from '../../systems/WonderSystem';
import type { WorldCouncilSystem } from '../../systems/WorldCouncilSystem';
import type { CorporationSystem } from '../../systems/CorporationSystem';
import type { TradeDealSystem } from '../../systems/TradeDealSystem';
import type { TradeConnectionSystem } from '../../systems/TradeConnectionSystem';
import type { TradeConnection } from '../../types/tradeConnection';
import type { TradeDiplomacySystem } from '../../systems/diplomacy/TradeDiplomacySystem';
import type { ResourceAccessSystem } from '../../systems/ResourceAccessSystem';
import type { ResourceCitySearchResult, ResourceCitySearchSystem } from '../../systems/ResourceCitySearchSystem';
import type { StrategicResourceCapacitySystem } from '../../systems/StrategicResourceCapacitySystem';
import type { UnitUpkeepSystem } from '../../systems/UnitUpkeepSystem';
import { calculateUnitUpkeep } from '../../systems/UnitUpkeepSystem';
import type { TradeDeal } from '../../types/tradeDeal';
import type { Producible } from '../../types/producible';
import type { LeaderDefinition } from '../../types/leader';
import type { MapData, Tile } from '../../types/map';
import { EMPTY_MODIFIERS } from '../../types/modifiers';
import { getCitySpritePath, getCorporationSpritePath, getNaturalResourceSpritePath, getUnitSpritePath, getWonderSpritePath } from '../../utils/assetPaths';
import { getOwnedWonderCount, getRequiredCulturalVictoryWonderCount } from '../../systems/CulturalVictory';
import type {
  LeaderRelationRow,
  RightSidebarContent,
  RightSidebarCityDetailsTab,
  RightSidebarDetailsState,
  RightSidebarDetailsView,
  RightSidebarLeaderDetailsTab,
  RightSidebarLeaderboardCategory,
  RightSidebarRow,
  RightSidebarSection,
  CityPickerItem,
} from './RightSidebarPanelTypes';
import type { DiplomacyGraph, DiplomacyGraphEdge, DiplomacyGraphNode, DiplomacyRelationshipType } from './DiplomacyGraphTypes';
import { RafScheduler } from '../../utils/RafScheduler';

/** One city's entry in a covert intelligence report. */
export interface IntelReportCity {
  name: string;
  population: number;
  production: string | null;
  turnsRemaining: number | null;
}

/** A covert intelligence report on a nation's cities and current production. */
export interface IntelReport {
  nationId: string;
  nationName: string;
  cities: IntelReportCity[];
}

type ChangedListener = () => void;
type BuilderHintProvider = (tile: Tile) => BuildImprovementPreview | null;
type BuildingPlacementRequestResult = { ok: boolean; message?: string };
type BuildingPlacementRequestHandler = (city: City, buildingId: string) => BuildingPlacementRequestResult;
type WonderPlacementRequestHandler = (city: City, wonderId: string) => BuildingPlacementRequestResult;
type WonderPlacementAvailabilityProvider = (city: City, wonderId: string) => boolean;
type BuyProductionRequestHandler = (city: City, index: number) => void;

/** Most recent timeline entries rendered in the History panel (older ones stay saved). */
const TIMELINE_RENDER_LIMIT = 200;

interface LeaderboardEntry {
  nationId: string;
  name: string;
  color: number;
  score: number;
  detail: string;
  secondaryScore?: number;
}

export class RightSidebarPanelDataProvider {
  private readonly scheduler = new RafScheduler();
  private readonly listeners: ChangedListener[] = [];
  private diplomacyManager: DiplomacyManager | null = null;
  private allianceManager: AllianceManager | null = null;
  private jointWarSystem: JointWarSystem | null = null;
  private jointWarProposal: { receiverNationId: string; kind: JointWarKind; targetNationId: string | null } | null = null;
  private getCurrentTurn: (() => number) | null = null;
  private diplomaticEvaluationSystem: DiplomaticEvaluationSystem | null = null;
  private borderPressureSystem: BorderPressureSystem | null = null;
  private militaryEvaluationSystem: AIMilitaryEvaluationSystem | null = null;
  private threatEvaluationSystem: AIMilitaryThreatEvaluationSystem | null = null;
  private discoverySystem: DiscoverySystem | null = null;
  private timelineService: HistoricalTimelineService | null = null;
  private researchSystem: ResearchSystem | null = null;
  private cultureSystem: CultureSystem | null = null;
  private wonderSystem: WonderSystem | null = null;
  private worldCouncilSystem: WorldCouncilSystem | null = null;
  private corporationSystem: CorporationSystem | null = null;
  private tradeDealSystem: TradeDealSystem | null = null;
  private tradeConnectionSystem: TradeConnectionSystem | null = null;
  private tradeDiplomacySystem: TradeDiplomacySystem | null = null;
  private resourceAccessSystem: ResourceAccessSystem | null = null;
  private tradeRouteProposal: { targetNationId: string; fromCityId: string | null; toCityId: string | null } | null = null;
  private resourceCitySearchSystem: ResourceCitySearchSystem | null = null;
  private detailsSearchQuery = '';
  private eraSystem: EraSystem | null = null;
  private readonly tradeMessages = new Map<string, string>();
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;
  private builderHintProvider: BuilderHintProvider | null = null;
  private buildingPlacementRequestHandler: BuildingPlacementRequestHandler | null = null;
  private wonderPlacementRequestHandler: WonderPlacementRequestHandler | null = null;
  private wonderPlacementAvailabilityProvider: WonderPlacementAvailabilityProvider | null = null;
  private buyProductionRequestHandler: BuyProductionRequestHandler | null = null;
  private arrangeAudienceHandler: ((leaderId: string) => void) | null = null;
  private current: RightSidebarDetailsState = {
    view: null,
    tile: null,
    city: null,
    unit: null,
    nationId: null,
    leaderId: null,
  };

  constructor(
    private readonly productionSystem: ProductionSystem,
    private readonly cityManager: CityManager,
    private readonly unitManager: { getUnit(id: string): Unit | undefined; getUnitAt(x: number, y: number): Unit | null; getUnitsByOwner(ownerId: string): Unit[]; getTransportForUnit(unit: Unit): Unit | undefined; getCargoForTransport(unit: Unit): Unit | undefined },
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
    private readonly humanNationId: string | undefined,
    private readonly cityTerritorySystem: CityTerritorySystem,
    private readonly gridSystem: IGridSystem,
    private readonly happinessSystem: HappinessSystem,
    private readonly strategicResourceCapacitySystem?: StrategicResourceCapacitySystem,
    private readonly unitUpkeepSystem?: UnitUpkeepSystem,
  ) {}

  onChanged(listener: ChangedListener): void {
    this.listeners.push(listener);
  }

  setAllianceManager(am: AllianceManager): void {
    this.allianceManager = am;
  }

  setJointWarSystem(system: JointWarSystem): void {
    this.jointWarSystem = system;
  }

  setDiplomacyManager(dm: DiplomacyManager): void {
    this.diplomacyManager = dm;
  }

  setCurrentTurnGetter(fn: () => number): void {
    this.getCurrentTurn = fn;
  }

  setDiplomaticEvaluationSystem(system: DiplomaticEvaluationSystem): void {
    this.diplomaticEvaluationSystem = system;
  }

  setBorderPressureSystem(system: BorderPressureSystem): void {
    this.borderPressureSystem = system;
  }

  setMilitaryEvaluationSystem(system: AIMilitaryEvaluationSystem): void {
    this.militaryEvaluationSystem = system;
  }

  setThreatEvaluationSystem(system: AIMilitaryThreatEvaluationSystem): void {
    this.threatEvaluationSystem = system;
  }

  setResearchSystem(researchSystem: ResearchSystem): void {
    this.researchSystem = researchSystem;
  }

  setCultureSystem(cultureSystem: CultureSystem): void {
    this.cultureSystem = cultureSystem;
  }

  setWonderSystem(wonderSystem: WonderSystem): void {
    this.wonderSystem = wonderSystem;
  }

  setWorldCouncilSystem(worldCouncilSystem: WorldCouncilSystem): void {
    this.worldCouncilSystem = worldCouncilSystem;
  }

  setCorporationSystem(corporationSystem: CorporationSystem): void {
    this.corporationSystem = corporationSystem;
  }

  setTradeDealSystem(tradeDealSystem: TradeDealSystem): void {
    this.tradeDealSystem = tradeDealSystem;
  }

  setTradeConnectionSystem(system: TradeConnectionSystem): void {
    this.tradeConnectionSystem = system;
  }

  setTradeDiplomacySystem(system: TradeDiplomacySystem): void {
    this.tradeDiplomacySystem = system;
  }

  setResourceAccessSystem(resourceAccessSystem: ResourceAccessSystem): void {
    this.resourceAccessSystem = resourceAccessSystem;
  }

  setResourceCitySearchSystem(resourceCitySearchSystem: ResourceCitySearchSystem): void {
    this.resourceCitySearchSystem = resourceCitySearchSystem;
  }

  setEraSystem(eraSystem: EraSystem): void {
    this.eraSystem = eraSystem;
  }

  setDiscoverySystem(ds: DiscoverySystem): void {
    this.discoverySystem = ds;
  }

  setTimelineService(timeline: HistoricalTimelineService): void {
    this.timelineService = timeline;
    timeline.onChanged(() => this.notifyChanged());
  }

  setBuilderHintProvider(provider: BuilderHintProvider): void {
    this.builderHintProvider = provider;
  }

  setBuildingPlacementRequestHandler(handler: BuildingPlacementRequestHandler): void {
    this.buildingPlacementRequestHandler = handler;
  }

  setWonderPlacementRequestHandler(handler: WonderPlacementRequestHandler): void {
    this.wonderPlacementRequestHandler = handler;
  }

  setWonderPlacementAvailabilityProvider(provider: WonderPlacementAvailabilityProvider): void {
    this.wonderPlacementAvailabilityProvider = provider;
  }

  setBuyProductionRequestHandler(handler: BuyProductionRequestHandler): void {
    this.buyProductionRequestHandler = handler;
  }

  setFoundCityHandler(canFoundCity: (unit: Unit) => boolean, foundCity: (unit: Unit) => void): void {
    this.canFoundCity = canFoundCity;
    this.foundCity = foundCity;
  }

  setArrangeAudienceHandler(handler: (leaderId: string) => void): void {
    this.arrangeAudienceHandler = handler;
  }

  getCurrentCity(): City | null {
    return this.current.city;
  }

  getView(): RightSidebarDetailsView {
    return this.current.view;
  }

  getCurrentCityId(): string | null {
    return this.current.view === 'city' ? this.current.city?.id ?? null : null;
  }

  getCurrentLeaderId(): string | null {
    return this.current.view === 'leader' ? this.current.leaderId : null;
  }

  getCurrentLeaderNationId(): string | null {
    return this.current.view === 'leader' ? this.current.nationId : null;
  }

  getVisibleLeaderDiplomacyNations(): Nation[] {
    return this.nationManager.getAllNations()
      .filter((nation) => this.isVisibleInLeaderDiagnostics(nation.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  isShowingCity(cityId?: string): boolean {
    return cityId !== undefined && this.current.view === 'city' && this.current.city?.id === cityId;
  }

  isShowingUnit(unit: Unit): boolean {
    return this.current.view === 'unit' && this.current.unit?.id === unit.id;
  }

  showTile(tile: Tile): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'tile', x: tile.x, y: tile.y });
    this.current = { view: 'tile', tile, city: null, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showCity(city: City): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'city', id: city.id, name: city.name });
    this.current = { view: 'city', tile: null, city, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showUnit(unit: Unit): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'unit', id: unit.id, name: unit.name });
    this.current = { view: 'unit', tile: null, city: null, unit, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  showNation(nationId: string): void {
    this.current = { view: 'nation', tile: null, city: null, unit: null, nationId, leaderId: null };
    this.notifyChanged();
  }

  showLeader(leaderIdOrNationId: string): void {
    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    this.current = {
      view: 'leader',
      tile: null,
      city: null,
      unit: null,
      nationId: leader?.nationId ?? leaderIdOrNationId,
      leaderId: leader?.id ?? leaderIdOrNationId,
    };
    this.notifyChanged();
  }

  clear(): void {
    console.debug('[RightSidebarPanelDataProvider] selected target', { kind: 'none' });
    this.current = { view: null, tile: null, city: null, unit: null, nationId: null, leaderId: null };
    this.notifyChanged();
  }

  refreshCurrent(): void {
    if (this.current.view === 'unit' && this.current.unit && !this.unitManager.getUnit(this.current.unit.id)) {
      this.clear();
      return;
    }
    this.notifyChanged();
  }

  refreshNationView(): void {
    if (this.current.view === 'nation') this.notifyChanged();
  }

  refreshProductionQueue(cityId: string): void {
    if (this.current.city?.id === cityId) this.notifyChanged();
  }

  requestRefresh(): void {
    this.scheduler.schedule('refreshCurrent', () => this.refreshCurrent());
  }

  shutdown(): void {
    this.scheduler.cancel();
  }

  getDetailsContent(
    cityTab: RightSidebarCityDetailsTab = 'city',
    leaderTab: RightSidebarLeaderDetailsTab = 'details',
  ): RightSidebarContent {
    let content: RightSidebarContent;
    switch (this.current.view) {
      case 'tile':
        content = this.current.tile ? this.getTileContent(this.current.tile) : this.getEmptyDetailsContent();
        break;
      case 'city':
        content = this.current.city ? this.getCityContent(this.current.city, cityTab) : this.getEmptyDetailsContent();
        break;
      case 'unit':
        content = this.current.unit ? this.getUnitContent(this.current.unit) : this.getEmptyDetailsContent();
        break;
      case 'nation':
        content = this.current.nationId
          ? this.getNationContent(this.current.nationId)
          : this.getEmptyDetailsContent();
        break;
      case 'leader':
        content = this.current.leaderId
          ? this.getLeaderContent(this.current.leaderId, leaderTab)
          : this.getEmptyDetailsContent();
        break;
      case null:
        content = this.getEmptyDetailsContent();
        break;
    }
    console.debug('[RightSidebarPanelDataProvider] provider result', {
      view: this.current.view,
      sections: content.sections.length,
      rows: content.sections.reduce((sum, section) => sum + section.rows.length, 0),
    });
    return content;
  }

  getLeaderboardContent(category: RightSidebarLeaderboardCategory): RightSidebarContent {
    const section = this.getLeaderboardSectionByCategory(category);
    return {
      title: 'Leaderboard',
      sections: [section],
    };
  }

  buildDiplomacyGraph(options: { revealAll?: boolean } = {}): DiplomacyGraph {
    const allNations = this.nationManager.getAllNations();
    const includedNationIds = options.revealAll
      ? new Set(allNations.map((nation) => nation.id))
      : this.getKnownDiplomacyGraphNationIds();
    const nations = allNations.filter((nation) => includedNationIds.has(nation.id));
    const nodes: DiplomacyGraphNode[] = nations.map((nation) => ({
      nationId: nation.id,
      name: nation.name,
      color: nation.color,
    }));
    const edges: DiplomacyGraphEdge[] = [];
    for (let i = 0; i < nations.length; i++) {
      for (let j = i + 1; j < nations.length; j++) {
        const a = nations[i];
        const b = nations[j];
        // Relationships are not mutually exclusive: emit one edge per active
        // relationship type so the graph can show them all simultaneously.
        for (const type of this.getDiplomacyGraphRelationshipTypes(a.id, b.id)) {
          edges.push({ fromNationId: a.id, toNationId: b.id, type });
        }
      }
    }
    return { nodes, edges };
  }

  /**
   * Read-only intelligence report on a nation: every city it owns with the
   * current production and turns remaining. Generated from live game state (no
   * persistent espionage storage), reusing the same city/production data as the
   * city and production screens.
   */
  buildIntelReport(nationId: string): IntelReport {
    const nation = this.nationManager.getNation(nationId);
    const cities: IntelReportCity[] = this.cityManager.getCitiesByOwner(nationId).map((city) => {
      const active = this.productionSystem.getQueue(city.id)[0];
      return {
        name: city.name,
        population: city.population,
        production: active ? getProducibleName(active.item) : null,
        turnsRemaining: active ? active.turnsRemaining : null,
      };
    });
    return { nationId, nationName: nation?.name ?? nationId, cities };
  }

  private getKnownDiplomacyGraphNationIds(): Set<string> {
    if (!this.humanNationId) return new Set();
    const known = new Set<string>([this.humanNationId]);
    for (const nationId of this.discoverySystem?.getMetNations(this.humanNationId) ?? []) {
      known.add(nationId);
    }
    return known;
  }

  /**
   * All active diplomatic relationship types between two nations, in center-out
   * priority order (Met/Embassy first → War/Alliance last). Relationships are
   * independent, so several can be active at once. Read-only — reflects existing
   * diplomacy state without changing it.
   */
  private getDiplomacyGraphRelationshipTypes(a: string, b: string): DiplomacyRelationshipType[] {
    const types: DiplomacyRelationshipType[] = [];
    if (this.discoverySystem?.hasMet(a, b) ?? true) types.push('hasMet');
    if (this.diplomacyManager) {
      if (this.diplomacyManager.hasEmbassy(a, b) || this.diplomacyManager.hasEmbassy(b, a)) {
        types.push('embassy');
      }
      if (
        this.diplomacyManager.isOpenBorderGrantedFrom(a, b)
        || this.diplomacyManager.isOpenBorderGrantedFrom(b, a)
      ) {
        types.push('openBorders');
      }
      if (this.diplomacyManager.hasTradeRelations(a, b)) types.push('trade');
      if (this.allianceManager?.areAllied(a, b)) types.push('ally');
      if (this.diplomacyManager.getState(a, b) === 'WAR') types.push('war');
    }
    return types;
  }

  getTimelineContent(): RightSidebarContent {
    const events = this.timelineService?.getEvents() ?? [];
    if (events.length === 0) {
      return {
        title: 'History',
        sections: [{ title: 'The History of the World So Far', rows: [textRow('History has yet to be written.', true)] }],
      };
    }

    // Newest first; cap the rendered entries so very long games stay responsive
    // (older entries remain stored and persist with the save).
    const rows: RightSidebarRow[] = [];
    const recent = events.slice(-TIMELINE_RENDER_LIMIT).reverse();
    for (const event of recent) {
      rows.push(textRow(`${event.dateLabel} (Round ${event.round})`, true));
      rows.push(textRow(`${event.icon} ${event.text}`));
    }
    if (events.length > TIMELINE_RENDER_LIMIT) {
      rows.push(textRow(`… ${events.length - TIMELINE_RENDER_LIMIT} earlier events`, true));
    }

    return {
      title: 'History',
      sections: [{ title: 'The History of the World So Far', rows }],
    };
  }

  getTimelineText(): string {
    const events = this.timelineService?.getEvents() ?? [];
    return events
      .slice()
      .reverse()
      .map((event) => `${event.dateLabel} (Round ${event.round})\n${event.icon} ${event.text}`)
      .join('\n\n');
  }

  private getEmptyDetailsContent(): RightSidebarContent {
    return {
      title: 'Details',
      sections: [{ title: 'Details', rows: [textRow('No selection', true)] }],
    };
  }

  private getTileContent(tile: Tile): RightSidebarContent {
    const owner = tile.ownerId ? this.nationManager.getNation(tile.ownerId) : undefined;
    const improvement = tile.improvementId ? getImprovementById(tile.improvementId) : undefined;
    const improvementConstruction = tile.improvementConstruction;
    const constructingImprovement = improvementConstruction
      ? getImprovementById(improvementConstruction.improvementId)
      : undefined;
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    const builderHint = this.builderHintProvider?.(tile) ?? null;
    const rows: RightSidebarRow[] = [
      textRow(tile.type, false, true),
      textRow(`Owner: ${owner?.name ?? 'Unclaimed'}`, false, false, owner?.color),
      textRow(`Resource: ${resource?.name ?? 'None'}`),
      textRow(`Improvement: ${improvement?.name ?? 'None'}`),
    ];
    if (improvementConstruction) {
      rows.push(textRow(
        `${constructingImprovement?.name ?? 'Improvement'} under construction: ${improvementConstruction.remainingTurns} turns remaining`,
        true,
      ));
    }
    if (resource) rows.push(textRow(`Resource bonus: ${formatYieldBonus(resource.yieldBonus)}`));
    if (improvement) rows.push(textRow(`Bonus: ${formatYieldBonus(improvement.yieldBonus)}`));
    if (builderHint) {
      rows.push(textRow(
        builderHint.canBuild && builderHint.improvement
          ? `Worker can construct ${builderHint.improvement.name} here`
          : `Worker cannot improve this tile${builderHint.reason ? `: ${builderHint.reason}` : ''}`,
        true,
      ));
    }
    return { title: 'Details', sections: [{ title: 'Tile', rows }, this.getFinderSection()] };
  }

  private getFinderSection(): RightSidebarSection {
    const rows: RightSidebarRow[] = [{
      kind: 'searchInput',
      value: this.detailsSearchQuery,
      placeholder: 'Search resources or cities...',
      onChange: (value) => {
        this.detailsSearchQuery = value;
      },
    }];

    const results = this.resourceCitySearchSystem?.search(this.detailsSearchQuery) ?? [];
    if (this.detailsSearchQuery.trim().length > 0 && results.length === 0) {
      rows.push(textRow('No matches.', true));
    } else {
      for (const result of results) rows.push(this.getFinderResultRow(result));
      if (results.length >= 25) rows.push(textRow('Showing first 25 matches.', true));
    }

    return { title: 'Find', rows };
  }

  private getFinderResultRow(result: ResourceCitySearchResult): RightSidebarRow {
    if (result.kind === 'city') {
      return buttonRow(
        `${result.city.name} - ${result.ownerNationName} - pop ${result.city.population}`,
        () => {
          window.dispatchEvent(new CustomEvent('detailsFinderFocus', {
            detail: { kind: 'city', cityId: result.city.id },
          }));
        },
        0x7fb4d5,
        '🗺️',
        this.getCitySpritePath(result.city.ownerId),
      );
    }

    const owner = result.ownerNationName ?? 'Unclaimed';
    return buttonRow(
      `${result.resourceName} - (${result.tile.x},${result.tile.y}) - ${owner}`,
      () => {
        window.dispatchEvent(new CustomEvent('detailsFinderFocus', {
          detail: { kind: 'tile', x: result.tile.x, y: result.tile.y },
        }));
      },
      0x86efac,
      '🗺️',
      getNaturalResourceSpritePath(result.resourceId),
    );
  }

  private getCityContent(city: City, tab: RightSidebarCityDetailsTab): RightSidebarContent {
    const nation = this.nationManager.getNation(city.ownerId);
    const resources = this.cityManager.getResources(city.id);
    if (!resources) return this.getEmptyDetailsContent();
    const garrison = this.unitManager.getUnitAt(city.tileX, city.tileY);
    // Show all buildings (broken ones stay visible, flagged) for the city panel.
    const buildingEntries = this.cityManager.getBuildings(city.id).getAllEntries();
    const buildings = buildingEntries.map((entry) => {
      const name = getBuildingById(entry.buildingId)?.name ?? entry.buildingId;
      return entry.broken ? `${name} (broken)` : name;
    });
    const economy = calculateCityEconomy(
      city,
      this.mapData,
      this.cityManager.getBuildings(city.id),
      this.gridSystem,
      EMPTY_MODIFIERS,
    );
    const isHuman = city.ownerId === this.humanNationId;
    const growthModifier = this.happinessSystem.getGrowthModifier(city.ownerId);
    const effectiveGrowthPerTurn = economy.netFood > 0 ? Math.floor(economy.netFood * growthModifier) : economy.netFood;
    const turnsUntilGrowth = effectiveGrowthPerTurn > 0
      ? Math.ceil((economy.foodToGrow - city.foodStorage) / effectiveGrowthPerTurn)
      : null;

    switch (tab) {
      case 'city':
        return {
          title: 'Details',
          sections: [{
        title: 'City',
        rows: [
          textRow(city.name, false, true, nation?.color),
          textRow(`Owner: ${nation?.name ?? 'Unknown'}`),
          textRow(`Capital: ${city.isCapital ? 'Yes' : 'No'}`),
          textRow(`Population: ${city.population}`),
          textRow(`Health: ${city.health}/${CITY_BASE_HEALTH}`),
          progressRow('Health', city.health, CITY_BASE_HEALTH),
          textRow(`Tile position: ${city.tileX}, ${city.tileY}`),
          textRow(`Defense: ${CITY_BASE_DEFENSE}`),
          textRow(`Garrison: ${garrison?.name ?? 'none'}`),
        ],
          }],
        };
      case 'growth':
        return {
          title: 'Details',
          sections: [{
        title: 'Growth',
        rows: [
          textRow(`Food stored: ${city.foodStorage} / ${economy.foodToGrow}`),
          textRow(`Food: ${formatSigned(economy.food)}/turn (base ${economy.baseFood} + ${economy.food - economy.baseFood} tiles/buildings)`),
          textRow(`Consumption: -${economy.foodConsumption}/turn (${city.population} pop x 2)`),
          textRow(`Net food: ${formatSigned(effectiveGrowthPerTurn)}/turn`),
          progressRow('Food', city.foodStorage, economy.foodToGrow),
          textRow(`Growth in: ${turnsUntilGrowth !== null ? `${turnsUntilGrowth} turn${turnsUntilGrowth !== 1 ? 's' : ''}` : '-'}`),
          textRow(`Culture stored: ${city.culture}`),
          textRow(`Culture per turn: +${resources.culturePerTurn}/turn`),
          ...this.getCultureClaimRows(city, isHuman),
          ...(growthModifier < 1.0 ? [textRow(`Global happiness growth modifier: x${growthModifier.toFixed(2)}`, true)] : []),
        ],
          }],
        };
      case 'output':
        return {
          title: 'Details',
          sections: [
            {
              title: 'Output',
              rows: [
                textRow(`Worked tiles: ${economy.workedTileCount} / ${economy.maxWorkableTiles}`),
                textRow(`Food: ${formatSigned(economy.food)}/turn`),
                textRow(`Production: ${resources.production} stored (+${resources.productionPerTurn}/turn)`),
                textRow(`Gold: +${resources.goldPerTurn}/turn`),
                textRow(`Science: +${resources.sciencePerTurn}/turn`),
                textRow(`Culture per turn: +${resources.culturePerTurn}/turn`),
                textRow(`Happiness: +${resources.happinessPerTurn}/turn`),
                textRow(`Buildings: ${buildings.length > 0 ? buildings.join(', ') : 'none'}`),
              ],
            },
            this.getProductionQueueSection(city, isHuman),
            ...(isHuman ? [this.getAddToQueueSection(city), this.getWonderSection(city), this.getCorporationSection(city)] : []),
          ],
        };
    }
  }

  private getUnitContent(unit: Unit): RightSidebarContent {
    const nation = this.nationManager.getNation(unit.ownerId);
    const unitConstruction = this.getImprovementConstructionForUnit(unit.id);
    const constructingImprovement = unitConstruction
      ? getImprovementById(unitConstruction.construction.improvementId)
      : undefined;
    const rows: RightSidebarRow[] = [
      textRow(`${unit.name} (${unit.unitType.name})`, false, true),
      textRow(`Owner: ${nation?.name ?? 'Unknown'}`, false, false, nation?.color),
      textRow(`HP: ${unit.health}/${unit.unitType.baseHealth}`),
      progressRow('Health', unit.health, unit.unitType.baseHealth),
      textRow(`Strength: ${unit.unitType.baseStrength}`),
      textRow(`Range: ${unit.unitType.range ?? 1}`),
      textRow(`Movement: ${unit.movementPoints}/${unit.maxMovementPoints}`),
    ];
    if (unit.improvementCharges !== undefined) {
      rows.push(textRow(`Improvements left: ${unit.improvementCharges}`));
    }
    if (unitConstruction) {
      rows.push(textRow(
        `Building ${constructingImprovement?.name ?? 'improvement'}: ${unitConstruction.construction.remainingTurns} turns remaining`,
        true,
      ));
    }
    const transport = this.unitManager.getTransportForUnit(unit);
    if (transport) rows.push(textRow(`Onboard: ${transport.name}`, true));
    const cargo = this.unitManager.getCargoForTransport(unit);
    if (cargo) rows.push(textRow(`Carrying: ${cargo.name}`, true));
    if (unit.unitType.canFound && this.canFoundCity?.(unit)) {
      rows.push(buttonRow('Found City', () => {
        this.foundCity?.(unit);
        this.requestRefresh();
      }, 0x7fbf6a));
    }
    return { title: 'Details', sections: [{ title: 'Unit', rows }] };
  }

  private getNationContent(nationId: string): RightSidebarContent {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { title: 'Details', sections: [{ title: 'Nation', rows: [textRow('Nation not found.', true)] }] };
    const isHuman = nationId === this.humanNationId;
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const units = this.unitManager.getUnitsByOwner(nationId);
    const happiness = this.happinessSystem.getNationState(nationId);
    const era = this.eraSystem?.getNationEra(nationId);
    const unitCounts = new Map<string, number>();
    for (const unit of units) unitCounts.set(unit.unitType.name, (unitCounts.get(unit.unitType.name) ?? 0) + 1);

    const sections: RightSidebarSection[] = [
      {
        title: 'Nation',
        rows: [
          textRow(`${nation.name}${isHuman ? ' (You)' : ''}`, false, true, nation.color),
          ...(era ? [textRow(`Era: ${formatEraLabel(era)}`)] : []),
        ],
      },
      {
        title: 'Economy',
        rows: [
          textRow(`Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
          textRow(`Culture: ${resources.culture} (+${resources.culturePerTurn}/turn)`),
          textRow(`Influence: ${resources.influence} (+${resources.influencePerTurn}/turn)`),
          textRow(`Happiness: ${formatSigned(happiness.netHappiness)}`),
        ],
      },
      {
        title: 'Happiness',
        rows: [
          textRow(`Happiness: ${formatSigned(happiness.netHappiness)} — ${formatHappinessStateLabel(happiness.state)}`, false, true),
          textRow('Sources:', true),
          textRow(`Base: ${formatSigned(happiness.happinessFromBase)}`),
          textRow(`Buildings: ${formatSigned(happiness.happinessFromBuildings)}`),
          textRow(`Wonders: ${formatSigned(happiness.happinessFromWonders)}`),
          textRow(`Corporations: ${formatSigned(happiness.happinessFromCorporations)}`),
          textRow(`Luxury resources: ${formatSigned(happiness.happinessFromLuxuryResources)}`),
          ...luxuryResourceLabels(happiness.availableLuxuryResourceQuantities).map((label) => textRow(`  • ${label}`, true)),
          textRow('Unhappiness:', true),
          textRow(`Cities: -${happiness.unhappinessFromCities}`),
          textRow(`Population: -${happiness.unhappinessFromPopulation}`),
          textRow('Effects:', true),
          textRow(`Growth: ${formatPercent(happiness.growthModifier)}`),
          textRow(`Production: ${formatPercent(happiness.productionModifier)}`),
          textRow(`Culture: ${formatPercent(happiness.cultureModifier)}`),
          textRow(`Gold: ${formatPercent(happiness.goldModifier)}`),
        ],
      },
      this.getCivicsSummarySection(nationId),
      this.getManufacturedResourcesSection(nationId),
      {
        title: `Cities (${cities.length})`,
        rows: cities.length === 0
          ? [textRow('No cities', true)]
          : cities.map((city) => buttonRow(`${city.name}${city.isCapital ? ' ★' : ''}  HP ${city.health}/${CITY_BASE_HEALTH}`, () => {
            window.dispatchEvent(new CustomEvent('focusCity', { detail: { cityId: city.id } }));
          }, nation.color)),
      },
      {
        title: `Military (${units.length} units)`,
        rows: unitCounts.size === 0
          ? [textRow('No units', true)]
          : [...unitCounts.entries()].map(([typeName, count]) => textRow(`${count}x ${typeName}`)),
      },
    ];
    if (!isHuman && this.diplomacyManager && this.humanNationId && this.isNationKnown(nationId)) {
      sections.push(this.getDiplomacySection(nationId));
    }
    return { title: 'Details', sections };
  }

  private getManufacturedResourcesSection(nationId: string): RightSidebarSection {
    const entries = this.resourceAccessSystem?.getAvailableManufacturedResourceQuantities(nationId) ?? [];
    if (entries.length === 0) {
      return { title: 'Manufactured Resources', rows: [textRow('None', true)] };
    }

    return {
      title: 'Manufactured Resources',
      rows: entries.map((entry) => {
        const resource = getManufacturedResourceById(entry.resourceId);
        return textRow(`${resource?.name ?? entry.resourceId}: ${entry.quantity}`);
      }),
    };
  }

  private getLeaderContent(
    leaderIdOrNationId: string,
    tab: RightSidebarLeaderDetailsTab,
  ): RightSidebarContent {
    const leader = getLeaderById(leaderIdOrNationId) ?? getLeaderByNationId(leaderIdOrNationId);
    if (!leader) return { title: 'Details', sections: [{ title: 'Leader', rows: [textRow('Leader not found.', true)] }] };

    switch (tab) {
      case 'details':
        return this.getLeaderDetailsContent(leader);
      case 'units':
        return this.getLeaderUnitsContent(leader);
      case 'cities':
        return this.getLeaderCitiesContent(leader);
      case 'diplomacy':
        return this.getLeaderDiplomacyContent(leader);
      case 'relations':
        return this.getLeaderRelationsContent(leader);
      case 'trade':
        return this.getLeaderTradeContent(leader);
      case 'deals':
        return this.getLeaderDealsContent(leader);
    }
  }

  private getLeaderDetailsContent(leader: LeaderDefinition): RightSidebarContent {
    const nation = this.nationManager.getNation(leader.nationId);
    const resources = this.nationManager.getResources(leader.nationId);
    const ideologyRows = this.getLeaderIdeologyRows(leader.nationId);
    const sections: RightSidebarSection[] = [];
    if (leader.nationId !== this.humanNationId) {
      sections.push({
        title: 'Audience',
        rows: [{
          kind: 'button',
          text: `Arrange an audience with ${leader.name}`,
          accentColor: 0xf4d06f,
          onClick: () => this.arrangeAudienceHandler?.(leader.id),
        }],
      });
    }
    sections.push(
      {
        title: 'Leader',
        rows: [
          textRow(leader.name, false, true, nation?.color),
          textRow(nation?.name ?? 'Unknown nation', false, false, nation?.color),
          ...(leader.title ? [textRow(leader.title)] : []),
          ...(leader.description ? [textRow(leader.description, true)] : []),
          textRow(`🕊️ ${resources.influence} (${formatSigned(resources.influencePerTurn)})`),
          ...ideologyRows,
        ],
      },
      this.getLeaderNationSection(leader.nationId),
      this.getLeaderTerritorySection(leader.nationId),
    );
    return {
      title: 'Leader Details',
      sections,
    };
  }

  private getLeaderIdeologyRows(leaderNationId: string): RightSidebarRow[] {
    const ideology = getLeaderIdeologyByNationId(leaderNationId);
    const rows: RightSidebarRow[] = [textRow(`Ideology: ${ideology.name}`)];

    if (!this.humanNationId) return rows;

    const humanIdeology = getLeaderIdeologyByNationId(this.humanNationId);
    const compatibility = getIdeologyCompatibility(humanIdeology.id, ideology.id);
    const compatibilityLabel = formatIdeologyCompatibilityLabel(describeIdeologyCompatibility(compatibility));
    rows.push(textRow(`Ideological relation: ${compatibilityLabel} (${formatSigned(compatibility)})`));
    const blocLabel = getIdeologicalBlocLabel(compatibility);
    if (blocLabel) rows.push(textRow(`Ideological bloc: ${blocLabel}`));
    return rows;
  }

  private getLeaderUnitsContent(leader: { nationId: string }): RightSidebarContent {
    return {
      title: 'Leader Details',
      sections: [this.getLeaderUnitsSection(leader.nationId, leader.nationId === this.humanNationId)],
    };
  }

  private getLeaderCitiesContent(leader: { nationId: string }): RightSidebarContent {
    return {
      title: 'Leader Details',
      sections: [this.getLeaderCitiesSection(leader.nationId)],
    };
  }

  /**
   * Build one row per active nation other than `selectedNationId`, from the
   * selected leader's perspective. Values come from DiplomacyManager.getRelation
   * (currently symmetric, but we call it directionally so future asymmetric
   * relations slot in here without UI changes). Rows for nations the human
   * player has not met return null values; the UI renders these as "?".
   */
  getLeaderRelationRows(selectedNationId: string): LeaderRelationRow[] {
    const rows: LeaderRelationRow[] = [];
    for (const nation of this.nationManager.getAllNations()) {
      if (nation.id === selectedNationId) continue;
      const isKnownToHuman = this.isNationKnown(nation.id);
      const leader = isKnownToHuman ? getLeaderByNationId(nation.id) : undefined;
      const displayName = isKnownToHuman
        ? (leader?.name ?? nation.name)
        : 'Unknown leader';
      if (!isKnownToHuman || !this.diplomacyManager) {
        rows.push({
          nationId: nation.id,
          displayName,
          isKnownToHuman,
          trust: null,
          affinity: null,
          fear: null,
          hostility: null,
        });
        continue;
      }
      const relation = this.diplomacyManager.getRelation(selectedNationId, nation.id);
      rows.push({
        nationId: nation.id,
        displayName,
        isKnownToHuman: true,
        trust: Math.round(relation.trust),
        affinity: Math.round(relation.affinity),
        fear: Math.round(relation.fear),
        hostility: Math.round(relation.hostility),
      });
    }
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return rows;
  }

  private getLeaderRelationsContent(leader: { nationId: string }): RightSidebarContent {
    const rows = this.getLeaderRelationRows(leader.nationId);
    const sectionRows: RightSidebarRow[] = [];
    if (rows.length === 0) {
      sectionRows.push(textRow('No other nations.', true));
    } else {
      sectionRows.push({
        kind: 'relationsTable',
        header: { leader: 'Leader', trust: 'Trust', affinity: 'Affinity', fear: 'Fear', hostility: 'Hostility' },
        rows: rows.map((row) => ({
          leader: row.displayName,
          trust: formatRelationCell(row.trust),
          affinity: formatRelationCell(row.affinity),
          fear: formatRelationCell(row.fear),
          hostility: formatRelationCell(row.hostility),
        })),
      });
    }
    return { title: 'Leader Details', sections: [{ title: 'Relations', rows: sectionRows }] };
  }

  private getLeaderDiplomacyContent(leader: { nationId: string }): RightSidebarContent {
    if (leader.nationId === this.humanNationId) {
      return { title: 'Leader Details', sections: [{ title: 'Diplomacy', rows: [textRow('Select another nation to manage diplomacy.', true)] }] };
    }
    if (!this.diplomacyManager || !this.humanNationId || !this.isNationKnown(leader.nationId)) {
      return { title: 'Leader Details', sections: [{ title: 'Diplomacy', rows: [textRow('You have not met this nation.', true)] }] };
    }
    return { title: 'Leader Details', sections: [this.getDiplomacySection(leader.nationId)] };
  }

  /**
   * Trade tab — now read-only. It surfaces what each side can trade and the
   * gating reasons, but the interactive Buy controls live in the Leader
   * Audience chamber (see {@link getAudienceTradeRows}).
   */
  private getLeaderTradeContent(leader: { nationId: string }): RightSidebarContent {
    const rows = this.buildTradeRows(leader.nationId, false);
    if (leader.nationId !== this.humanNationId) {
      rows.push({ kind: 'separator' });
      rows.push(textRow('Propose trades in an audience with this leader.', true));
    }
    return { title: 'Leader Details', sections: [{ title: 'Trade', rows }] };
  }

  /** Interactive trade rows hosted by the Leader Audience chamber. */
  getAudienceTradeRows(nationId: string): RightSidebarRow[] {
    return this.buildTradeRows(nationId, true);
  }

  private buildTradeRows(otherNationId: string, interactive: boolean): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    if (otherNationId === this.humanNationId) {
      rows.push(textRow('Select another nation to trade with.', true));
      return rows;
    }
    if (!this.diplomacyManager || !this.humanNationId || !this.isNationKnown(otherNationId)) {
      rows.push(textRow('You have not met this nation.', true));
      return rows;
    }
    if (this.diplomacyManager.getState(this.humanNationId, otherNationId) === 'WAR') {
      rows.push(textRow('Unavailable during war.', true));
      return rows;
    }
    if (!this.diplomacyManager.hasTradeRelations(this.humanNationId, otherNationId)) {
      rows.push(textRow('Trade requires active Trade Relations.', true));
      return rows;
    }
    const humanHasTradeNetworks = this.researchSystem?.isResearched(this.humanNationId, 'trade_networks') ?? false;
    const otherHasTradeNetworks = this.researchSystem?.isResearched(otherNationId, 'trade_networks') ?? false;
    if (!humanHasTradeNetworks && !otherHasTradeNetworks) {
      rows.push(textRow('Requires at least one nation to know Trade Networks.', true));
      return rows;
    }
    rows.push(...this.getTradeTabRows(otherNationId, interactive));
    return rows;
  }

  private getLeaderDealsContent(leader: { nationId: string }): RightSidebarContent {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeDealSystem || !this.humanNationId) {
      rows.push(textRow('Trade system unavailable.', true));
      return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
    }
    const deals = leader.nationId === this.humanNationId
      ? this.tradeDealSystem.getDealsForNation(this.humanNationId)
      : this.tradeDealSystem.getDealsBetween(this.humanNationId, leader.nationId);
    if (deals.length === 0) {
      rows.push(textRow('No active deals.', true));
      return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
    }
    for (const deal of deals) rows.push(textRow(this.formatDealRow(deal)));
    return { title: 'Leader Details', sections: [{ title: 'Deals', rows }] };
  }

  private getProductionQueueSection(city: City, isHuman: boolean): RightSidebarSection {
    const queue = this.getVisibleProductionQueue(city.id);
    if (queue.length === 0) return { title: 'Production Queue', rows: [textRow('No production queued', true)] };
    const rows: RightSidebarRow[] = [];
    const availableGold = isHuman ? this.nationManager.getResources(city.ownerId).gold : 0;
    queue.forEach(({ entry, index }, visibleIndex) => {
      const name = getProducibleName(entry.item);
      const spritePath = getProducibleSpritePath(entry.item);
      const turnsText = entry.blockedReason ? 'blocked' : `${entry.turnsRemaining} turn${entry.turnsRemaining !== 1 ? 's' : ''}`;
      const label = `${visibleIndex + 1}. ${name} (${turnsText})${index === 0 ? ' [active]' : ''}`;
      rows.push(isHuman
        ? buttonRow(label, () => {
          this.productionSystem.removeFromQueue(city.id, index);
          this.requestRefresh();
        }, 0xb86767, '🗑️', spritePath)
        : textRow(label, false, false, undefined, spritePath));
      if (isHuman) {
        const buyCost = this.productionSystem.getBuyCost(city.id, index);
        if (buyCost !== null) {
          const canBuy = availableGold >= buyCost;
          const buyLabel = canBuy
            ? `💰 Buy for ${buyCost} gold`
            : `💰 Need ${buyCost - availableGold} more gold`;
          rows.push({
            kind: 'button',
            text: buyLabel,
            disabled: !canBuy,
            accentColor: 0xe0c060,
            onClick: () => {
              if (!canBuy) return;
              this.buyProductionRequestHandler?.(city, index);
            },
          });
        }
      }
      if (index === 0 && !entry.blockedReason) rows.push(progressRow('Progress', entry.progress, entry.cost));
      if (entry.blockedReason) rows.push(textRow(entry.blockedReason, true));
    });
    return { title: 'Production Queue', rows };
  }

  private getVisibleProductionQueue(cityId: string): Array<{ entry: QueueEntryView; index: number }> {
    return this.productionSystem.getQueue(cityId)
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !this.isUnavailableUniqueQueueEntry(entry));
  }

  private isUnavailableUniqueQueueEntry(entry: QueueEntryView): boolean {
    if (entry.item.kind === 'wonder') {
      return this.wonderSystem?.isWonderBuilt(entry.item.wonderType.id) === true;
    }
    if (entry.item.kind === 'corporation') {
      return this.corporationSystem?.isFounded(entry.item.corporationType.id) === true;
    }
    return false;
  }

  private getAddToQueueSection(city: City): RightSidebarSection {
    const reservedBuildingIds = new Set(
      city.ownedTileCoords
        .map((coord) => this.mapData.tiles[coord.y]?.[coord.x]?.buildingConstruction?.buildingId)
        .filter((buildingId): buildingId is string => buildingId !== undefined),
    );
    const rows: RightSidebarRow[] = [];
    for (const unitType of ALL_UNIT_TYPES) {
      if (unitType.category === 'leader') continue;
      if (this.researchSystem && !this.researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) continue;
      const disabledReason = getCityUnitProductionBlockReason(
        city,
        unitType,
        this.mapData,
        this.gridSystem,
        {
          strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
          unitUpkeepAffordability: this.unitUpkeepSystem,
          upkeepAffordabilityTurns: 10,
          getNationEra: (nationId) => this.eraSystem?.getNationEra(nationId) ?? 'ancient',
        },
      );
      if (disabledReason && !unitType.requiredResource && !isUnitUpkeepAffordabilityReason(disabledReason)) continue;
      const item: Producible = { kind: 'unit', unitType };
      rows.push({
        kind: 'button',
        text: disabledReason
          ? `${getProducibleName(item)} (${this.productionSystem.getCost(item)}) - ${disabledReason}`
          : `${getProducibleName(item)} (${this.productionSystem.getCost(item)})`,
        disabled: disabledReason !== undefined,
        accentColor: 0x6aa7d8,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (!canCityProduceUnit(
            city,
            unitType,
            this.mapData,
            this.gridSystem,
            {
              strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
              unitUpkeepAffordability: this.unitUpkeepSystem,
              upkeepAffordabilityTurns: 10,
              getNationEra: (nationId) => this.eraSystem?.getNationEra(nationId) ?? 'ancient',
            },
          )) return;
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
        },
      });
    }
    rows.push({ kind: 'separator' });
    for (const buildingType of ALL_BUILDINGS) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      if (reservedBuildingIds.has(buildingType.id)) continue;
      if (this.researchSystem && !this.researchSystem.isBuildingUnlocked(city.ownerId, buildingType.id)) continue;
      const item: Producible = { kind: 'building', buildingType };
      rows.push(buttonRow(`${getProducibleName(item)} (${this.productionSystem.getCost(item)})`, () => {
        if (this.buildingPlacementRequestHandler) {
          const result = this.buildingPlacementRequestHandler(city, buildingType.id);
          if (!result.ok && result.message) window.alert(result.message);
          return;
        }
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
      }, 0x7fbf6a));
    }
    return { title: 'Add to Queue', rows };
  }

  private getCorporationSection(city: City): RightSidebarSection {
    const rows: RightSidebarRow[] = [];
    const corporationSystem = this.corporationSystem;
    const isQueuedHere = (corporationId: string): boolean => this.productionSystem.getQueue(city.id)
      .some((entry) => entry.item.kind === 'corporation' && entry.item.corporationType.id === corporationId);

    for (const corporationType of CORPORATIONS) {
      if (corporationSystem?.isFounded(corporationType.id)) continue;

      const item: Producible = { kind: 'corporation', corporationType };
      const queuedHere = isQueuedHere(corporationType.id);
      const blockers = corporationSystem?.getCityCorporationBlockers(city, corporationType.id) ?? [];
      let disabled = false;
      let reason: string | undefined;
      if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
      else if (blockers.length > 0) { disabled = true; reason = blockers.join(', '); }

      const turns = this.productionSystem.getTurnsEstimate(city.id, item);
      const baseLabel = `${corporationType.name} (${turns})`;
      rows.push({
        kind: 'button',
        text: reason ? `${baseLabel} — ${reason}` : baseLabel,
        disabled,
        accentColor: 0x8fb9d9,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (disabled || !corporationSystem?.canCityProduceCorporation(city, corporationType.id)) return;
          this.productionSystem.enqueue(city.id, item);
          this.requestRefresh();
        },
      });
    }

    if (rows.length === 0) rows.push(textRow('No corporations available.', true));
    return { title: 'Corporations', rows };
  }

  private getWonderSection(city: City): RightSidebarSection {
    const rows: RightSidebarRow[] = [];
    const research = this.researchSystem;
    const wonderSystem = this.wonderSystem;
    const isQueuedHere = (wonderId: string): boolean => this.productionSystem.getQueue(city.id)
      .some((entry) => entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId);

    const wonderTypes = wonderSystem?.getAvailableWonders(ALL_WONDERS) ?? ALL_WONDERS;
    for (const wonderType of wonderTypes) {
      const techUnlocked = research ? research.isWonderUnlocked(city.ownerId, wonderType.id) : true;
      if (!techUnlocked) continue;

      const item: Producible = { kind: 'wonder', wonderType };
      const cost = this.productionSystem.getCost(item);
      const queuedHere = isQueuedHere(wonderType.id);
      const blockReason = wonderSystem
        ? wonderSystem.getCityWonderBlockReason(city, wonderType, { researchSystem: research ?? undefined })
        : undefined;
      const hasValidPlacement = this.wonderPlacementAvailabilityProvider
        ? this.wonderPlacementAvailabilityProvider(city, wonderType.id)
        : true;

      let disabled = false;
      let reason: string | undefined;
      if (queuedHere) { disabled = true; reason = 'Already in this queue'; }
      else if (blockReason) { disabled = true; reason = blockReason; }
      else if (!hasValidPlacement) { disabled = true; reason = 'No valid placement tile'; }

      const baseLabel = `${wonderType.name} (${cost})`;
      const label = reason ? `${baseLabel} — ${reason}` : `${baseLabel} — ${wonderType.description}`;
      rows.push({
        kind: 'button',
        text: label,
        disabled,
        accentColor: 0xd9b84a,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (disabled) return;
          if (this.wonderPlacementRequestHandler) {
            const result = this.wonderPlacementRequestHandler(city, wonderType.id);
            if (!result.ok && result.message) window.alert(result.message);
            return;
          }
          this.productionSystem.enqueue(city.id, item);
          this.requestRefresh();
        },
      });
    }

    if (rows.length === 0) {
      rows.push(textRow('No wonders available — research a prerequisite tech.', true));
    }
    return { title: 'World Wonders', rows };
  }

  private getCultureClaimRows(city: City, isHuman: boolean): RightSidebarRow[] {
    const cost = this.cityTerritorySystem.getClaimCost(city, this.mapData);
    const claimableTiles = this.cityTerritorySystem.getClaimableTiles(city, this.mapData);
    const rows: RightSidebarRow[] = [
      textRow(`Next tile: ${cost} culture`),
      progressRow('Culture', city.culture, cost),
    ];
    if (city.culture >= cost && isHuman && claimableTiles.length > 0) rows.push(textRow('READY: Select a tile', false, false, 0x66d17a));
    if (city.culture >= cost && claimableTiles.length === 0) rows.push(textRow('No claimable tiles available', true));
    return rows;
  }

  private getCivicsSummarySection(nationId: string): RightSidebarSection {
    if (!this.cultureSystem) return { title: 'Civics', rows: [textRow('Culture system unavailable.', true)] };
    const current = this.cultureSystem.getCurrentCultureNode(nationId);
    const progress = this.cultureSystem.getCultureProgress(nationId);
    const unlockedNodes = this.cultureSystem.getUnlockedCultureNodes(nationId);
    return {
      title: 'Civics',
      rows: [
        textRow(`Active Civic: ${current?.name ?? 'None selected'}`),
        textRow(current ? `Progress: ${progress} / ${this.cultureSystem.getEffectiveCost(current.id)}` : `Stored Progress: ${progress}`),
        textRow(`Culture applied each turn: +${this.cultureSystem.getCulturePerTurn(nationId)}`, true),
        textRow(`Completed civics: ${unlockedNodes.length}`, true),
      ],
    };
  }

  private getLeaderNationSection(nationId: string): RightSidebarSection {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { title: 'Nation', rows: [textRow('Nation not found.', true)] };
    const resources = this.nationManager.getResources(nationId);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const capital = cities.find((city) => city.isCapital);
    const era = this.eraSystem?.getNationEra(nationId);
    return {
      title: 'Nation',
      rows: [
        textRow(nation.name, false, true, nation.color),
        ...(era ? [textRow(`Era: ${formatEraLabel(era)}`)] : []),
        textRow(`Capital: ${capital?.name ?? 'none'}`),
        textRow(`Gold: ${resources.gold} (+${resources.goldPerTurn}/turn)`),
        textRow(`Cities: ${cities.length}`),
      ],
    };
  }

  private getLeaderTerritorySection(nationId: string): RightSidebarSection {
    const happiness = this.happinessSystem.getNationState(nationId);
    const value = this.happinessSystem.getHappinessForNation(nationId);
    return {
      title: 'Territory',
      rows: [
        textRow(`Territory: ${this.nationManager.getTileCount(nationId, this.mapData)} tiles`),
        textRow(`😀 ${formatSigned(value)} (${formatHappinessStateLabel(happiness.state)})`),
      ],
    };
  }

  private getLeaderUnitsSection(nationId: string, isHuman: boolean): RightSidebarSection {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const militaryUnits = units.filter((unit) => (unit.unitType.upkeepGold ?? 0) > 0);
    const totalUpkeep = militaryUnits.reduce(
      (sum, unit) => sum + calculateUnitUpkeep(unit, this.mapData),
      0,
    );
    return {
      title: `Units (${units.length})`,
      titleRight: `Total upkeep: ${totalUpkeep} 💰`,
      rows: this.renderUnitList(units, isHuman),
    };
  }

  private renderUnitList(units: Unit[], isHuman: boolean): RightSidebarRow[] {
    if (units.length === 0) return [textRow('No units', true)];
    return units.map((unit) => {
      const movement = `MP ${unit.movementPoints}/${unit.maxMovementPoints}`;
      const sleeping = isHuman && unit.isSleeping ? ' (sleeping)' : '';
      return buttonRow(
        `${unit.unitType.name}${sleeping}  HP ${unit.health}/${unit.unitType.baseHealth}  ${movement}`,
        () => {
          window.dispatchEvent(new CustomEvent('focusUnit', { detail: { unitId: unit.id } }));
        },
        undefined,
        undefined,
        getUnitSpritePath(unit.unitType.id),
      );
    });
  }

  private getLeaderCitiesSection(nationId: string): RightSidebarSection {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    return {
      title: `Cities (${cities.length})`,
      rows: this.renderCityList(cities),
    };
  }

  private renderCityList(cities: City[]): RightSidebarRow[] {
    if (cities.length === 0) return [textRow('No cities', true)];
    return cities.map((city) => {
      const activeProduction = this.getVisibleProductionQueue(city.id)[0]?.entry.item;
      const productionLabel = activeProduction ? getProducibleName(activeProduction) : 'None';
      return buttonRow(
        `${city.name}${city.isCapital ? ' ★' : ''}  Pop ${city.population}  HP ${city.health}/${CITY_BASE_HEALTH}  Production: ${productionLabel}`,
        () => {
          window.dispatchEvent(new CustomEvent('leaderCityFocusRequested', { detail: { cityId: city.id } }));
        },
        undefined,
        undefined,
        this.getCitySpritePath(city.ownerId),
      );
    });
  }

  private getCitySpritePath(nationId: string): string {
    return getCitySpritePath(this.eraSystem?.getNationEra(nationId) ?? 'ancient');
  }

  /**
   * Read-only diplomacy summary shown in the Diplomacy tab and nation view.
   * All negotiation controls now live exclusively in the Leader Audience
   * chamber — see {@link getAudienceDiplomacyActionRows}. This tab is purely
   * informational: relationship breakdown plus active agreements.
   */
  private getDiplomacySection(nationId: string): RightSidebarSection {
    return { title: 'Diplomacy', rows: this.getDiplomacyInfoRows(nationId) };
  }

  private getDiplomacyInfoRows(nationId: string): RightSidebarRow[] {
    const dm = this.diplomacyManager!;
    const humanId = this.humanNationId!;
    const relation = dm.getRelation(humanId, nationId);
    const humanGrantsBorders = dm.isOpenBorderGrantedFrom(humanId, nationId);
    const hasHumanEmbassy = dm.hasEmbassy(humanId, nationId);
    const hasTheirEmbassy = dm.hasEmbassy(nationId, humanId);
    const hasTradeRelations = dm.hasTradeRelations(humanId, nationId);
    const currentTurn = this.getCurrentTurn?.() ?? 0;
    const peaceTreatyRemaining = dm.getPeaceTreatyRemainingTurns(humanId, nationId, currentTurn);
    const rows: RightSidebarRow[] = [];

    rows.push(...this.getDiplomaticBreakdownRows(humanId, nationId));
    rows.push({ kind: 'separator' });
    rows.push(textRow('Agreements', false, true));
    rows.push(textRow(`Status: ${relation.state}`));
    rows.push(textRow(`Open Borders: ${humanGrantsBorders ? 'Open' : 'Closed'}`));
    rows.push(textRow(`Your Embassy: ${hasHumanEmbassy ? 'Established' : 'Not established'}`));
    rows.push(textRow(`Their Embassy: ${hasTheirEmbassy ? 'Established' : 'Not established'}`));
    rows.push(textRow(`Trade Relations: ${hasTradeRelations ? 'Active' : 'Inactive'}`));
    if (peaceTreatyRemaining > 0) {
      rows.push(textRow(`Peace Treaty: ${peaceTreatyRemaining} turn${peaceTreatyRemaining === 1 ? '' : 's'} remaining`));
    }
    rows.push(...this.getAllianceFactRows(nationId));

    const deals = this.tradeDealSystem?.getDealsBetween(humanId, nationId) ?? [];
    if (deals.length > 0) {
      rows.push({ kind: 'separator' });
      rows.push(textRow('Trade Agreements', false, true));
      for (const deal of deals) rows.push(textRow(this.formatDealRow(deal)));
    }

    rows.push({ kind: 'separator' });
    rows.push(textRow('Negotiate through an audience with this leader.', true));
    return rows;
  }

  /**
   * Compact diplomatic status lines shown in the audience chamber's leader
   * information panel. Read-only; mirrors {@link getDiplomacyInfoRows} but only
   * surfaces the active agreements.
   */
  getAudienceStatusRows(nationId: string): RightSidebarRow[] {
    if (!this.diplomacyManager || !this.humanNationId || nationId === this.humanNationId) return [];
    if (!this.isNationKnown(nationId)) return [textRow('You have not met this nation.', true)];
    const dm = this.diplomacyManager;
    const humanId = this.humanNationId;
    const relation = dm.getRelation(humanId, nationId);
    const rows: RightSidebarRow[] = [textRow(relation.state === 'WAR' ? 'At War' : 'At Peace')];
    const alliance = this.allianceManager?.getAllianceForNation(humanId);
    if (alliance && this.allianceManager?.areAllied(humanId, nationId)) {
      rows.push(textRow(`Allied — ${alliance.name}`));
    }
    if (dm.isOpenBorderGrantedFrom(humanId, nationId)) rows.push(textRow('Open Borders granted'));
    if (dm.hasEmbassy(humanId, nationId)) rows.push(textRow('Embassy established'));
    if (dm.hasTradeRelations(humanId, nationId)) rows.push(textRow('Trade Relations active'));
    const currentTurn = this.getCurrentTurn?.() ?? 0;
    const peaceTreatyRemaining = dm.getPeaceTreatyRemainingTurns(humanId, nationId, currentTurn);
    if (peaceTreatyRemaining > 0) {
      rows.push(textRow(`Peace Treaty: ${peaceTreatyRemaining} turn${peaceTreatyRemaining === 1 ? '' : 's'} remaining`));
    }
    return rows;
  }

  /**
   * Interactive diplomacy controls hosted by the Leader Audience chamber.
   * Previously rendered inline in the Diplomacy tab; relocated here so the tab
   * is read-only. All existing handlers, validation, and AI acceptance logic
   * are reused unchanged (the buttons dispatch the same `diplomacyAction`
   * events GameScene already listens for).
   */
  getAudienceDiplomacyActionRows(nationId: string): RightSidebarRow[] {
    if (!this.diplomacyManager || !this.humanNationId) return [textRow('Diplomacy unavailable.', true)];
    if (nationId === this.humanNationId) return [textRow('This is your own nation.', true)];
    if (!this.isNationKnown(nationId)) return [textRow('You have not met this nation.', true)];

    const dm = this.diplomacyManager;
    const humanId = this.humanNationId;
    const relation = dm.getRelation(humanId, nationId);
    const nation = this.nationManager.getNation(nationId);
    const validationContext = {
      haveMet: (a: string, b: string): boolean => this.discoverySystem?.hasMet(a, b) ?? true,
      hasTechnology: (targetNationId: string, techId: string): boolean =>
        this.researchSystem?.isResearched(targetNationId, techId) ?? false,
      hasCulture: (targetNationId: string, cultureId: string): boolean =>
        this.cultureSystem?.isUnlocked(targetNationId, cultureId) ?? false,
    };
    // Open borders are directional: this reflects whether the human has granted
    // the other nation passage. The toggle below flips that grant.
    const humanGrantsBorders = dm.isOpenBorderGrantedFrom(humanId, nationId);
    const hasHumanEmbassy = dm.hasEmbassy(humanId, nationId);
    const hasTradeRelations = dm.hasTradeRelations(humanId, nationId);
    const embassyValidation = dm.canEstablishEmbassy(humanId, nationId, validationContext);
    const tradeValidation = dm.canEstablishTradeRelations(humanId, nationId, validationContext);
    const openBordersUnavailableReason = relation.state === 'WAR' ? 'Unavailable during war.' : undefined;
    const rows: RightSidebarRow[] = [];

    rows.push(disabledReasonButtonRow(
      humanGrantsBorders ? 'Cancel Open Borders' : 'Open Borders',
      openBordersUnavailableReason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'toggleOpenBorders', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    if (openBordersUnavailableReason) rows.push(textRow(openBordersUnavailableReason, true));
    rows.push(disabledReasonButtonRow(
      hasHumanEmbassy ? 'Embassy Established' : 'Establish Embassy',
      hasHumanEmbassy ? 'Embassy already established.' : embassyValidation.reason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'establishEmbassy', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    if (!hasHumanEmbassy && embassyValidation.reason) rows.push(textRow(embassyValidation.reason, true));
    rows.push(disabledReasonButtonRow(
      hasTradeRelations ? 'Cancel Trade Relations' : 'Establish Trade Relations',
      hasTradeRelations ? undefined : tradeValidation.reason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: {
            action: hasTradeRelations ? 'cancelTradeRelations' : 'establishTradeRelations',
            targetNationId: nationId,
          },
        }));
      },
      hasTradeRelations ? 0xb86767 : nation?.color,
    ));
    if (!hasTradeRelations && tradeValidation.reason) rows.push(textRow(tradeValidation.reason, true));
    // Exchange Maps: one-time intelligence sharing. Tied directly to Writing —
    // it only requires that the human knows Writing, the two nations have met,
    // and they are not at war (no embassy or other diplomatic prerequisites).
    // AI acceptance (handled elsewhere) still depends on attitude.
    const exchangeMapsReason = relation.state === 'WAR'
      ? 'Unavailable during war.'
      : !validationContext.haveMet(humanId, nationId)
        ? 'You have not met this nation.'
        : !validationContext.hasTechnology(humanId, 'writing')
          ? 'Requires Writing.'
          : undefined;
    rows.push(disabledReasonButtonRow(
      'Exchange Maps',
      exchangeMapsReason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'exchangeMaps', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    if (exchangeMapsReason) rows.push(textRow(exchangeMapsReason, true));
    rows.push(disabledReasonButtonRow(
      'Give Gift',
      undefined,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'giveGift', targetNationId: nationId },
        }));
      },
      nation?.color,
    ));
    rows.push(...this.buildAllianceActionRows(nationId, nation?.color));
    rows.push(...this.buildJointWarActionRows(nationId, nation?.color));
    const isAtWar = relation.state === 'WAR';
    const currentTurn = this.getCurrentTurn?.() ?? 0;
    const peaceTreatyRemaining = dm.getPeaceTreatyRemainingTurns(humanId, nationId, currentTurn);
    const peaceTreatyReason = peaceTreatyRemaining > 0
      ? `Peace treaty active for ${peaceTreatyRemaining} more turn${peaceTreatyRemaining === 1 ? '' : 's'}.`
      : undefined;
    const warDuration = isAtWar ? dm.getWarDuration(humanId, nationId, currentTurn) : 0;
    const peaceUnavailableReason = isAtWar && !dm.canProposePeace(humanId, nationId, currentTurn)
      ? `Peace cannot be proposed until ${MIN_WAR_TURNS_FOR_PEACE} turns of war have passed (${warDuration}/${MIN_WAR_TURNS_FOR_PEACE}).`
      : undefined;
    // Alliance partners cannot declare war on each other.
    const alliancePartnerReason = this.allianceManager?.areAllied(humanId, nationId)
      ? 'You cannot declare war on an alliance partner.'
      : undefined;
    const warPeaceReason = relation.state === 'PEACE'
      ? (alliancePartnerReason ?? peaceTreatyReason)
      : peaceUnavailableReason;
    rows.push(disabledReasonButtonRow(
      relation.state === 'PEACE' ? 'Declare War' : 'Propose Peace',
      warPeaceReason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: relation.state === 'PEACE' ? 'declareWar' : 'proposePeace', targetNationId: nationId },
        }));
      },
      relation.state === 'PEACE' ? 0xb86767 : nation?.color,
    ));
    if (alliancePartnerReason) rows.push(textRow(alliancePartnerReason, true));
    if (peaceTreatyReason && !alliancePartnerReason) rows.push(textRow(peaceTreatyReason, true));
    if (peaceUnavailableReason) rows.push(textRow(peaceUnavailableReason, true));
    rows.push({ kind: 'separator' });
    rows.push(...this.buildTradeRouteProposalRows(nationId, nation?.color));
    return rows;
  }

  /**
   * "Propose Alliance" control for the audience chamber. Reflects every v1
   * alliance rule via AllianceManager — the UI never re-implements them. When
   * already allied it shows a disabled, informative state instead.
   */
  private buildAllianceActionRows(nationId: string, accentColor?: number): RightSidebarRow[] {
    if (!this.allianceManager || !this.humanNationId) return [];
    const humanId = this.humanNationId;

    if (this.allianceManager.isInAlliance(humanId)) {
      const isThisAlly = this.allianceManager.areAllied(humanId, nationId);
      return [disabledReasonButtonRow(
        isThisAlly ? 'Allied' : 'Propose Alliance',
        isThisAlly ? 'You are already allied with this nation.' : 'You are already in an alliance.',
        () => {},
        accentColor,
      )];
    }

    const validation = this.allianceManager.canProposeAlliance(humanId, nationId, this.allianceProposalContext());
    const rows: RightSidebarRow[] = [disabledReasonButtonRow(
      'Propose Alliance',
      validation.ok ? undefined : validation.reason,
      () => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'proposeAlliance', targetNationId: nationId },
        }));
      },
      accentColor,
    )];
    if (!validation.ok && validation.reason) rows.push(textRow(validation.reason, true));
    return rows;
  }

  private allianceProposalContext(): AllianceProposalContext {
    return {
      haveMet: (a, b) => this.discoverySystem?.hasMet(a, b) ?? true,
      isAtWar: (a, b) => this.diplomacyManager?.getState(a, b) === 'WAR',
      hasOpenBorders: (a, b) => this.diplomacyManager?.isOpenBorderGrantedFrom(a, b) ?? false,
      hasEmbassy: (a, b) => this.diplomacyManager?.hasEmbassy(a, b) ?? false,
      hasTradeRelations: (a, b) => this.diplomacyManager?.hasTradeRelations(a, b) ?? false,
    };
  }

  /**
   * "Request Joint War" / "Ask to Join War" controls for the audience chamber.
   * Opening one enters a target-selection sub-flow (mirroring the trade-route
   * proposal pattern); confirming dispatches a diplomacyAction with the chosen
   * third-party target. All target-validity rules come from JointWarSystem.
   */
  private buildJointWarActionRows(receiverNationId: string, accentColor?: number): RightSidebarRow[] {
    if (!this.jointWarSystem || !this.humanNationId) return [];
    const humanId = this.humanNationId;
    const proposalOpen = this.jointWarProposal?.receiverNationId === receiverNationId;

    if (!proposalOpen) {
      const rows: RightSidebarRow[] = [];
      for (const kind of ['request', 'join'] as const) {
        const hasTargets = this.jointWarSystem.getValidJointWarTargets(humanId, receiverNationId, kind).length > 0;
        const disabledReason = hasTargets
          ? undefined
          : (kind === 'request'
            ? 'No nation is available for a coordinated war.'
            : 'You are not at war with any nation they could join against.');
        rows.push(disabledReasonButtonRow(
          kind === 'request' ? 'Request Joint War' : 'Ask to Join War',
          disabledReason,
          () => {
            this.jointWarProposal = { receiverNationId, kind, targetNationId: null };
            this.requestRefresh();
          },
          accentColor,
        ));
      }
      return rows;
    }

    const proposal = this.jointWarProposal!;
    const kind = proposal.kind;
    const rows: RightSidebarRow[] = [
      textRow(kind === 'request' ? 'Request Joint War' : 'Ask to Join War', false, true),
      textRow('Select a target nation:'),
    ];
    const targetIds = this.jointWarSystem.getValidJointWarTargets(humanId, receiverNationId, kind);
    if (targetIds.length === 0) {
      rows.push(textRow('No valid target nations.', true));
    } else {
      for (const targetId of targetIds) {
        const targetName = this.nationManager.getNation(targetId)?.name ?? targetId;
        rows.push({
          kind: 'button',
          text: targetName,
          selected: targetId === proposal.targetNationId,
          accentColor,
          onClick: () => {
            if (this.jointWarProposal) {
              this.jointWarProposal = { ...this.jointWarProposal, targetNationId: targetId };
              this.requestRefresh();
            }
          },
        });
      }
    }

    rows.push({ kind: 'separator' });
    const chosenTargetId = proposal.targetNationId;
    rows.push(disabledReasonButtonRow(
      'Confirm',
      chosenTargetId ? undefined : 'Select a target nation first.',
      () => {
        if (!chosenTargetId) return;
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: {
            action: kind === 'request' ? 'requestJointWar' : 'askToJoinWar',
            targetNationId: receiverNationId,
            jointWarTargetNationId: chosenTargetId,
          },
        }));
        this.jointWarProposal = null;
      },
      accentColor,
    ));
    rows.push({
      kind: 'button',
      text: 'Cancel',
      onClick: () => {
        this.jointWarProposal = null;
        this.requestRefresh();
      },
    });
    return rows;
  }

  /** Read-only alliance facts for a nation, for the informational views. */
  private getAllianceFactRows(nationId: string): RightSidebarRow[] {
    if (!this.allianceManager) return [];
    const alliance = this.allianceManager.getAllianceForNation(nationId);
    if (!alliance) return [];
    const allyId = this.allianceManager.getAllyNationId(nationId);
    const allyName = allyId ? (this.nationManager.getNation(allyId)?.name ?? allyId) : 'Unknown';
    return [
      textRow(`Alliance: ${alliance.name}`),
      textRow(`Ally: ${allyName}`),
    ];
  }

  private computeTradeRouteSetupPayment(targetNationId: string): number | null {
    if (!this.diplomaticEvaluationSystem || !this.humanNationId) return 25;
    const attitude = this.diplomaticEvaluationSystem.evaluateAttitude(targetNationId, this.humanNationId);
    switch (attitude) {
      case 'friendly': return 0;
      case 'neutral': return 25;
      case 'afraid': return 75;
      case 'hostile': return null;
    }
  }

  private buildTradeRouteProposalRows(targetNationId: string, accentColor?: number): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeConnectionSystem || !this.humanNationId) return rows;

    const humanId = this.humanNationId;
    const dm = this.diplomacyManager;
    const isAtWar = dm?.getState(humanId, targetNationId) === 'WAR';
    const hasTradeRelations = dm?.hasTradeRelations(humanId, targetNationId) ?? false;
    const setupPayment = this.computeTradeRouteSetupPayment(targetNationId);
    const proposalOpen = this.tradeRouteProposal?.targetNationId === targetNationId;

    if (!proposalOpen) {
      let disabledReason: string | undefined;
      if (isAtWar) disabledReason = 'Unavailable during war.';
      else if (!hasTradeRelations) disabledReason = 'Requires active Trade Relations.';
      else if (setupPayment === null) disabledReason = 'Relations too hostile to propose a trade route.';

      rows.push(disabledReasonButtonRow(
        'Propose Trade Route',
        disabledReason,
        () => {
          this.tradeRouteProposal = { targetNationId, fromCityId: null, toCityId: null };
          this.requestRefresh();
        },
        accentColor,
      ));
      if (disabledReason) rows.push(textRow(disabledReason, true));
      return rows;
    }

    rows.push(textRow('Propose Trade Route', false, true));

    const humanCities = this.cityManager.getCitiesByOwner(humanId);
    const targetCities = this.cityManager.getCitiesByOwner(targetNationId);
    const fromCityId = this.tradeRouteProposal!.fromCityId;
    const toCityId = this.tradeRouteProposal!.toCityId;

    // Two-column selector: pick one of your cities (left) and one of theirs
    // (right). The selected pair is the proposed connection.
    const toPickerItem = (city: City, selectedId: string | null, isFrom: boolean): CityPickerItem => {
      const total = this.tradeConnectionSystem!.getCityTradeCapacity(city.id);
      const available = this.tradeConnectionSystem!.getCityAvailableTradeCapacity(city.id);
      const hasCapacity = available >= 1;
      return {
        id: city.id,
        label: `${city.name}  ${available}/${total}`,
        disabled: !hasCapacity,
        disabledReason: hasCapacity ? undefined : 'No trade capacity',
        selected: city.id === selectedId,
        onClick: () => {
          if (!this.tradeRouteProposal) return;
          this.tradeRouteProposal = isFrom
            ? { ...this.tradeRouteProposal, fromCityId: city.id }
            : { ...this.tradeRouteProposal, toCityId: city.id };
          this.requestRefresh();
        },
      };
    };

    rows.push({
      kind: 'cityPairPicker',
      leftHeader: 'Your cities',
      rightHeader: this.nationManager.getNation(targetNationId)?.name ?? 'Their cities',
      leftItems: humanCities.map((city) => toPickerItem(city, fromCityId, true)),
      rightItems: targetCities.map((city) => toPickerItem(city, toCityId, false)),
      emptyLabel: 'No cities available.',
      accentColor,
    });

    rows.push({ kind: 'separator' });

    if (!fromCityId || !toCityId) {
      rows.push(textRow('Select cities above to propose a route.', true));
    } else {
      const validation = this.tradeConnectionSystem.canCreateTradeConnection(fromCityId, toCityId);
      rows.push(textRow(validation.ok ? 'Valid route.' : `Cannot create route: ${validation.reason}`, !validation.ok));

      const paymentGold = setupPayment ?? 0;
      rows.push(textRow(paymentGold === 0 ? 'Setup payment: Free' : `Setup payment: ${paymentGold} gold`));
      const humanGold = this.nationManager.getResources(humanId).gold;
      if (setupPayment !== null && humanGold < paymentGold) {
        rows.push(textRow(`Insufficient gold (have ${Math.floor(humanGold)}, need ${paymentGold}).`, true));
      }

      const canConfirm = validation.ok && setupPayment !== null && humanGold >= paymentGold;
      rows.push(disabledReasonButtonRow(
        'Confirm Proposal',
        canConfirm ? undefined : 'Route not valid.',
        () => {
          if (!canConfirm || !fromCityId || !toCityId || setupPayment === null) return;
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'proposeTradeRoute', targetNationId, fromCityId, toCityId, setupPaymentGold: setupPayment },
          }));
          this.tradeRouteProposal = null;
        },
        accentColor,
      ));
    }

    rows.push({
      kind: 'button',
      text: 'Cancel',
      onClick: () => {
        this.tradeRouteProposal = null;
        this.requestRefresh();
      },
    });

    return rows;
  }

  private getDiplomaticBreakdownRows(viewerNationId: string, targetNationId: string): RightSidebarRow[] {
    const relation = this.diplomacyManager?.getRelation(viewerNationId, targetNationId);
    if (!relation) return [];

    const evaluation = this.diplomaticEvaluationSystem?.evaluateRelation(viewerNationId, targetNationId);
    const militaryComparison = this.militaryEvaluationSystem?.compareMilitaryStrength(viewerNationId, targetNationId);
    const threatLevel = this.threatEvaluationSystem?.getThreatLevel(viewerNationId, targetNationId);
    const borderPressureLevel = this.borderPressureSystem?.getBorderPressureLevel(viewerNationId, targetNationId);
    const ideologyScore = evaluation?.ideologyCompatibility;
    const ideologyLabel = evaluation
      ? formatIdeologyCompatibilityLabel(evaluation.ideologyCompatibilityLabel)
      : 'Unknown';

    const tradeHistory = this.tradeDiplomacySystem?.getTradeHistory(viewerNationId, targetNationId);
    const tradeHistoryRows: ReturnType<typeof textRow>[] = [];
    if (tradeHistory && tradeHistory.tradeTrustBonus > 0) {
      tradeHistoryRows.push(textRow(`Trade Route History: +${tradeHistory.tradeTrustBonus} Trust`, true));
    }
    if (tradeHistory && tradeHistory.tradeAffinityBonus > 0) {
      tradeHistoryRows.push(textRow(`Trade Cooperation: +${tradeHistory.tradeAffinityBonus} Affinity`, true));
    }

    return [
      textRow('Relations', false, true),
      textRow(`Trust: ${Math.round(relation.trust)}`),
      textRow(`Fear: ${Math.round(relation.fear)}`),
      textRow(`Hostility: ${Math.round(relation.hostility)}`),
      textRow(`Affinity: ${Math.round(relation.affinity)}`),
      ...tradeHistoryRows,
      textRow(`Ideology: ${ideologyScore === undefined ? '?' : formatSigned(ideologyScore)} (${ideologyLabel})`),
      textRow(`Border pressure: ${formatBorderPressureLevel(borderPressureLevel)}`),
      textRow(`Military balance: ${formatMilitaryComparison(militaryComparison)}`),
      textRow(`Threat level: ${formatThreatLevel(threatLevel)}`),
      textRow(`Final attitude: ${formatAttitude(evaluation?.attitude ?? 'neutral')}`),
    ];
  }

  private getTradeTabRows(otherNationId: string, interactive: boolean): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeDealSystem || !this.resourceAccessSystem || !this.humanNationId) {
      rows.push(textRow('Trade system unavailable.', true));
      return rows;
    }
    const playerId = this.humanNationId;
    const otherNation = this.nationManager.getNation(otherNationId);
    const otherOwned = this.resourceAccessSystem.getExportableResourceQuantities(otherNationId);
    const playerOwned = this.resourceAccessSystem.getExportableResourceQuantities(playerId);
    const existingDeals = this.tradeDealSystem.getDealsBetween(playerId, otherNationId);
    const importedFromSeller = new Set(
      existingDeals
        .filter((deal) => deal.sellerNationId === otherNationId && deal.buyerNationId === playerId)
        .map((deal) => deal.resourceId),
    );
    const exportedToBuyer = new Set(
      existingDeals
        .filter((deal) => deal.sellerNationId === playerId && deal.buyerNationId === otherNationId)
        .map((deal) => deal.resourceId),
    );

    rows.push(...this.buildTradeRoutesOverviewRows(otherNationId));
    rows.push({ kind: 'separator' });

    // A deal needs an active trade route with a free slot between the nations
    // (mirrors TradeDealSystem.validateDeal). Human deals use directional slots:
    // imports (buying) and exports (selling) each get their own pool, so the
    // player can run one of each over a single route. Buttons render disabled
    // with an explanation when their direction has no free slot, instead of
    // clicks failing silently.
    const dealCapacityTotal = this.tradeDealSystem.getDealCapacityBetweenNations(playerId, otherNationId);
    const importsUsed = existingDeals.filter((deal) => deal.buyerNationId === playerId && deal.sellerNationId === otherNationId).length;
    const exportsUsed = existingDeals.filter((deal) => deal.sellerNationId === playerId && deal.buyerNationId === otherNationId).length;
    const hasImportCapacity = importsUsed < dealCapacityTotal;
    const hasExportCapacity = exportsUsed < dealCapacityTotal;

    rows.push(textRow(`${otherNation?.name ?? otherNationId} can sell to you`, false, true));
    if (otherOwned.length === 0) {
      rows.push(textRow('No resources to sell.', true));
    } else {
      if (interactive && !hasImportCapacity) {
        rows.push(textRow('An active trade route with available import capacity is required before resources can be traded.', true));
      }
      for (const { resourceId, quantity } of otherOwned) {
        const tradeGold = this.getResourceTradeGoldPerTurn(resourceId);
        rows.push(textRow(`${this.formatResourceName(resourceId)} x${quantity}${this.getResourceTypeSuffix(resourceId)}`));
        const alreadyImporting = importedFromSeller.has(resourceId);
        if (!interactive) {
          if (alreadyImporting) rows.push(textRow('Currently importing', true));
          continue;
        }
        const buyDisabled = alreadyImporting || !hasImportCapacity;
        const twentyTurnGold = Math.max(1, tradeGold - 1);
        // Buy: seller = AI nation, buyer = human. Both durations on one row.
        rows.push({
          kind: 'buttonGroup',
          buttons: [
            {
              text: alreadyImporting ? 'Already importing' : `Buy 10t — ${tradeGold}g/turn`,
              accentColor: otherNation?.color,
              disabled: buyDisabled,
              onClick: () => this.createTradeDealRequest(otherNationId, playerId, resourceId, 10, tradeGold),
            },
            {
              text: alreadyImporting ? 'Already importing' : `Buy 20t — ${twentyTurnGold}g/turn`,
              accentColor: otherNation?.color,
              disabled: buyDisabled,
              onClick: () => this.createTradeDealRequest(otherNationId, playerId, resourceId, 20, twentyTurnGold),
            },
          ],
        });
      }
    }

    rows.push({ kind: 'separator' });
    rows.push(textRow('You can sell to them', false, true));
    if (playerOwned.length === 0) {
      rows.push(textRow('You have no resources to offer.', true));
    } else {
      if (interactive && !hasExportCapacity) {
        rows.push(textRow('No available export capacity to this nation.', true));
      }
      for (const { resourceId, quantity } of playerOwned) {
        const tradeGold = this.getResourceTradeGoldPerTurn(resourceId);
        rows.push(textRow(`${this.formatResourceName(resourceId)} x${quantity}${this.getResourceTypeSuffix(resourceId)}`));
        const alreadyExporting = exportedToBuyer.has(resourceId);
        if (!interactive) {
          if (alreadyExporting) rows.push(textRow('Currently exporting', true));
          continue;
        }
        const sellDisabled = alreadyExporting || !hasExportCapacity;
        const twentyTurnGold = Math.max(1, tradeGold - 1);
        // Sell: seller = human, buyer = AI nation. Mirrors the Buy controls.
        rows.push({
          kind: 'buttonGroup',
          buttons: [
            {
              text: alreadyExporting ? 'Already exporting' : `Sell 10t — ${tradeGold}g/turn`,
              accentColor: otherNation?.color,
              disabled: sellDisabled,
              onClick: () => this.createTradeDealRequest(playerId, otherNationId, resourceId, 10, tradeGold),
            },
            {
              text: alreadyExporting ? 'Already exporting' : `Sell 20t — ${twentyTurnGold}g/turn`,
              accentColor: otherNation?.color,
              disabled: sellDisabled,
              onClick: () => this.createTradeDealRequest(playerId, otherNationId, resourceId, 20, twentyTurnGold),
            },
          ],
        });
      }
    }

    const message = this.tradeMessages.get(otherNationId);
    if (message) {
      rows.push(textRow(message, true));
    }
    return rows;
  }

  /**
   * Read-only overview of the trade routes between the human and `otherNationId`,
   * covering both routes still under construction ("In progress") and completed
   * ("Active") ones. Visibility only — no trade-route logic is touched here.
   */
  private buildTradeRoutesOverviewRows(otherNationId: string): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    if (!this.tradeConnectionSystem || !this.humanNationId) return rows;
    const humanId = this.humanNationId;

    const connections = this.tradeConnectionSystem.getAllConnections().filter((conn) =>
      (conn.nationAId === humanId && conn.nationBId === otherNationId) ||
      (conn.nationAId === otherNationId && conn.nationBId === humanId),
    );

    rows.push(textRow('Trade Routes', false, true));
    if (connections.length === 0) {
      rows.push(textRow('No trade routes yet.', true));
      return rows;
    }

    // Show routes still being built first, then completed (active) ones.
    connections.sort((a, b) => Number(a.status === 'active') - Number(b.status === 'active'));

    for (const conn of connections) {
      const humanIsA = conn.nationAId === humanId;
      const humanCityName = this.cityManager.getCity(humanIsA ? conn.cityAId : conn.cityBId)?.name
        ?? (humanIsA ? conn.cityAId : conn.cityBId);
      const foreignCityName = this.cityManager.getCity(humanIsA ? conn.cityBId : conn.cityAId)?.name
        ?? (humanIsA ? conn.cityBId : conn.cityAId);

      rows.push(textRow(`${humanCityName} → ${foreignCityName}`));
      if (conn.status === 'active') {
        rows.push(textRow('Active · —', true));
      } else {
        const turns = this.getTradeRouteTurnsRemaining(conn);
        rows.push(textRow(
          turns !== null ? `In progress · ${turns} turn${turns === 1 ? '' : 's'} remaining` : 'In progress',
          true,
        ));
      }
    }
    return rows;
  }

  /**
   * Turns left to finish a building route, read from the production queue entry
   * that builds it (lives in the initiating city, `cityAId`). Null if not found.
   */
  private getTradeRouteTurnsRemaining(conn: TradeConnection): number | null {
    const entry = this.productionSystem.getQueue(conn.cityAId).find(
      (e) => e.item.kind === 'tradeRoute' && e.item.connectionId === conn.id,
    );
    return entry ? entry.turnsRemaining : null;
  }

  private createTradeDealRequest(
    sellerNationId: string,
    buyerNationId: string,
    resourceId: string,
    turns: number,
    goldPerTurn: number,
  ): void {
    if (!this.tradeDealSystem || !this.humanNationId) return;
    // The "other" nation (whose audience tab this is) keys the status message,
    // regardless of trade direction.
    const otherNationId = sellerNationId === this.humanNationId ? buyerNationId : sellerNationId;
    const result = this.tradeDealSystem.createDeal({
      sellerNationId,
      buyerNationId,
      resourceId,
      turns,
      goldPerTurn,
    });
    if (result.ok) {
      this.tradeMessages.delete(otherNationId);
      return;
    }
    this.tradeMessages.set(otherNationId, result.reason ?? 'Trade deal failed.');
    this.requestRefresh();
  }

  private formatResourceName(resourceId: string): string {
    return getResourceDisplayName(resourceId);
  }

  private getResourceTypeSuffix(resourceId: string): string {
    return getManufacturedResourceById(resourceId) ? ' (manufactured)' : '';
  }

  private getResourceTradeGoldPerTurn(resourceId: string): number {
    const manufactured = getManufacturedResourceById(resourceId);
    if (manufactured?.tradeGoldPerTurn !== undefined) return manufactured.tradeGoldPerTurn;
    return getNaturalResourceById(resourceId)?.category === 'luxury' ? 5 : 4;
  }

  private formatDealRow(deal: TradeDeal): string {
    const resourceName = this.formatResourceName(deal.resourceId);
    const sellerSide = deal.sellerNationId === this.humanNationId
      ? 'You'
      : this.nationManager.getNation(deal.sellerNationId)?.name ?? deal.sellerNationId;
    const buyerSide = deal.buyerNationId === this.humanNationId
      ? 'You'
      : this.nationManager.getNation(deal.buyerNationId)?.name ?? deal.buyerNationId;
    const turnsWord = deal.remainingTurns === 1 ? 'turn' : 'turns';
    return `${resourceName}: ${sellerSide} → ${buyerSide} | ${deal.goldPerTurn} gold/turn | ${deal.remainingTurns} ${turnsWord} left`;
  }

  private getLeaderboardSection(title: string, entries: LeaderboardEntry[]): RightSidebarSection {
    return {
      title,
      rows: entries.length === 0
        ? [textRow('No leaderboard data available.', true)]
        : entries.map((entry, index) => textRow(`${index + 1}. ${entry.name}: ${entry.score} (${entry.detail})`, false, false, entry.color)),
    };
  }

  private getLeaderboardSectionByCategory(category: RightSidebarLeaderboardCategory): RightSidebarSection {
    switch (category) {
      case 'domination':
        return this.getLeaderboardSection('⚔️ Domination', this.getDominationLeaderboard());
      case 'diplomacy':
        return this.getDiplomaticVictorySection();
      case 'research':
        return this.getLeaderboardSection('💡 Research', this.getResearchLeaderboard());
      case 'cultural':
        return this.getCulturalVictorySection();
    }
  }

  /**
   * Cultural Victory ranking: nations ranked by owned World Wonders, with a
   * header showing the dynamically-calculated win threshold. The denominator is
   * always the required count, so players see "owned / required".
   */
  private getCulturalVictorySection(): RightSidebarSection {
    const required = getRequiredCulturalVictoryWonderCount();
    const entries = this.getCulturalVictoryLeaderboard();
    const headerRow = textRow(
      `Cultural Victory — own ${required} of ${ALL_WONDERS.length} World Wonders to win.`,
      true,
    );
    const rows: RightSidebarRow[] = entries.length === 0
      ? [textRow('No leaderboard data available.', true)]
      : entries.map((entry, index) => textRow(
        `${index + 1}. ${entry.name}: ${entry.detail}`,
        false,
        false,
        entry.color,
      ));
    return { title: '🏛️ World Wonders', rows: [headerRow, ...rows] };
  }

  private getCulturalVictoryLeaderboard(): LeaderboardEntry[] {
    if (!this.wonderSystem) return [];
    const required = getRequiredCulturalVictoryWonderCount();
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const owned = getOwnedWonderCount(nation.id, this.wonderSystem!, this.cityManager);
      return {
        nationId: nation.id,
        name: nation.name,
        color: nation.color,
        score: owned,
        detail: `${owned} / ${required} World Wonders`,
        // Tie-break: accumulated culture (the same metric the Culture board uses).
        secondaryScore: this.getCultureScore(nation.id),
      };
    }));
  }

  private getDiplomaticVictorySection(): RightSidebarSection {
    const entries = this.getDiplomacyLeaderboard();
    const requiredScore = this.worldCouncilSystem?.getDiplomacyScoreThreshold() ?? 5000;
    const headerRow = textRow(
      `Diplomatic Victory — reach ${requiredScore.toLocaleString()} Diplomatic Score to win.`,
      true,
    );
    const rows: RightSidebarRow[] = entries.length === 0
      ? [textRow('No leaderboard data available.', true)]
      : entries.map((entry, index) => textRow(
        `${index + 1}. ${entry.name}: ${entry.score.toLocaleString()}`,
        false,
        false,
        entry.color,
      ));
    return { title: '🕊️ Diplomatic Victory', rows: [headerRow, ...rows] };
  }

  private getCultureScore(nationId: string): number {
    const unlocked = this.cultureSystem?.getUnlockedCultureNodes(nationId).length ?? 0;
    const current = this.cultureSystem?.getCurrentCultureNode(nationId);
    const progress = current && this.cultureSystem
      ? Math.round((this.cultureSystem.getCultureProgress(nationId) / Math.max(1, this.cultureSystem.getEffectiveCost(current.id))) * 100)
      : 0;
    return unlocked * 100 + progress;
  }

  private getDominationLeaderboard(): LeaderboardEntry[] {
    const capitals = this.cityManager.getAllCities().filter((city) => city.isCapital);
    const nations = this.nationManager.getAllNations();

    const strengthByNation = new Map<string, number>();
    let totalWorldStrength = 0;
    for (const nation of nations) {
      const strength = this.militaryEvaluationSystem?.getMilitaryStrength(nation.id).totalStrength ?? 0;
      strengthByNation.set(nation.id, strength);
      totalWorldStrength += strength;
    }

    return this.sortLeaderboard(nations.map((nation) => {
      const score = capitals.filter((city) => city.ownerId === nation.id).length;
      const milStrength = strengthByNation.get(nation.id) ?? 0;
      const milPct = totalWorldStrength > 0 ? Math.round(milStrength / totalWorldStrength * 100) : 0;
      return {
        nationId: nation.id,
        name: nation.name,
        color: nation.color,
        score,
        detail: `${score}/${capitals.length} caps, mil ${milPct}%`,
        secondaryScore: milStrength,
      };
    }));
  }

  private getResearchLeaderboard(): LeaderboardEntry[] {
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const researched = this.researchSystem?.getResearchedTechnologies(nation.id).length ?? 0;
      const current = this.researchSystem?.getCurrentResearch(nation.id);
      const progress = current && this.researchSystem
        ? Math.round((this.researchSystem.getResearchProgress(nation.id) / Math.max(1, this.researchSystem.getEffectiveCost(current.id))) * 100)
        : 0;
      return { nationId: nation.id, name: nation.name, color: nation.color, score: researched * 100 + progress, detail: `${researched} techs${current ? `, ${progress}% ${current.name}` : ''}` };
    }));
  }

  private getDiplomacyLeaderboard(): LeaderboardEntry[] {
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => ({
      nationId: nation.id,
      name: nation.name,
      color: nation.color,
      score: this.getDiplomaticScore(nation.id),
      detail: `${this.getDiplomaticScore(nation.id).toLocaleString()} Diplomatic Score`,
    })));
  }

  private getDiplomaticScore(nationId: string): number {
    return this.worldCouncilSystem
      ?.getMembers()
      .find((member) => member.nationId === nationId)
      ?.diplomacyScore ?? 0;
  }

  private sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return entries.sort(
      (a, b) => b.score - a.score
        || (b.secondaryScore ?? 0) - (a.secondaryScore ?? 0)
        || a.name.localeCompare(b.name),
    );
  }

  private isNationKnown(nationId: string): boolean {
    if (!this.discoverySystem || !this.humanNationId) return true;
    return this.discoverySystem.hasMet(this.humanNationId, nationId);
  }

  private isVisibleInLeaderDiagnostics(nationId: string): boolean {
    if (nationId === this.humanNationId) return true;
    return this.isNationKnown(nationId);
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) listener();
  }

  private getImprovementConstructionForUnit(unitId: string): { tile: Tile; construction: NonNullable<Tile['improvementConstruction']> } | null {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const construction = tile.improvementConstruction;
        if (construction?.unitId === unitId) {
          return { tile, construction };
        }
      }
    }
    return null;
  }
}

function textRow(text: string, muted = false, large = false, color?: number, spritePath?: string): RightSidebarRow {
  return { kind: 'text', text, muted, large, color, spritePath };
}

function formatRelationCell(value: number | null): string {
  if (value === null) return '?';
  return Math.max(0, value).toString();
}

function formatEraLabel(era: Era): string {
  return era.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function buttonRow(text: string, onClick: () => void, accentColor?: number, trailingIcon?: string, spritePath?: string): RightSidebarRow {
  return { kind: 'button', text, onClick, accentColor, trailingIcon, spritePath };
}

function disabledReasonButtonRow(
  text: string,
  disabledReason: string | undefined,
  onClick: () => void,
  accentColor?: number,
): RightSidebarRow {
  return {
    kind: 'button',
    text,
    disabled: disabledReason !== undefined,
    disabledReason,
    accentColor,
    onClick,
  };
}

function progressRow(label: string, current: number, max: number): RightSidebarRow {
  return { kind: 'progress', label, current, max };
}

function getProducibleName(item: Producible): string {
  switch (item.kind) {
    case 'unit':
      return item.unitType.name;
    case 'building':
      return item.buildingType.name;
    case 'wonder':
      return item.wonderType.name;
    case 'corporation':
      return item.corporationType.name;
    case 'tradeRoute':
      return item.displayName;
  }
}

function getProducibleSpritePath(item: Producible): string | undefined {
  switch (item.kind) {
    case 'unit':
      return getUnitSpritePath(item.unitType.id);
    case 'wonder':
      return getWonderSpritePath(item.wonderType.id);
    case 'corporation':
      return getCorporationSpritePath(item.corporationType.id);
    case 'building':
    case 'tradeRoute':
      return undefined;
  }
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatIdeologyCompatibilityLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getIdeologicalBlocLabel(compatibility: number): string | null {
  if (compatibility >= 25) return 'Partner';
  if (compatibility <= -25) return 'Rival';
  return null;
}

function formatMilitaryComparison(comparison: MilitaryComparison | undefined): string {
  switch (comparison) {
    case 'stronger':
      return 'Stronger';
    case 'equal':
      return 'Balanced';
    case 'weaker':
      return 'Weaker';
    case undefined:
      return 'Unknown';
  }
}

function formatThreatLevel(threatLevel: ThreatLevel | undefined): string {
  switch (threatLevel) {
    case 'none':
      return 'None';
    case 'low':
      return 'Low';
    case 'medium':
      return 'Moderate';
    case 'high':
      return 'High';
    case undefined:
      return 'Unknown';
  }
}

function formatBorderPressureLevel(level: 'mild' | 'strong' | 'severe' | null | undefined): string {
  switch (level) {
    case 'mild':
      return 'Mild';
    case 'strong':
      return 'Strong';
    case 'severe':
      return 'Severe';
    case null:
      return 'None';
    case undefined:
      return 'Unknown';
  }
}

function isUnitUpkeepAffordabilityReason(reason: string): boolean {
  return reason.startsWith('Not enough gold reserves to support this unit');
}

function formatAttitude(attitude: DiplomaticAttitude): string {
  return attitude.charAt(0).toUpperCase() + attitude.slice(1);
}

function formatYieldBonus(yieldBonus: {
  food: number;
  production: number;
  gold: number;
  science?: number;
  culture?: number;
  happiness?: number;
}): string {
  const parts = [
    { label: 'Food', value: yieldBonus.food },
    { label: 'Production', value: yieldBonus.production },
    { label: 'Gold', value: yieldBonus.gold },
    { label: 'Science', value: yieldBonus.science ?? 0 },
    { label: 'Culture', value: yieldBonus.culture ?? 0 },
    { label: 'Happiness', value: yieldBonus.happiness ?? 0 },
  ]
    .filter((part) => part.value !== 0)
    .map((part) => `${formatSigned(part.value)} ${part.label}`);
  return parts.length > 0 ? parts.join(', ') : '+0';
}
