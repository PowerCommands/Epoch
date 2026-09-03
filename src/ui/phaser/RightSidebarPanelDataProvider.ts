import { ALL_BUILDINGS, GRAND_STADIUM, getBuildingById } from '../../data/buildings';
import { getImprovementById } from '../../data/improvements';
import { getImprovementOwnerId } from '../../systems/ImprovementOwnership';
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
import { getManufacturedResourceEffectSummary } from '../../systems/ManufacturedResourceEffects';
import {
  ECONOMIC_PRESSURE_LABEL,
  ECONOMIC_PRESSURE_REMOVAL_PRICE,
  ECONOMIC_PRESSURE_TYPES,
  type EconomicPressureType,
} from '../../data/economicPressure';
import { getResourceDisplayName } from '../../data/resources';
import {
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
} from '../../data/scienceVictory';
import type { City } from '../../entities/City';
import type { Nation } from '../../entities/Nation';
import type { Unit } from '../../entities/Unit';
import { calculateCityEconomy } from '../../systems/CityEconomy';
import type { CityManager } from '../../systems/CityManager';
import type { CityDefenseSystem } from '../../systems/CityDefenseSystem';
import type { CityTerritorySystem } from '../../systems/CityTerritorySystem';
import type { DiplomacyManager } from '../../systems/DiplomacyManager';
import { isEconomicPressureNegotiable } from '../../systems/diplomacy/EconomicPressureNegotiationService';
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
import type { ProductionPurchaseQuote } from '../../systems/ProductionPurchaseSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { CurrencySystem } from '../../systems/CurrencySystem';
import {
  CITY_OCCUPATION_GOLD_COST_PER_TURN,
  getCityIntegrationProgress,
} from '../../systems/CityIntegrationSystem';
import type { BuildImprovementPreview } from '../../systems/BuilderSystem';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { WonderSystem } from '../../systems/WonderSystem';
import type { WorldCouncilSystem } from '../../systems/WorldCouncilSystem';
import type { CapitulationSystem } from '../../systems/CapitulationSystem';
import {
  VASSAL_INDEPENDENCE_COST,
  type VassalIndependenceSystem,
} from '../../systems/diplomacy/VassalIndependenceSystem';
import { WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD } from '../../types/worldCouncil';
import type { CorporationSystem } from '../../systems/CorporationSystem';
import type { AerospacePartSystem } from '../../systems/AerospacePartSystem';
import type { TradeDealSystem } from '../../systems/TradeDealSystem';
import type { TradeConnectionSystem } from '../../systems/TradeConnectionSystem';
import type { HumanTradeDealWorkflow } from '../../systems/HumanTradeDealWorkflow';
import type { TradeConnection } from '../../types/tradeConnection';
import type { TradeDiplomacySystem } from '../../systems/diplomacy/TradeDiplomacySystem';
import type { ResourceAccessSystem } from '../../systems/ResourceAccessSystem';
import type { ResourceCitySearchResult, ResourceCitySearchSystem } from '../../systems/ResourceCitySearchSystem';
import type { StrategicResourceCapacitySystem } from '../../systems/StrategicResourceCapacitySystem';
import type { UnitUpkeepSystem } from '../../systems/UnitUpkeepSystem';
import type { GamesOfNationsSystem } from '../../systems/GamesOfNationsSystem';
import type { VictorySystem } from '../../systems/VictorySystem';
import { buildDominationRanking } from '../../systems/DominationRanking';
import { calculateUnitUpkeep } from '../../systems/UnitUpkeepSystem';
import {
  DEFAULT_LONG_TRADE_DEAL_DURATION,
  DEFAULT_SHORT_TRADE_DEAL_DURATION,
  resolveHumanTradeDealDurations,
  type HumanTradeDealDurations,
  type PendingTradeDeal,
  type TradeDeal,
} from '../../types/tradeDeal';
import type { Producible } from '../../types/producible';
import type { LeaderDefinition } from '../../types/leader';
import type { MapData, Tile } from '../../types/map';
import { EMPTY_MODIFIERS } from '../../types/modifiers';
import { getCitySpritePath, getCorporationSpritePath, getNaturalResourceSpritePath, getProjectSpritePath, getUnitSpritePath, getWonderSpritePath } from '../../utils/assetPaths';
import {
  CULTURAL_VICTORY_REQUIRED_CULTURE,
  CULTURAL_VICTORY_REQUIRED_WONDERS,
  OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
  getOwnedWonderCount,
} from '../../systems/CulturalVictory';
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
} from './RightSidebarPanelTypes';
import type { DiplomacyGraph, DiplomacyGraphEdge, DiplomacyGraphNode, DiplomacyRelationshipType } from './DiplomacyGraphTypes';
import { RafScheduler } from '../../utils/RafScheduler';
import { buildGamesOfNationsLeaderboardSections } from './GamesOfNationsLeaderboardContent';

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
/** Buy/Sell goods spread across this many columns (33/34/33) to use the width. */
const TRADING_GOODS_COLUMNS = 3;

export function buildLeaderDialogSection(
  leader: LeaderDefinition,
  isHumanLeader: boolean,
  isKnownToHuman: boolean,
  handlers: {
    arrangeAudience?: (leaderId: string) => void;
    arrangeGossip?: (leaderId: string) => void;
  },
): RightSidebarSection | undefined {
  if (isHumanLeader || !isKnownToHuman) return undefined;
  return {
    title: 'Dialog',
    rows: [
      {
        kind: 'button',
        text: `Arrange an audience with ${leader.name}`,
        accentColor: 0xf4d06f,
        onClick: () => handlers.arrangeAudience?.(leader.id),
      },
      {
        kind: 'button',
        text: `Gossip with ${leader.name}`,
        accentColor: 0xd9a441,
        onClick: () => handlers.arrangeGossip?.(leader.id),
      },
    ],
  };
}

interface LeaderboardEntry {
  nationId: string;
  name: string;
  color: number;
  score: number;
  detail: string;
  secondaryScore?: number;
}

export interface TradingNationTab {
  id: string;
  label: string;
  nationId: string;
  accentColor: number;
}

export class RightSidebarPanelDataProvider {
  private readonly scheduler = new RafScheduler();
  private readonly listeners: ChangedListener[] = [];
  private diplomacyManager: DiplomacyManager | null = null;
  private allianceManager: AllianceManager | null = null;
  private jointWarSystem: JointWarSystem | null = null;
  private jointWarProposal: {
    receiverNationId: string;
    kind: JointWarKind;
    targetNationId: string | null;
    offerExploitationRights: boolean;
  } | null = null;
  private getCurrentTurn: (() => number) | null = null;
  private diplomaticEvaluationSystem: DiplomaticEvaluationSystem | null = null;
  private borderPressureSystem: BorderPressureSystem | null = null;
  private militaryEvaluationSystem: AIMilitaryEvaluationSystem | null = null;
  private threatEvaluationSystem: AIMilitaryThreatEvaluationSystem | null = null;
  private discoverySystem: DiscoverySystem | null = null;
  private timelineService: HistoricalTimelineService | null = null;
  private researchSystem: ResearchSystem | null = null;
  private currencySystem: CurrencySystem | null = null;
  private cultureSystem: CultureSystem | null = null;
  private wonderSystem: WonderSystem | null = null;
  private worldCouncilSystem: WorldCouncilSystem | null = null;
  private capitulationSystem: CapitulationSystem | null = null;
  private vassalIndependenceSystem: VassalIndependenceSystem | null = null;
  private corporationSystem: CorporationSystem | null = null;
  private aerospacePartSystem: AerospacePartSystem | null = null;
  private requiredAerospaceParts = DEFAULT_REQUIRED_AEROSPACE_PARTS;
  private tradeDealSystem: TradeDealSystem | null = null;
  private tradeConnectionSystem: TradeConnectionSystem | null = null;
  private humanTradeDealWorkflow: HumanTradeDealWorkflow | null = null;
  private tradeDiplomacySystem: TradeDiplomacySystem | null = null;
  private resourceAccessSystem: ResourceAccessSystem | null = null;
  private resourceCitySearchSystem: ResourceCitySearchSystem | null = null;
  private detailsSearchQuery = '';
  private eraSystem: EraSystem | null = null;
  private gamesOfNationsSystem: GamesOfNationsSystem | null = null;
  private victorySystem: VictorySystem | null = null;
  private cityDefenseSystem: CityDefenseSystem | null = null;
  private populationCapacityProvider: ((cityId: string) => number) | null = null;
  private readonly tradingExportDestinations = new Map<string, string>();
  private readonly tradingExportDurations = new Map<string, number>();
  private readonly tradingImportDurations = new Map<string, number>();
  private tradingFeedback: string | null = null;
  private humanTradeDealDurations: HumanTradeDealDurations = {
    short: DEFAULT_SHORT_TRADE_DEAL_DURATION,
    long: DEFAULT_LONG_TRADE_DEAL_DURATION,
  };
  private canFoundCity: ((unit: Unit) => boolean) | null = null;
  private foundCity: ((unit: Unit) => void) | null = null;
  private builderHintProvider: BuilderHintProvider | null = null;
  private buildingPlacementRequestHandler: BuildingPlacementRequestHandler | null = null;
  private wonderPlacementRequestHandler: WonderPlacementRequestHandler | null = null;
  private wonderPlacementAvailabilityProvider: WonderPlacementAvailabilityProvider | null = null;
  private buyProductionRequestHandler: BuyProductionRequestHandler | null = null;
  private productionPurchaseQuoteProvider: ((cityId: string, index: number) => ProductionPurchaseQuote) | null = null;
  private arrangeAudienceHandler: ((leaderId: string) => void) | null = null;
  private arrangeGossipHandler: ((leaderId: string) => void) | null = null;
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

  setCurrencySystem(currencySystem: CurrencySystem): void {
    this.currencySystem = currencySystem;
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

  setCapitulationSystem(capitulationSystem: CapitulationSystem): void {
    this.capitulationSystem = capitulationSystem;
  }

  setVassalIndependenceSystem(system: VassalIndependenceSystem): void {
    this.vassalIndependenceSystem = system;
  }

  setCorporationSystem(corporationSystem: CorporationSystem): void {
    this.corporationSystem = corporationSystem;
  }

  setAerospacePartSystem(system: AerospacePartSystem, requiredAerospaceParts: number): void {
    this.aerospacePartSystem = system;
    this.requiredAerospaceParts = requiredAerospaceParts;
  }

  setTradeDealSystem(tradeDealSystem: TradeDealSystem): void {
    this.tradeDealSystem = tradeDealSystem;
  }

  setTradeConnectionSystem(system: TradeConnectionSystem): void {
    this.tradeConnectionSystem = system;
  }

  setHumanTradeDealWorkflow(workflow: HumanTradeDealWorkflow): void {
    this.humanTradeDealWorkflow = workflow;
    workflow.onPendingDealResolved((event) => {
      this.tradingFeedback = event.outcome === 'activated'
        ? 'Trade route established — deal is now Active.'
        : event.reason ?? 'Pending trade deal ended.';
      this.requestRefresh();
    });
  }

  setHumanTradeDealDurations(shortDuration: number, longDuration: number): void {
    this.humanTradeDealDurations = resolveHumanTradeDealDurations(shortDuration, longDuration);
    this.tradingExportDurations.clear();
    this.tradingImportDurations.clear();
    this.requestRefresh();
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

  setGamesOfNationsSystem(system: GamesOfNationsSystem): void {
    this.gamesOfNationsSystem = system;
  }

  setVictorySystem(system: VictorySystem): void {
    this.victorySystem = system;
  }

  setCityDefenseSystem(system: CityDefenseSystem): void {
    this.cityDefenseSystem = system;
  }

  setPopulationCapacityProvider(provider: (cityId: string) => number): void {
    this.populationCapacityProvider = provider;
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

  setProductionPurchaseQuoteProvider(
    provider: (cityId: string, index: number) => ProductionPurchaseQuote,
  ): void {
    this.productionPurchaseQuoteProvider = provider;
  }

  setFoundCityHandler(canFoundCity: (unit: Unit) => boolean, foundCity: (unit: Unit) => void): void {
    this.canFoundCity = canFoundCity;
    this.foundCity = foundCity;
  }

  setArrangeAudienceHandler(handler: (leaderId: string) => void): void {
    this.arrangeAudienceHandler = handler;
  }

  setArrangeGossipHandler(handler: (leaderId: string) => void): void {
    this.arrangeGossipHandler = handler;
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
    if (category === 'gon') {
      return {
        title: 'Leaderboard',
        sections: buildGamesOfNationsLeaderboardSections(
          this.gamesOfNationsSystem?.getHistoricalMedalStandings() ?? [],
          this.gamesOfNationsSystem?.getCompletedGames() ?? [],
        ),
      };
    }
    const section = this.getLeaderboardSectionByCategory(category);
    return {
      title: 'Leaderboard',
      sections: [section],
    };
  }

  /** Trade partners = foreign nations with active Trade Relations, alphabetised. */
  private getTradePartners(): Nation[] {
    if (!this.humanNationId || !this.diplomacyManager) return [];
    const humanId = this.humanNationId;
    return this.nationManager.getAllNations()
      .filter((nation) => nation.id !== humanId && this.diplomacyManager!.hasTradeRelations(humanId, nation.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Overview tab — the at-a-glance summary plus the live trade activity feed. */
  getTradingOverviewContent(): RightSidebarContent {
    if (!this.humanNationId || !this.tradeDealSystem || !this.humanTradeDealWorkflow || !this.diplomacyManager) {
      return { title: 'Trading', sections: [{ title: 'Overview', rows: [textRow('Trade system unavailable.', true)] }] };
    }
    const humanId = this.humanNationId;
    const tradePartners = this.getTradePartners();
    const activeDeals = this.tradeDealSystem.getDealsForNation(humanId);
    const imports = activeDeals.filter((deal) => deal.buyerNationId === humanId);
    const exports = activeDeals.filter((deal) => deal.sellerNationId === humanId);
    const balance = this.tradeDealSystem.getGoldPerTurnDeltaForNation(humanId);
    const signedBalance = `${balance >= 0 ? '+' : ''}${balance}`;

    const sections: RightSidebarSection[] = [{
      title: 'Overview',
      rows: [{
        kind: 'compactTable',
        columns: [
          { label: 'Trade Relations', weight: 1.3, align: 'center' },
          { label: 'Active Deals', weight: 1, align: 'center' },
          { label: 'Imports', weight: 0.8, align: 'center' },
          { label: 'Exports', weight: 0.8, align: 'center' },
          { label: 'Balance', weight: 1, align: 'center' },
        ],
        rows: [[String(tradePartners.length), String(activeDeals.length), String(imports.length), String(exports.length), `${signedBalance}g/turn`]],
      }],
    }];
    if (tradePartners.length === 0) {
      sections.push({
        title: 'International trade',
        rows: [textRow('No Trade Relations established.', true), textRow('Establish Trade Relations through Diplomacy to begin international trade.', true)],
      });
    }
    sections.push({ title: 'Current trade activity', rows: this.buildTradingActivityRows() });
    return { title: 'Trading', sections };
  }

  /** Buy tab — only the foreign goods that can actually be bought, in a 3-up grid. */
  getTradingBuyContent(): RightSidebarContent {
    if (!this.resourceAccessSystem || !this.tradeDealSystem || !this.humanNationId) {
      return { title: 'Trading', sections: [{ title: 'Goods available to buy', rows: [textRow('Trade system unavailable.', true)] }] };
    }
    const cells = this.buildTradingBuyCells(this.getTradePartners());
    const rows: RightSidebarRow[] = cells.length > 0
      ? [{ kind: 'grid', columns: TRADING_GOODS_COLUMNS, cells }]
      : [textRow('No foreign goods currently available to buy.', true)];
    return { title: 'Trading', sections: [{ title: 'Goods available to buy', rows }] };
  }

  /** Sell tab — only the goods that can actually be sold, in a 3-up grid. */
  getTradingSellContent(): RightSidebarContent {
    if (!this.resourceAccessSystem || !this.humanNationId || !this.humanTradeDealWorkflow) {
      return { title: 'Trading', sections: [{ title: 'Goods available to sell', rows: [textRow('Trade system unavailable.', true)] }] };
    }
    const cells = this.buildTradingSellCells(this.getTradePartners());
    const rows: RightSidebarRow[] = cells.length > 0
      ? [{ kind: 'grid', columns: TRADING_GOODS_COLUMNS, cells }]
      : [textRow('No goods can be sold right now.', true)];
    return { title: 'Trading', sections: [{ title: 'Goods available to sell', rows }] };
  }

  getTradingNationTabs(): TradingNationTab[] {
    if (!this.humanNationId || !this.diplomacyManager) return [];
    return this.nationManager.getAllNations()
      .filter((nation) => nation.id !== this.humanNationId
        && this.diplomacyManager!.hasTradeRelations(this.humanNationId!, nation.id))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((nation) => ({
        id: `nation:${nation.id}`,
        label: nation.name,
        nationId: nation.id,
        accentColor: nation.color,
      }));
  }

  getTradingNationContent(nationId: string): RightSidebarContent {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || !this.humanNationId || !this.diplomacyManager
      || !this.diplomacyManager.hasTradeRelations(this.humanNationId, nationId)
      || !this.tradeDealSystem || !this.humanTradeDealWorkflow || !this.tradeConnectionSystem) {
      return this.getTradingOverviewContent();
    }

    const humanId = this.humanNationId;
    const bilateralDeals = this.tradeDealSystem.getDealsBetween(humanId, nationId);
    const exports = bilateralDeals.filter((deal) => deal.sellerNationId === humanId);
    const imports = bilateralDeals.filter((deal) => deal.buyerNationId === humanId);
    const pending = this.humanTradeDealWorkflow.getPendingDeals().filter((deal) =>
      (deal.sellerNationId === humanId && deal.buyerNationId === nationId)
      || (deal.sellerNationId === nationId && deal.buyerNationId === humanId));
    const routes = this.tradeConnectionSystem.getAllConnections().filter((route) =>
      (route.nationAId === humanId && route.nationBId === nationId)
      || (route.nationAId === nationId && route.nationBId === humanId));
    const exportGold = exports.reduce((sum, deal) => sum + deal.goldPerTurn, 0);
    const importGold = imports.reduce((sum, deal) => sum + deal.goldPerTurn, 0);
    const netGold = exportGold - importGold;

    return {
      title: 'Trading',
      sections: [
        {
          title: nation.name,
          rows: [{
            kind: 'compactTable',
            columns: [
              { label: 'Trade Relations', weight: 1.4, align: 'center' },
              { label: 'Active Deals', weight: 1, align: 'center' },
              { label: 'Imports', weight: 0.8, align: 'center' },
              { label: 'Exports', weight: 0.8, align: 'center' },
              { label: 'Balance', weight: 1, align: 'center' },
            ],
            rows: [['Active', String(bilateralDeals.length), String(imports.length), String(exports.length), `${formatSigned(netGold)}g/turn`]],
          }],
        },
        // Left column: what is actually flowing (Imports, Exports, Pending).
        { title: 'Imports', column: 'left', rows: this.buildTradingNationImportRows(nation.name, imports) },
        { title: 'Exports', column: 'left', rows: this.buildTradingNationExportRows(nation.name, exports) },
        { title: 'Pending', column: 'left', rows: this.buildTradingNationPendingRows(pending) },
        // Right column: the infrastructure and totals behind it.
        { title: 'Trade Routes', column: 'right', rows: this.buildTradingNationRouteRows(routes) },
        { title: 'Trade Capacity', column: 'right', rows: this.buildTradingNationCapacityRows(nationId) },
        {
          title: 'Bilateral Trade Value',
          column: 'right',
          rows: [
            textRow(`Exports: +${exportGold} gold/turn`),
            textRow(`Imports: -${importGold} gold/turn`),
            textRow(`Net: ${formatSigned(netGold)} gold/turn`, false, true),
          ],
        },
      ],
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
    // A foreign-owned resource improvement (Foreign Resource Exploitation Rights):
    // the improvement belongs to another nation while the tile's territory does
    // not change owner. Surface both so the split ownership is understandable.
    if (improvement) {
      const improvementOwnerId = getImprovementOwnerId(tile);
      if (improvementOwnerId && improvementOwnerId !== tile.ownerId) {
        const improvementOwner = this.nationManager.getNation(improvementOwnerId);
        rows.push(textRow(`Improvement owner: ${improvementOwner?.name ?? improvementOwnerId}`, false, false, improvementOwner?.color));
        if (owner) rows.push(textRow(`Territory: ${owner.name}`, false, false, owner.color));
      }
    }
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
    const integration = getCityIntegrationProgress(city, this.getCurrentTurn?.() ?? 0);
    const integrationLabel = integration.state[0].toUpperCase() + integration.state.slice(1);
    const growthModifier = this.happinessSystem.getGrowthModifier(city.ownerId);
    const effectiveGrowthPerTurn = economy.netFood > 0 ? Math.floor(economy.netFood * growthModifier) : economy.netFood;
    const turnsUntilGrowth = effectiveGrowthPerTurn > 0
      ? Math.ceil((economy.foodToGrow - city.foodStorage) / effectiveGrowthPerTurn)
      : null;
    const fortificationDefensePercent = this.cityDefenseSystem?.getFortificationDefensePercent(city) ?? 0;
    const effectiveCityDefense = this.cityDefenseSystem?.getEffectiveDefense(city) ?? CITY_BASE_DEFENSE;
    const defenseLabel = fortificationDefensePercent > 0
      ? `Defense: ${effectiveCityDefense} (Fortifications +${fortificationDefensePercent}%)`
      : `Defense: ${effectiveCityDefense}`;

    switch (tab) {
      case 'city':
        return {
          title: 'Details',
          sections: [{
        title: 'City',
        rows: [
          textRow(city.name, false, true, nation?.color),
          textRow(`Owner: ${nation?.name ?? 'Unknown'}`),
          textRow(`Status: ${integrationLabel}`),
          ...(integration.state !== 'integrated'
            ? [textRow(`Integration: ${integration.turnsInState} / ${integration.phaseTurns} turns`)]
            : []),
          ...(integration.state === 'occupied'
            ? [textRow(`Occupation cost: ${CITY_OCCUPATION_GOLD_COST_PER_TURN} gold/turn`, true)]
            : []),
          textRow(`Capital: ${city.isCapital ? 'Yes' : 'No'}`),
          textRow(`Population: ${city.population} / ${this.populationCapacityProvider?.(city.id) ?? '?'}`),
          textRow(`Health: ${city.health}/${CITY_BASE_HEALTH}`),
          progressRow('Health', city.health, CITY_BASE_HEALTH),
          textRow(`Tile position: ${city.tileX}, ${city.tileY}`),
          textRow(defenseLabel),
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
                ...(integration.state !== 'integrated'
                  ? [textRow(`${integrationLabel} city output: ${Math.round(integration.outputMultiplier * 100)}%`, true)]
                  : []),
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
          ...(happiness.unhappinessFromMilitary > 0
            ? [textRow(`Military units: -${happiness.unhappinessFromMilitary}`)] : []),
          ...(happiness.unhappinessFromMilitaryOverCap > 0
            ? [textRow(`Military Over Capacity: -${happiness.unhappinessFromMilitaryOverCap}`)] : []),
          ...(happiness.unhappinessFromConqueredCities > 0
            ? [textRow(`Conquered cities: -${happiness.unhappinessFromConqueredCities}`)] : []),
          ...(happiness.unhappinessFromEnergyShortages > 0
            ? [textRow(`Energy Shortages: -${happiness.unhappinessFromEnergyShortages}`)] : []),
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
        const summary = getManufacturedResourceEffectSummary(entry.resourceId);
        const effect = summary ? ` — ${summary}` : '';
        return textRow(`${resource?.name ?? entry.resourceId}: ${entry.quantity}${effect}`);
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
      case 'economics':
        return this.getLeaderEconomicsContent(leader);
    }
  }

  private getLeaderDetailsContent(leader: LeaderDefinition): RightSidebarContent {
    const nation = this.nationManager.getNation(leader.nationId);
    const resources = this.nationManager.getResources(leader.nationId);
    const ideologyRows = this.getLeaderIdeologyRows(leader.nationId);
    const sections: RightSidebarSection[] = [];
    const dialogSection = buildLeaderDialogSection(
      leader,
      leader.nationId === this.humanNationId,
      this.isNationKnown(leader.nationId),
      {
        arrangeAudience: (leaderId) => this.arrangeAudienceHandler?.(leaderId),
        arrangeGossip: (leaderId) => this.arrangeGossipHandler?.(leaderId),
      },
    );
    if (dialogSection) sections.push(dialogSection);
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

  private getLeaderEconomicsContent(leader: { nationId: string }): RightSidebarContent {
    const nationId = leader.nationId;
    if (nationId !== this.humanNationId && !this.isNationKnown(nationId)) {
      return {
        title: 'Leader Details',
        sections: [{ title: 'Economics', rows: [textRow('You have not met this nation.', true)] }],
      };
    }

    const resources = this.nationManager.getResources(nationId);
    const unitUpkeep = this.unitUpkeepSystem?.calculateUpkeep(nationId) ?? 0;
    const currency = this.currencySystem?.getCurrencyState(nationId);
    const foundedCorporations = this.corporationSystem?.getFoundedCorporationsForNation(nationId) ?? [];

    const corporationRows = foundedCorporations.map((founded) => {
      const definition = CORPORATIONS.find((entry) => entry.id === founded.corporationId);
      const headquarters = founded.cityId ? this.cityManager.getCity(founded.cityId) : undefined;
      const manufacturedGood = definition
        ? getManufacturedResourceById(definition.manufacturedResourceId)
        : undefined;
      const details = [
        headquarters ? `HQ: ${headquarters.name}` : 'Headquarters not recorded',
        manufacturedGood ? `Produces: ${manufacturedGood.name}` : undefined,
      ].filter((entry): entry is string => entry !== undefined).join(' · ');
      return textRow(
        `${definition?.name ?? founded.corporationId} — ${details}`,
        false,
        false,
        undefined,
        getCorporationSpritePath(founded.corporationId),
      );
    });

    const naturalResourceRows = (this.resourceAccessSystem?.getAvailableResources(nationId) ?? [])
      .map((resourceId) => {
        const resource = getNaturalResourceById(resourceId);
        if (!resource) return undefined;
        const quantity = this.resourceAccessSystem?.getResourceSourceCount(nationId, resourceId) ?? 0;
        if (quantity <= 0) return undefined;
        return { resource, quantity };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
      .sort((a, b) => a.resource.name.localeCompare(b.resource.name))
      .map(({ resource, quantity }) => textRow(
        `${resource.name} ×${quantity}`,
        false,
        false,
        undefined,
        getNaturalResourceSpritePath(resource.id),
      ));

    const manufacturedResourceRows = (this.resourceAccessSystem
      ?.getAvailableManufacturedResourceQuantities(nationId) ?? [])
      .map((entry) => {
        const resource = getManufacturedResourceById(entry.resourceId);
        return textRow(`${resource?.name ?? entry.resourceId} ×${entry.quantity}`);
      });

    return {
      title: 'Leader Details',
      sections: [
        {
          title: 'Treasury',
          rows: [
            textRow(`Gold: ${resources.gold.toLocaleString()}`, false, true),
            textRow(`Gold per turn: ${formatSigned(resources.goldPerTurn)}`),
            textRow(`Unit upkeep per turn: ${formatSigned(-unitUpkeep)}`),
            textRow(`Net gold per turn: ${formatSigned(resources.goldPerTurn - unitUpkeep)}`),
          ],
        },
        {
          title: 'Currency',
          rows: currency
            ? [
              textRow(`${currency.currencyName} (${currency.currencySymbol})`, false, true),
              textRow(`Strength: ${currency.strength}`),
            ]
            : [textRow('No established currency.', true)],
        },
        {
          title: `Corporations (${foundedCorporations.length})`,
          rows: corporationRows.length > 0 ? corporationRows : [textRow('None founded.', true)],
        },
        {
          title: 'Natural Resources',
          rows: naturalResourceRows.length > 0 ? naturalResourceRows : [textRow('None available.', true)],
        },
        {
          title: 'Manufactured Goods',
          rows: manufacturedResourceRows.length > 0
            ? manufacturedResourceRows
            : [textRow('None available.', true)],
        },
      ],
    };
  }

  private getProductionQueueSection(city: City, isHuman: boolean): RightSidebarSection {
    const queue = this.getVisibleProductionQueue(city.id);
    if (queue.length === 0) return { title: 'Production Queue', rows: [textRow('No production queued', true)] };
    const rows: RightSidebarRow[] = [];
    const availableGold = isHuman ? this.nationManager.getResources(city.ownerId).gold : 0;
    queue.forEach(({ entry, index }, visibleIndex) => {
      const name = getProducibleName(entry.item);
      const spritePath = getProducibleSpritePath(entry.item);
      // Repeatable projects never complete — show the continuous gold result
      // instead of turns/progress.
      const isProject = entry.item.kind === 'project';
      const projectGold = isProject ? this.productionSystem.getProjectGoldPerTurn(city.id) ?? 0 : 0;
      const turnsText = isProject
        ? `+${projectGold} Gold / turn`
        : entry.blockedReason ? 'blocked' : `${entry.turnsRemaining} turn${entry.turnsRemaining !== 1 ? 's' : ''}`;
      const label = `${visibleIndex + 1}. ${name} (${turnsText})${index === 0 ? ' [active]' : ''}`;
      rows.push(isHuman
        ? buttonRow(label, () => {
          this.productionSystem.removeFromQueue(city.id, index);
          this.requestRefresh();
        }, 0xb86767, '🗑️', spritePath)
        : textRow(label, false, false, undefined, spritePath));
      if (isHuman) {
        const quote = this.productionPurchaseQuoteProvider?.(city.id, index);
        const buyCost = quote?.cost ?? this.productionSystem.getBuyCost(city.id, index);
        if (buyCost !== null) {
          const canBuy = quote ? quote.ok : availableGold >= buyCost;
          const buyLabel = canBuy
            ? `💰 Buy for ${buyCost} gold`
            : quote && !quote.ok && quote.reason !== 'Insufficient gold'
              ? `💰 ${quote.reason}`
              : `💰 Need ${Math.max(0, buyCost - availableGold)} more gold`;
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
      if (index === 0 && !entry.blockedReason && !isProject) rows.push(progressRow('Progress', entry.progress, entry.cost));
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
    const queuedBuildingIds = new Set(
      this.productionSystem.getQueue(city.id)
        .filter((entry) => entry.item.kind === 'building')
        .map((entry) => entry.item.kind === 'building' ? entry.item.buildingType.id : ''),
    );
    for (const unitType of ALL_UNIT_TYPES) {
      if (this.researchSystem && !this.researchSystem.isUnitUnlocked(city.ownerId, unitType.id)) continue;
      const item: Producible = { kind: 'unit', unitType };
      const productionBlockReason = this.productionSystem.getItemProductionBlockReason(city.id, item);
      const disabledReason = productionBlockReason
        ?? getCityUnitProductionBlockReason(
        city,
        unitType,
        this.mapData,
        this.gridSystem,
        {
          strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
          unitUpkeepAffordability: this.unitUpkeepSystem,
          upkeepAffordabilityTurns: 10,
          getNationEra: (nationId) => this.eraSystem?.getNationEra(nationId) ?? 'ancient',
          getUnitProductionRestrictionReason: (nationId, unitTypeId) =>
            this.worldCouncilSystem?.getUnitProductionRestrictionReason(nationId, unitTypeId),
        },
      );
      if (
        disabledReason
        && !productionBlockReason
        && !unitType.requiredResource
        && !isUnitUpkeepAffordabilityReason(disabledReason)
      ) continue;
      rows.push({
        kind: 'button',
        text: disabledReason
          ? `${getProducibleName(item)} (${this.productionSystem.getCost(item, city.id)}) - ${disabledReason}`
          : `${getProducibleName(item)} (${this.productionSystem.getCost(item, city.id)})`,
        disabled: disabledReason !== undefined,
        accentColor: 0x6aa7d8,
        spritePath: getProducibleSpritePath(item),
        onClick: () => {
          if (
            this.productionSystem.getItemProductionBlockReason(city.id, item) !== undefined
            || !canCityProduceUnit(
            city,
            unitType,
            this.mapData,
            this.gridSystem,
            {
              strategicResourceCapacitySystem: this.strategicResourceCapacitySystem,
              unitUpkeepAffordability: this.unitUpkeepSystem,
              upkeepAffordabilityTurns: 10,
              getNationEra: (nationId) => this.eraSystem?.getNationEra(nationId) ?? 'ancient',
              getUnitProductionRestrictionReason: (nationId, unitTypeId) =>
                this.worldCouncilSystem?.getUnitProductionRestrictionReason(nationId, unitTypeId)
                ?? this.capitulationSystem?.getMilitaryProductionBlockReason(nationId, unitTypeId),
            },
          )) return;
        this.productionSystem.enqueue(city.id, item);
        this.requestRefresh();
        },
      });
    }
    rows.push({ kind: 'separator' });
    const availableBuildings = this.gamesOfNationsSystem?.canCityConstructGrandStadium(city.id, city.ownerId)
      ? [...ALL_BUILDINGS, GRAND_STADIUM]
      : ALL_BUILDINGS;
    for (const buildingType of availableBuildings) {
      if (this.cityManager.getBuildings(city.id).has(buildingType.id)) continue;
      if (reservedBuildingIds.has(buildingType.id)) continue;
      if (queuedBuildingIds.has(buildingType.id)) continue;
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

    const aerospacePartSystem = this.aerospacePartSystem;
    if (aerospacePartSystem) {
      const item: Producible = {
        kind: 'manufacturedResource',
        productionType: AEROSPACE_PART_PRODUCTION,
      };
      const queuedHere = this.productionSystem.getQueue(city.id).some((entry) => (
        entry.item.kind === 'manufacturedResource'
          && entry.item.productionType.id === AEROSPACE_PARTS_ID
      ));
      const blockers = aerospacePartSystem.getCityProductionBlockers(city);
      const reason = queuedHere ? 'Already in this queue' : blockers.join(', ') || undefined;
      const turns = this.productionSystem.getTurnsEstimate(city.id, item);
      rows.push({
        kind: 'button',
        text: `${AEROSPACE_PART_PRODUCTION.name} (${turns}) — ${aerospacePartSystem.getQuantity(city.ownerId)}/${this.requiredAerospaceParts}${reason ? ` — ${reason}` : ''}`,
        disabled: reason !== undefined,
        accentColor: 0x8fb9d9,
        spritePath: getCorporationSpritePath(AEROSPACE_PARTS_ID),
        onClick: () => {
          if (reason || !aerospacePartSystem.canCityProduce(city)) return;
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
    const currency = this.currencySystem?.getCurrencyState(nationId);
    return {
      title: 'Nation',
      rows: [
        textRow(nation.name, false, true, nation.color),
        ...(era ? [textRow(`Era: ${formatEraLabel(era)}`)] : []),
        textRow(`Capital: ${capital?.name ?? 'none'}`),
        textRow(currency
          ? `Currency: ${currency.currencyName} (${currency.currencySymbol}) — ${currency.strength}`
          : 'Currency: Not established'),
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
        textRow(`Land control: ${this.nationManager.getLandTilePercent(nationId, this.mapData).toFixed(1)}% of land tiles`),
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
    const humanHostId = dm.getVassalHost(humanId);
    const targetHostId = dm.getVassalHost(nationId);
    if (targetHostId === humanId) rows.push(textRow('Vassal State: Your vassal'));
    else if (humanHostId === nationId) rows.push(textRow('Host State: Your overlord'));
    else if (targetHostId) {
      rows.push(textRow(`Vassal State: Subject of ${this.nationManager.getNation(targetHostId)?.name ?? targetHostId}`));
    }
    rows.push(textRow(`Open Borders: ${humanGrantsBorders ? 'Open' : 'Closed'}`));
    rows.push(textRow(`Your Embassy: ${hasHumanEmbassy ? 'Established' : 'Not established'}`));
    rows.push(textRow(`Their Embassy: ${hasTheirEmbassy ? 'Established' : 'Not established'}`));
    rows.push(textRow(`Trade Relations: ${hasTradeRelations ? 'Active' : 'Inactive'}`));
    if (peaceTreatyRemaining > 0) {
      rows.push(textRow(`Peace Treaty: ${peaceTreatyRemaining} turn${peaceTreatyRemaining === 1 ? '' : 's'} remaining`));
    }
    const exploitationRows = this.getExploitationRightsStatusRows(nationId);
    if (exploitationRows.length > 0) {
      rows.push(textRow('Resource Exploitation:', false, true));
      rows.push(...exploitationRows);
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
    const humanHostId = dm.getVassalHost(humanId);
    const targetHostId = dm.getVassalHost(nationId);
    if (targetHostId === humanId) rows.push(textRow('Your Vassal State'));
    else if (humanHostId === nationId) rows.push(textRow('Your Host State'));
    else if (targetHostId) {
      rows.push(textRow(`Vassal of ${this.nationManager.getNation(targetHostId)?.name ?? targetHostId}`));
    }
    const alliance = this.allianceManager?.getAllianceForNation(humanId);
    if (alliance && this.allianceManager?.areAllied(humanId, nationId)) {
      rows.push(textRow(`Allied — ${alliance.name}`));
    }
    if (dm.isOpenBorderGrantedFrom(humanId, nationId)) rows.push(textRow('Open Borders granted'));
    if (dm.hasEmbassy(humanId, nationId)) rows.push(textRow('Embassy established'));
    if (dm.hasTradeRelations(humanId, nationId)) rows.push(textRow('Trade Relations active'));
    const humanPressure = dm.getEconomicPressure(humanId, nationId);
    const targetPressure = dm.getEconomicPressure(nationId, humanId);
    rows.push(textRow(`Your sanction: ${humanPressure ? ECONOMIC_PRESSURE_LABEL[humanPressure] : 'None'}`));
    if (targetPressure) rows.push(textRow(`Their sanction: ${ECONOMIC_PRESSURE_LABEL[targetPressure]}`));
    rows.push(...this.getExploitationRightsStatusRows(nationId));
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
    const isAtWar = relation.state === 'WAR';
    const rows: RightSidebarRow[] = [];

    // While at war, peacetime diplomacy actions are filtered out entirely (item 5):
    // no disabled buttons and no "Unavailable during war." text. Only actions that
    // remain usable during war are shown, leaving room for future war-specific ones.
    if (!isAtWar) {
      rows.push(disabledReasonButtonRow(
        humanGrantsBorders ? 'Cancel Open Borders' : 'Open Borders',
        undefined,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'toggleOpenBorders', targetNationId: nationId },
          }));
        },
        nation?.color,
      ));
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
      if (!hasTradeRelations) {
        rows.push(disabledReasonButtonRow(
          'Establish Trade Relations',
          tradeValidation.reason,
          () => {
            document.dispatchEvent(new CustomEvent('diplomacyAction', {
              detail: { action: 'establishTradeRelations', targetNationId: nationId },
            }));
          },
          nation?.color,
        ));
      }
      if (!hasTradeRelations && tradeValidation.reason) rows.push(textRow(tradeValidation.reason, true));

      rows.push(textRow('Economic sanctions', false, true));
      const currentPressure = dm.getEconomicPressure(humanId, nationId);
      rows.push(buildEconomicPressureButtonGroup(dm, humanId, nationId, nation?.color, (type) => {
        document.dispatchEvent(new CustomEvent('diplomacyAction', {
          detail: { action: 'economicPressure', targetNationId: nationId, economicPressureType: type },
        }));
      }));
      rows.push(textRow(
        currentPressure
          ? `${ECONOMIC_PRESSURE_LABEL[currentPressure]} active — select it again to lift.`
          : 'No active sanction.',
        true,
      ));
      const removalRow = buildEconomicPressureRemovalRow(
        dm,
        humanId,
        nationId,
        this.getCurrentTurn?.() ?? 0,
        this.nationManager.getResources(humanId).gold,
        nation?.color,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'negotiateEconomicPressureRemoval', targetNationId: nationId },
          }));
        },
      );
      if (removalRow) rows.push(removalRow);
      // Exchange Maps: one-time intelligence sharing. Tied directly to Writing —
      // it only requires that the human knows Writing and the two nations have met.
      // AI acceptance (handled elsewhere) still depends on attitude.
      const exchangeMapsReason = !validationContext.haveMet(humanId, nationId)
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
      rows.push(...this.buildExploitationRightsTradeRows(nationId, nation?.color));
    }
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
    if (!isAtWar) {
      rows.push(...this.buildAllianceActionRows(nationId, nation?.color));
      rows.push(...this.buildJointWarActionRows(nationId, nation?.color));
    }
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
    const ownVassalReason = dm.getVassalHost(nationId) === humanId
      ? 'A host cannot declare war on its own vassal state.'
      : undefined;
    const vassalWarReason = dm.isVassal(humanId)
      ? 'A vassal state cannot declare war.'
      : undefined;
    const warPeaceReason = relation.state === 'PEACE'
      ? (vassalWarReason ?? ownVassalReason ?? alliancePartnerReason ?? peaceTreatyReason)
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
    if (ownVassalReason) rows.push(textRow(ownVassalReason, true));
    if (vassalWarReason) rows.push(textRow(vassalWarReason, true));
    if (peaceTreatyReason && !alliancePartnerReason && !ownVassalReason && !vassalWarReason) rows.push(textRow(peaceTreatyReason, true));
    if (peaceUnavailableReason) rows.push(textRow(peaceUnavailableReason, true));
    if (!isAtWar && dm.getVassalHost(nationId) === humanId) {
      rows.push(disabledReasonButtonRow(
        'Release Vassal',
        undefined,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'releaseVassal', targetNationId: nationId },
          }));
        },
        nation?.color,
      ));
    }
    if (!isAtWar && dm.getVassalHost(humanId) === nationId && this.vassalIndependenceSystem) {
      const eligibility = this.vassalIndependenceSystem.canBuyIndependence(humanId);
      rows.push(disabledReasonButtonRow(
        `Buy Independence – ${VASSAL_INDEPENDENCE_COST.toLocaleString('en-US')} Gold`,
        eligibility.ok ? undefined : eligibility.reason,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'buyIndependence', targetNationId: nationId },
          }));
        },
        nation?.color,
      ));
      if (!eligibility.ok && eligibility.reason) rows.push(textRow(eligibility.reason, true));
    }
    // Demand Capitulation: a separate, more severe wartime action, shown only when
    // the target's position is dire enough that surrender is plausible.
    if (isAtWar && this.capitulationSystem?.canDemandCapitulation(humanId, nationId)) {
      rows.push(disabledReasonButtonRow(
        'Demand Capitulation',
        undefined,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'demandCapitulation', targetNationId: nationId },
          }));
        },
        0x9c3b3b,
      ));
    }
    // A human nation is never silently auto-capitulated. When the opposing
    // nation could successfully demand surrender, the human may choose it here
    // and continues playing as that nation's vassal.
    if (isAtWar && this.capitulationSystem?.evaluateCapitulationDemand(nationId, humanId).accepted) {
      rows.push(disabledReasonButtonRow(
        'Capitulate',
        undefined,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'capitulate', targetNationId: nationId },
          }));
        },
        0x9c3b3b,
      ));
    }
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
            this.jointWarProposal = { receiverNationId, kind, targetNationId: null, offerExploitationRights: false };
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

    // Optional sweetener: the human offers the receiver exploitation rights in the
    // human's own territory. Only when the human has Colonialism and does not
    // already grant the receiver those rights; introduced by the human.
    const canOfferExploitation = this.diplomacyManager?.canUseExploitationRights(humanId) === true
      && !this.diplomacyManager.hasExploitationRights(receiverNationId, humanId);
    if (canOfferExploitation) {
      rows.push({ kind: 'separator' });
      rows.push({
        kind: 'button',
        text: 'Offer Resource Exploitation Rights',
        selected: proposal.offerExploitationRights,
        accentColor,
        onClick: () => {
          if (this.jointWarProposal) {
            this.jointWarProposal = {
              ...this.jointWarProposal,
              offerExploitationRights: !this.jointWarProposal.offerExploitationRights,
            };
            this.requestRefresh();
          }
        },
      });
      if (proposal.offerExploitationRights) {
        rows.push(textRow('You will grant them exploitation rights in your territory if they accept.', true));
      }
    }

    rows.push({ kind: 'separator' });
    const chosenTargetId = proposal.targetNationId;
    const offerExploitationRights = proposal.offerExploitationRights;
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
            offerExploitationRights,
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

  /**
   * Resource Exploitation Rights as a peacetime Trade Deal concession. The human
   * always introduces the term, so the Colonialism gate falls on the human. Two
   * independent directional options are exposed:
   *   - "Grant …": the human opens its own territory to the other nation.
   *   - "Request …": the human asks the other nation to open its territory.
   * Each is disabled (with an existing-style reason) when the human lacks
   * Colonialism or when that exact directional right already exists.
   */
  private buildExploitationRightsTradeRows(nationId: string, accentColor?: number): RightSidebarRow[] {
    if (!this.diplomacyManager || !this.humanNationId) return [];
    const dm = this.diplomacyManager;
    const humanId = this.humanNationId;
    const hasColonialism = dm.canUseExploitationRights(humanId);
    const colonialismReason = hasColonialism ? undefined : 'Requires Colonialism.';

    // Grant own rights: beneficiary = other nation, grantor = human.
    const alreadyGranted = dm.hasExploitationRights(nationId, humanId);
    const grantReason = colonialismReason
      ?? (alreadyGranted ? 'They already hold these rights.' : undefined);
    // Request foreign rights: beneficiary = human, grantor = other nation.
    const alreadyHeld = dm.hasExploitationRights(humanId, nationId);
    const requestReason = colonialismReason
      ?? (alreadyHeld ? 'You already hold these rights.' : undefined);

    const rows: RightSidebarRow[] = [
      disabledReasonButtonRow(
        'Grant Resource Exploitation Rights',
        grantReason,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'grantExploitationRights', targetNationId: nationId },
          }));
        },
        accentColor,
      ),
      disabledReasonButtonRow(
        'Request Resource Exploitation Rights',
        requestReason,
        () => {
          document.dispatchEvent(new CustomEvent('diplomacyAction', {
            detail: { action: 'requestExploitationRights', targetNationId: nationId },
          }));
        },
        accentColor,
      ),
    ];
    if (grantReason && grantReason === colonialismReason) rows.push(textRow(colonialismReason!, true));
    return rows;
  }

  /**
   * Directional active exploitation-right lines between the human and `nationId`,
   * phrased so the player can see whose territory is affected and who benefits,
   * without exposing internal grantor/beneficiary terms. Empty when neither
   * direction is active.
   */
  private getExploitationRightsStatusRows(nationId: string): RightSidebarRow[] {
    if (!this.diplomacyManager || !this.humanNationId) return [];
    const dm = this.diplomacyManager;
    const humanId = this.humanNationId;
    const otherName = this.nationManager.getNation(nationId)?.name ?? nationId;
    const rows: RightSidebarRow[] = [];
    // hasExploitationRights(beneficiary, grantor).
    if (dm.hasExploitationRights(nationId, humanId)) {
      rows.push(textRow(`${otherName} may exploit natural resources in your territory`));
    }
    if (dm.hasExploitationRights(humanId, nationId)) {
      rows.push(textRow(`You may exploit natural resources in ${otherName}'s territory`));
    }
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

  /**
   * One grid cell per sellable resource. Only goods that can actually be sold
   * right now are included; each cell carries its header, destination + duration
   * selectors and an always-enabled Sell button (no separators — the grid gaps
   * separate cells).
   */
  private buildTradingSellCells(tradePartners: readonly Nation[]): RightSidebarRow[][] {
    if (!this.resourceAccessSystem || !this.humanNationId || !this.humanTradeDealWorkflow) return [];
    const cells: RightSidebarRow[][] = [];
    for (const { resourceId, quantity } of this.resourceAccessSystem.getExportableResourceQuantities(this.humanNationId)) {
      const available = Math.max(0, quantity - this.resourceAccessSystem.getExportedResourceSourceCount(this.humanNationId, resourceId));
      if (available <= 0) continue;
      const duration = this.getTradingDuration(this.tradingExportDurations, resourceId);
      const goldPerTurn = this.getHumanTradeGoldPerTurn(resourceId, duration);
      const options: Array<{ value: string; label: string }> = [];

      for (const nation of tradePartners) {
        for (const city of [...this.cityManager.getCitiesByOwner(nation.id)].sort((a, b) => a.name.localeCompare(b.name))) {
          const evaluation = this.humanTradeDealWorkflow.evaluateExportDestination({
            sellerNationId: this.humanNationId,
            buyerNationId: nation.id,
            buyerCityId: city.id,
            resourceId,
            turns: duration,
            goldPerTurn,
          });
          if (evaluation.ok) options.push({ value: city.id, label: `${nation.name} — ${city.name}` });
        }
      }

      // No eligible destination → not actionable, so omit the resource entirely.
      if (options.length === 0) continue;

      let selectedCityId = this.tradingExportDestinations.get(resourceId) ?? '';
      if (!options.some((option) => option.value === selectedCityId)) selectedCityId = options[0]!.value;
      this.tradingExportDestinations.set(resourceId, selectedCityId);
      const selectedCity = this.cityManager.getCity(selectedCityId);
      if (!selectedCity) continue;

      cells.push([
        textRow(`${this.formatResourceName(resourceId)} — ${available} available${this.getResourceTypeSuffix(resourceId)}`, false, true),
        {
          kind: 'select',
          label: 'Sell to',
          value: selectedCityId,
          options,
          onChange: (value) => {
            this.tradingExportDestinations.set(resourceId, value);
            this.requestRefresh();
          },
        },
        this.buildTradingDurationSelect(this.tradingExportDurations, resourceId, duration),
        {
          kind: 'button',
          text: `Sell — ${goldPerTurn}g/turn`,
          accentColor: this.nationManager.getNation(selectedCity.ownerId)?.color,
          onClick: () => this.startTradingExport(resourceId),
        },
      ]);
    }
    return cells;
  }

  /**
   * One grid cell per buyable foreign resource. Only goods whose Buy would
   * succeed are included; each cell carries its header, duration selector and an
   * always-enabled Buy button.
   */
  private buildTradingBuyCells(tradePartners: readonly Nation[]): RightSidebarRow[][] {
    if (!this.resourceAccessSystem || !this.tradeDealSystem || !this.humanNationId) return [];
    const cells: RightSidebarRow[][] = [];
    for (const seller of tradePartners) {
      for (const { resourceId, quantity } of this.resourceAccessSystem.getExportableResourceQuantities(seller.id)) {
        const available = Math.max(0, quantity - this.resourceAccessSystem.getExportedResourceSourceCount(seller.id, resourceId));
        const key = `${seller.id}:${resourceId}`;
        const duration = this.getTradingDuration(this.tradingImportDurations, key);
        const goldPerTurn = this.getHumanTradeGoldPerTurn(resourceId, duration);
        const input = {
          sellerNationId: seller.id,
          buyerNationId: this.humanNationId,
          resourceId,
          turns: duration,
          goldPerTurn,
        };
        // Only surface goods that can actually be bought right now.
        if (available <= 0 || !this.tradeDealSystem.validateDeal(input).ok) continue;
        cells.push([
          textRow(`${this.formatResourceName(resourceId)} — ${seller.name} — ${available} available${this.getResourceTypeSuffix(resourceId)}`, false, true),
          this.buildTradingDurationSelect(this.tradingImportDurations, key, duration),
          {
            kind: 'button',
            text: `Buy — ${goldPerTurn}g/turn`,
            accentColor: seller.color,
            onClick: () => this.startTradingImport(seller.id, resourceId),
          },
        ]);
      }
    }
    return cells;
  }

  private buildTradingActivityRows(): RightSidebarRow[] {
    if (!this.humanNationId || !this.tradeDealSystem || !this.humanTradeDealWorkflow) {
      return [textRow('Trade system unavailable.', true)];
    }
    const rows: RightSidebarRow[] = [];
    if (this.tradingFeedback) rows.push(textRow(this.tradingFeedback, true));
    for (const pending of this.humanTradeDealWorkflow.getPendingDeals()) {
      const buyer = this.nationManager.getNation(pending.buyerNationId)?.name ?? pending.buyerNationId;
      const city = this.cityManager.getCity(pending.buyerCityId)?.name ?? pending.buyerCityId;
      const route = this.tradeConnectionSystem?.getConnection(pending.routeId);
      const remaining = route ? this.getTradeRouteTurnsRemaining(route) : null;
      rows.push(textRow(`${this.formatResourceName(pending.resourceId)} → ${buyer} — ${city}`, false, true));
      rows.push(textRow(remaining === null
        ? 'Establishing trade route'
        : `Establishing trade route — ${remaining} turn${remaining === 1 ? '' : 's'} remaining`, true));
    }
    for (const deal of this.tradeDealSystem.getDealsForNation(this.humanNationId)) {
      const otherNationId = deal.sellerNationId === this.humanNationId ? deal.buyerNationId : deal.sellerNationId;
      const other = this.nationManager.getNation(otherNationId)?.name ?? otherNationId;
      const direction = deal.sellerNationId === this.humanNationId ? `→ ${other}` : `← ${other}`;
      rows.push(textRow(`${this.formatResourceName(deal.resourceId)} ${direction}`, false, true));
      rows.push(textRow(`Active — ${deal.remainingTurns} turn${deal.remainingTurns === 1 ? '' : 's'} remaining`, true));
    }
    if (rows.length === 0) rows.push(textRow('No active or pending trade deals.', true));
    return rows;
  }

  private buildTradingNationExportRows(nationName: string, deals: readonly TradeDeal[]): RightSidebarRow[] {
    if (deals.length === 0) return [textRow(`No active exports to ${nationName}.`, true)];
    return deals.flatMap((deal) => [
      textRow(`${this.formatResourceName(deal.resourceId)} ×1`, false, true),
      textRow(`${deal.remainingTurns} turn${deal.remainingTurns === 1 ? '' : 's'} remaining · +${deal.goldPerTurn} gold/turn`, true),
    ]);
  }

  private buildTradingNationImportRows(nationName: string, deals: readonly TradeDeal[]): RightSidebarRow[] {
    if (deals.length === 0) return [textRow(`No active imports from ${nationName}.`, true)];
    return deals.flatMap((deal) => [
      textRow(`${this.formatResourceName(deal.resourceId)} ×1`, false, true),
      textRow(`${deal.remainingTurns} turn${deal.remainingTurns === 1 ? '' : 's'} remaining · -${deal.goldPerTurn} gold/turn`, true),
    ]);
  }

  private buildTradingNationPendingRows(deals: readonly PendingTradeDeal[]): RightSidebarRow[] {
    if (deals.length === 0) return [textRow('No pending trades.', true)];
    const rows: RightSidebarRow[] = [];
    for (const deal of deals) {
      const destination = this.cityManager.getCity(deal.buyerCityId)?.name ?? deal.buyerCityId;
      const route = this.tradeConnectionSystem?.getConnection(deal.routeId);
      const remaining = route ? this.getTradeRouteTurnsRemaining(route) : null;
      rows.push(textRow(`${this.formatResourceName(deal.resourceId)} ×1 → ${destination}`, false, true));
      rows.push(textRow(remaining === null
        ? 'Establishing trade route · deal not active'
        : `Establishing trade route · ${remaining} turn${remaining === 1 ? '' : 's'} remaining · deal not active`, true));
    }
    rows.push(textRow('Deal duration begins on activation; the resource is not reserved while pending.', true));
    return rows;
  }

  private buildTradingNationRouteRows(routes: readonly TradeConnection[]): RightSidebarRow[] {
    if (routes.length === 0) return [textRow('No active or establishing trade routes.', true)];
    const humanId = this.humanNationId!;
    return [...routes]
      .sort((a, b) => Number(a.status === 'active') - Number(b.status === 'active') || a.id.localeCompare(b.id))
      .flatMap((route) => {
        const humanIsA = route.nationAId === humanId;
        const humanCity = this.cityManager.getCity(humanIsA ? route.cityAId : route.cityBId)?.name
          ?? (humanIsA ? route.cityAId : route.cityBId);
        const foreignCity = this.cityManager.getCity(humanIsA ? route.cityBId : route.cityAId)?.name
          ?? (humanIsA ? route.cityBId : route.cityAId);
        const remaining = route.status === 'building' ? this.getTradeRouteTurnsRemaining(route) : null;
        const status = route.status === 'active'
          ? 'Active'
          : remaining === null
            ? 'Establishing'
            : `Establishing — ${remaining} turn${remaining === 1 ? '' : 's'} remaining`;
        return [textRow(`${humanCity} ↔ ${foreignCity}`, false, true), textRow(status, true)];
      });
  }

  private buildTradingNationCapacityRows(nationId: string): RightSidebarRow[] {
    if (!this.tradeConnectionSystem || !this.humanNationId) return [textRow('Trade capacity unavailable.', true)];
    const rows: RightSidebarRow[] = [textRow('Capacity is shared globally by each city across all trade partners.', true)];
    const addCities = (heading: string, ownerId: string): void => {
      rows.push(textRow(heading, false, true));
      const cities = [...this.cityManager.getCitiesByOwner(ownerId)].sort((a, b) => a.name.localeCompare(b.name));
      if (cities.length === 0) {
        rows.push(textRow('No eligible cities.', true));
        return;
      }
      for (const city of cities) {
        const used = this.tradeConnectionSystem!.getCityUsedTradeCapacity(city.id);
        const total = this.tradeConnectionSystem!.getCityTradeCapacity(city.id);
        rows.push(textRow(`${city.name}: ${used} / ${total} used`));
      }
    };
    addCities('Your cities', this.humanNationId);
    addCities(`${this.nationManager.getNation(nationId)?.name ?? nationId} cities`, nationId);
    return rows;
  }

  private buildTradingDurationSelect(
    store: Map<string, number>,
    key: string,
    duration: number,
  ): RightSidebarRow {
    return {
      kind: 'select',
      label: 'Duration',
      value: String(duration),
      options: [this.humanTradeDealDurations.short, this.humanTradeDealDurations.long]
        .map((turns) => ({ value: String(turns), label: `${turns} turns` })),
      onChange: (value) => {
        const turns = Number(value);
        if (turns === this.humanTradeDealDurations.short || turns === this.humanTradeDealDurations.long) store.set(key, turns);
        this.requestRefresh();
      },
    };
  }

  private getTradingDuration(store: Map<string, number>, key: string): number {
    const selected = store.get(key);
    return selected === this.humanTradeDealDurations.short || selected === this.humanTradeDealDurations.long
      ? selected!
      : this.humanTradeDealDurations.short;
  }

  private startTradingExport(resourceId: string): void {
    if (!this.humanNationId || !this.humanTradeDealWorkflow) return;
    const buyerCityId = this.tradingExportDestinations.get(resourceId);
    const buyerCity = buyerCityId ? this.cityManager.getCity(buyerCityId) : undefined;
    if (!buyerCity) {
      this.tradingFeedback = 'Choose an eligible destination city.';
      this.requestRefresh();
      return;
    }
    const turns = this.getTradingDuration(this.tradingExportDurations, resourceId);
    const result = this.humanTradeDealWorkflow.startExport({
      sellerNationId: this.humanNationId,
      buyerNationId: buyerCity.ownerId,
      buyerCityId: buyerCity.id,
      resourceId,
      turns,
      goldPerTurn: this.getHumanTradeGoldPerTurn(resourceId, turns),
    });
    if (!result.ok) this.tradingFeedback = result.reason;
    else if (result.status === 'active') this.tradingFeedback = 'Trade deal started — Active.';
    else {
      const route = this.tradeConnectionSystem?.getConnection(result.routeId);
      const remaining = route ? this.getTradeRouteTurnsRemaining(route) : null;
      this.tradingFeedback = remaining === null
        ? 'Establishing trade route.'
        : `Establishing trade route — ${remaining} turn${remaining === 1 ? '' : 's'} remaining.`;
    }
    this.requestRefresh();
  }

  private startTradingImport(sellerNationId: string, resourceId: string): void {
    if (!this.humanNationId || !this.tradeDealSystem) return;
    const key = `${sellerNationId}:${resourceId}`;
    const turns = this.getTradingDuration(this.tradingImportDurations, key);
    const result = this.tradeDealSystem.createDeal({
      sellerNationId,
      buyerNationId: this.humanNationId,
      resourceId,
      turns,
      goldPerTurn: this.getHumanTradeGoldPerTurn(resourceId, turns),
    });
    this.tradingFeedback = result.ok ? 'Import deal started — Active.' : result.reason ?? 'Trade deal failed.';
    this.requestRefresh();
  }

  /**
   * Read-only overview of the trade routes between the human and `otherNationId`,
   * covering both routes still under construction ("In progress") and completed
   * ("Active") ones. Visibility only — no trade-route logic is touched here.
   */
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

  private getHumanTradeGoldPerTurn(resourceId: string, duration: number): number {
    const base = this.getResourceTradeGoldPerTurn(resourceId);
    return duration === this.humanTradeDealDurations.long ? Math.max(1, base - 1) : base;
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

  private getLeaderboardSectionByCategory(category: Exclude<RightSidebarLeaderboardCategory, 'gon'>): RightSidebarSection {
    switch (category) {
      case 'domination':
        return this.getDominationVictorySection();
      case 'diplomacy':
        return this.getDiplomaticVictorySection();
      case 'research':
        return this.getScienceVictorySection();
      case 'cultural':
        return this.getCulturalVictorySection();
    }
  }

  private getCulturalVictorySection(): RightSidebarSection {
    const entries = this.getCulturalVictoryLeaderboard();
    const headerRow = textRow(
      `Cultural Victory — normal route: ${CULTURAL_VICTORY_REQUIRED_CULTURE.toLocaleString()} Culture, ${CULTURAL_VICTORY_REQUIRED_WONDERS} World Wonders, a Dominant currency, and Reigning GoN Champion; OR ${OVERWHELMING_CULTURE_VICTORY_THRESHOLD.toLocaleString()} Culture through overwhelming cultural dominance.`,
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
    return { title: '🏛️ Cultural Victory', rows: [headerRow, ...rows] };
  }

  private getCulturalVictoryLeaderboard(): LeaderboardEntry[] {
    if (!this.wonderSystem) return [];
    return this.sortLeaderboard(this.nationManager.getAllNations().map((nation) => {
      const owned = getOwnedWonderCount(nation.id, this.wonderSystem!, this.cityManager);
      const culture = this.nationManager.getResources(nation.id).culture;
      const currency = this.currencySystem?.getCurrencyState(nation.id)?.strength ?? 'Not established';
      const champion = this.victorySystem
        ?.getCulturalVictoryProgress(nation.id).isReigningGamesChampion === true;
      const details = [
        `Culture ${culture.toLocaleString()} / ${CULTURAL_VICTORY_REQUIRED_CULTURE.toLocaleString()}`,
        `Overwhelming ${culture.toLocaleString()} / ${OVERWHELMING_CULTURE_VICTORY_THRESHOLD.toLocaleString()}`,
        `Wonders ${owned} / ${CULTURAL_VICTORY_REQUIRED_WONDERS}`,
        currency === 'Dominant' ? 'Currency Dominant' : undefined,
        champion ? 'Reigning GoN Champion' : undefined,
      ].filter((detail): detail is string => detail !== undefined);
      return {
        nationId: nation.id,
        name: nation.name,
        color: nation.color,
        score: culture,
        detail: details.join(' · '),
        secondaryScore: owned,
      };
    }));
  }

  private getDiplomaticVictorySection(): RightSidebarSection {
    const entries = this.getDiplomacyLeaderboard();
    const requiredScore = this.worldCouncilSystem?.getDiplomacyScoreThreshold() ?? WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD;
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
    const nations = this.nationManager.getAllNations();
    let totalWorldStrength = 0;
    for (const nation of nations) {
      const strength = this.militaryEvaluationSystem?.getMilitaryStrength(nation.id).totalStrength ?? 0;
      totalWorldStrength += strength;
    }
    const nationById = new Map(nations.map((nation) => [nation.id, nation]));
    return buildDominationRanking(
      nations,
      (nationId) => this.diplomacyManager?.getVassalHost(nationId),
      (nationId) => this.militaryEvaluationSystem?.getMilitaryStrength(nationId).totalStrength ?? 0,
    ).map((ranked) => {
      const nation = nationById.get(ranked.nationId)!;
      const score = ranked.directVassalCount;
      const milStrength = ranked.militaryStrength;
      const milPct = totalWorldStrength > 0 ? Math.round(milStrength / totalWorldStrength * 100) : 0;
      return {
        nationId: nation.id,
        name: nation.name,
        color: nation.color,
        score,
        detail: `Vassal States: ${score} / ${ranked.otherLivingNationCount}, military ${milPct}%`,
        secondaryScore: milStrength,
      };
    });
  }

  private getDominationVictorySection(): RightSidebarSection {
    const entries = this.getDominationLeaderboard();
    const headerRow = textRow(
      'Domination Victory — make every other surviving nation your direct vassal state.',
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
    return { title: '⚔️ Domination', rows: [headerRow, ...rows] };
  }

  private getScienceVictorySection(): RightSidebarSection {
    const progressByNation = this.victorySystem
      ? this.victorySystem.getScienceVictoryRanking()
      : [];
    const progress = [...progressByNation].sort((a, b) => {
      if (b.aerospaceParts !== a.aerospaceParts) return b.aerospaceParts - a.aerospaceParts;
      const aPrerequisites = Number(a.hasRocketry) + Number(a.hasFactory) + Number(a.hasAluminum);
      const bPrerequisites = Number(b.hasRocketry) + Number(b.hasFactory) + Number(b.hasAluminum);
      if (bPrerequisites !== aPrerequisites) return bPrerequisites - aPrerequisites;
      const aName = this.nationManager.getNation(a.nationId)?.name ?? a.nationId;
      const bName = this.nationManager.getNation(b.nationId)?.name ?? b.nationId;
      return aName.localeCompare(bName);
    });
    const headerRow = textRow(
      `Science Victory — research Rocketry, have an active Factory, access Aluminum, and produce ${this.requiredAerospaceParts} Space Parts.`,
      true,
    );
    const rows: RightSidebarRow[] = progress.length === 0
      ? [textRow('No leaderboard data available.', true)]
      : progress.map((entry, index) => {
        const nation = this.nationManager.getNation(entry.nationId);
        const name = nation?.name ?? entry.nationId;
        const fulfilled = [
          entry.hasRocketry ? 'Rocketry' : undefined,
          entry.hasFactory ? 'Factory' : undefined,
          entry.hasAluminum ? 'Aluminum' : undefined,
          `Space Parts ${entry.aerospaceParts}/${entry.requiredAerospaceParts}`,
        ].filter((condition): condition is string => condition !== undefined);
        return textRow(
          `${index + 1}. ${name} (${fulfilled.join(' · ')})`,
          false,
          false,
          nation?.color,
        );
      });
    return { title: '💡 Science', rows: [headerRow, ...rows] };
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

/** Pure row builder used by the Audience and focused UI eligibility tests. */
export function buildEconomicPressureButtonGroup(
  diplomacy: DiplomacyManager,
  humanNationId: string,
  targetNationId: string,
  accentColor: number | undefined,
  onSelect: (type: EconomicPressureType) => void,
): RightSidebarRow {
  const current = diplomacy.getEconomicPressure(humanNationId, targetNationId);
  return {
    kind: 'buttonGroup',
    buttons: ECONOMIC_PRESSURE_TYPES.map((type) => {
      const selected = current === type;
      const eligibility = diplomacy.canImposeEconomicPressure(humanNationId, targetNationId, type);
      return {
        text: ECONOMIC_PRESSURE_LABEL[type],
        selected,
        disabled: !selected && !eligibility.ok,
        disabledReason: !selected && !eligibility.ok ? eligibility.reason : undefined,
        accentColor: selected ? 0xf4d06f : accentColor,
        onClick: () => onSelect(type),
      };
    }),
  };
}

/** Pure Audience row builder for paying an AI to remove its mature sanction. */
export function buildEconomicPressureRemovalRow(
  diplomacy: DiplomacyManager,
  humanNationId: string,
  aiNationId: string,
  currentTurn: number,
  humanGold: number,
  accentColor: number | undefined,
  onSelect: () => void,
): RightSidebarRow | null {
  const incoming = diplomacy.getEconomicPressureRecord(aiNationId, humanNationId);
  if (!isEconomicPressureNegotiable(incoming, currentTurn)) return null;
  const canAfford = humanGold >= ECONOMIC_PRESSURE_REMOVAL_PRICE;
  return disabledReasonButtonRow(
    `Negotiate removal — ${ECONOMIC_PRESSURE_REMOVAL_PRICE} gold`,
    canAfford
      ? undefined
      : `Insufficient gold (have ${Math.floor(humanGold)}, need ${ECONOMIC_PRESSURE_REMOVAL_PRICE}).`,
    onSelect,
    accentColor,
  );
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
    case 'manufacturedResource':
      return item.productionType.name;
    case 'project':
      return item.projectType.name;
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
    case 'manufacturedResource':
      return getCorporationSpritePath(AEROSPACE_PARTS_ID);
    case 'project':
      return getProjectSpritePath(item.projectType.id);
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
