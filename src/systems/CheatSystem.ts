import type { AutoplaySystem } from './AutoplaySystem';
import type { CityManager } from './CityManager';
import type { CultureSystem } from './culture/CultureSystem';
import type { CorporationSystem } from './CorporationSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceSystem } from './ResourceSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { DiagnosticSystem } from './DiagnosticSystem';
import type { DiscoverySystem } from './DiscoverySystem';
import type { NationManager } from './NationManager';
import type { SelectionManager } from './SelectionManager';
import type { UnitManager } from './UnitManager';
import { ALL_LEADERS } from '../data/leaders';
import {
  CORPORATIONS,
  getCorporationById,
  type CorporationDefinition,
} from '../data/corporations';
import { getManufacturedResourceById } from '../data/manufacturedResources';
import { ALL_TECHNOLOGIES, type TechnologyDefinition } from '../data/technologies';
import { ALL_UNIT_TYPES } from '../data/units';
import { NATURAL_RESOURCES, getNaturalResourceById } from '../data/naturalResources';
import type { NaturalResourceDefinition } from '../types/naturalResources';
import type { UnitType } from '../entities/UnitType';
import type { MapData } from '../types/map';
import type { Producible } from '../types/producible';

export interface GameContext {
  humanNationId: string | undefined;
  researchSystem: ResearchSystem;
  cultureSystem: CultureSystem;
  corporationSystem: CorporationSystem;
  resourceSystem: ResourceSystem;
  resourceAccessSystem: ResourceAccessSystem;
  diagnosticSystem: DiagnosticSystem;
  discoverySystem: DiscoverySystem;
  nationManager: NationManager;
  productionSystem: ProductionSystem;
  cityManager: CityManager;
  selectionManager: SelectionManager;
  unitManager: UnitManager;
  autoplaySystem: AutoplaySystem;
  mapData: MapData;
  /**
   * Redraw a single tile after its resource or ownership changed: refreshes the
   * natural-resource icon and territory borders (and dependent HUD). Wired in
   * GameScene so the CheatSystem stays renderer-agnostic.
   */
  refreshTileVisuals: (tileX: number, tileY: number) => void;
  revealMapResourcesTemporarily: () => void;
  setFogEnabled: (enabled: boolean) => void;
  /** Open the developer dialog for editing bilateral relationship memory. */
  openRelationsDialog: () => void;
  /**
   * Force an alliance between the human player and `targetNationId`, running the
   * same alliance-formation code path (manager, relation updates, event log, UI
   * refresh) used when the human negotiates one through diplomacy. Returns
   * 'exists' when they are already allied (no-op), otherwise 'created'.
   */
  formHumanAlliance: (targetNationId: string) => 'created' | 'exists';
  /**
   * Experimental developer hook: reload the current game with `targetNationId`
   * as the human player. Implementations show a confirmation modal and only
   * reload the scene on confirm; selecting the current human is a no-op. Returns
   * a short status message for the cheat console.
   */
  switchHumanPlayer: (targetNationId: string) => string;
}

export interface CheatCommand {
  name: string;
  description: string;
  execute: (args: string[], context: GameContext) => string;
  complete?: (args: string[], context: GameContext) => CheatCompletionSuggestion[];
}

export interface CheatCompletionSuggestion {
  value: string;
  label?: string;
  description?: string;
}

export class CheatSystem {
  private readonly commands: CheatCommand[] = [];

  constructor(private readonly context: GameContext) {
    this.register({
      name: 'gold',
      description: 'Set nation gold with "gold <integer> [nation]" or add gold with "gold add <integer> [nation]".',
      execute: (args, context) => {
        if (args[0] === 'add') {
          const amount = parseInteger(args[1]);
          if (amount === null || args.length < 2 || args.length > 3) return 'Usage: gold add <integer> [nation]';

          const target = resolveNationId(args[2], context);
          if (!target.ok) return target.message;

          const total = context.resourceSystem.addGold(target.nationId, amount);
          if (total === null) return `Unknown nation: ${args[2] ?? target.nationId}`;

          return `Gold added to ${target.label}: ${amount}. Total gold: ${total}`;
        }

        const amount = parseInteger(args[0]);
        if (amount === null || args.length < 1 || args.length > 2) return 'Usage: gold <integer> [nation]';

        const target = resolveNationId(args[1], context);
        if (!target.ok) return target.message;

        const total = context.resourceSystem.setGold(target.nationId, amount);
        if (total === null) return `Unknown nation: ${args[1] ?? target.nationId}`;

        return `Gold set for ${target.label}: ${total}`;
      },
    });

    this.register({
      name: 'research',
      description: 'Unlock a technology for a nation. Usage: "research <techId> [nation]" or "research add <techId> [nation]".',
      execute: (args, context) => {
        const techArgIndex = args[0] === 'add' ? 1 : 0;
        const techArg = args[techArgIndex];
        const expectedMaxArgs = techArgIndex + 2;
        if (techArg === undefined || args.length > expectedMaxArgs) {
          return 'Usage: research [add] <techId> [nation]';
        }

        const tech = resolveTechnologyId(techArg);
        if (!tech.ok) return tech.message;

        const target = resolveNationId(args[techArgIndex + 1], context);
        if (!target.ok) return target.message;

        if (context.researchSystem.isResearched(target.nationId, tech.tech.id)) {
          return `Technology already researched for ${target.label}: ${tech.tech.id}`;
        }

        const success = context.researchSystem.unlockTechnology(target.nationId, tech.tech.id);
        if (!success) {
          return `Technology already researched for ${target.label}: ${tech.tech.id}`;
        }

        return `Technology unlocked for ${target.label}: ${tech.tech.id}`;
      },
      complete: (args, context) => {
        if (args.length === 1) {
          return matchLiteralSuggestions(args[0], [{ value: 'add', description: 'Unlock a technology.' }])
            .concat(completeTechnology(args[0]));
        }
        if (args[0] === 'add') {
          if (args.length === 2) return completeTechnology(args[1]);
          if (args.length === 3) return completeNation(args[2], context);
          return [];
        }
        if (args.length === 2) return completeNation(args[1], context);
        return [];
      },
    });

    this.register({
      name: 'research done',
      description: 'Finish the current research for the player nation.',
      execute: (_args, context) => {
        if (!context.humanNationId) return 'No active research';

        const technology = context.researchSystem.completeCurrentResearch(context.humanNationId);
        if (!technology) return 'No active research';

        return `Research complete: ${technology.name}`;
      },
    });

    this.register({
      name: 'culture done',
      description: 'Finish the current civic for the player nation.',
      execute: (_args, context) => {
        if (!context.humanNationId) return 'No active culture';

        const node = context.cultureSystem.completeCurrentCultureNode(context.humanNationId);
        if (!node) return 'No active culture';

        return `Culture complete: ${node.name}`;
      },
    });

    this.register({
      name: 'production done',
      description: 'Finish current production in the selected human city. Use "production done --all" to finish it in every human city.',
      execute: (args, context) => {
        if (!context.humanNationId) return 'No human player';

        if (args.length === 1 && args[0] === '--all') {
          const cities = context.cityManager.getCitiesByOwner(context.humanNationId);
          if (cities.length === 0) return 'No human cities';

          const lines: string[] = [];
          for (const city of cities) {
            const result = context.productionSystem.completeCurrentProduction(city.id);
            if (result.kind === 'empty') continue;
            if (result.kind === 'blocked') {
              lines.push(`${city.name}: blocked — ${result.reason}`);
            } else {
              lines.push(`${city.name}: completed ${producibleName(result.item)}`);
            }
          }

          if (lines.length === 0) return 'No production in any human city';
          return lines.join('\n');
        }

        if (args.length !== 0) return 'Usage: production done [--all]';

        const selection = context.selectionManager.getSelected();
        if (!selection || selection.kind !== 'city' || selection.city.ownerId !== context.humanNationId) {
          return 'No human city selected';
        }

        const result = context.productionSystem.completeCurrentProduction(selection.city.id);
        if (result.kind === 'empty') return `No production in ${selection.city.name}`;
        if (result.kind === 'blocked') return `${selection.city.name}: blocked — ${result.reason}`;
        return `${selection.city.name}: completed ${producibleName(result.item)}`;
      },
    });

    this.register({
      name: 'kill',
      description: 'Kill the unit standing on the currently selected tile.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: kill';

        const selection = context.selectionManager.getSelected();
        if (!selection) return 'No tile selected';

        const position = selectionTilePosition(selection);
        if (!position) return 'No tile selected';

        const unit = context.unitManager.getUnitAt(position.x, position.y);
        if (!unit) return 'No unit on selected tile';

        const label = unit.name;
        context.unitManager.removeUnit(unit.id);
        return `Killed ${label}`;
      },
    });

    this.register({
      name: 'unit',
      description: 'Create any unit on the selected tile. Usage: "unit <unitType> [nation]" (nation defaults to the player). Ignores tech/culture requirements.',
      execute: (args, context) => {
        const unitArg = args[0];
        if (unitArg === undefined || args.length > 2) return 'Usage: unit <unitType> [nation]';

        const unitType = resolveUnitType(unitArg);
        if (!unitType.ok) return unitType.message;

        const target = resolveNationId(args[1], context);
        if (!target.ok) return target.message;

        const selection = context.selectionManager.getSelected();
        const position = selection ? selectionTilePosition(selection) : null;
        if (!position) return 'No tile selected';

        const created = context.unitManager.createUnit({
          type: unitType.type,
          ownerId: target.nationId,
          tileX: position.x,
          tileY: position.y,
        });
        return `Created ${created.name} for ${target.label} at (${position.x}, ${position.y})`;
      },
      complete: (args, context) => {
        if (args.length === 1) return completeUnit(args[0]);
        if (args.length === 2) return completeNation(args[1], context);
        return [];
      },
    });

    this.register({
      name: 'resource',
      description: 'Place a natural resource on the selected tile and assign the tile to a nation so it counts. Usage: "resource <resourceId> [nation]" (nation defaults to the player). Ignores tile-type and tech restrictions.',
      execute: (args, context) => {
        const resourceArg = args[0];
        if (resourceArg === undefined || args.length > 2) return 'Usage: resource <resourceId> [nation]';

        const resource = resolveNaturalResource(resourceArg);
        if (!resource.ok) return resource.message;

        const target = resolveNationId(args[1], context);
        if (!target.ok) return target.message;

        const selection = context.selectionManager.getSelected();
        const position = selection ? selectionTilePosition(selection) : null;
        if (!position) return 'No tile selected';
        const tile = context.mapData.tiles[position.y]?.[position.x];
        if (!tile) return 'No tile selected';

        // Place the resource and hand the tile to the target nation: tile
        // ownership is the game's own precondition for the resource to count
        // toward that nation's access (yields already read the tile directly).
        tile.resourceId = resource.resource.id;
        tile.ownerId = target.nationId;
        // The resource-access layer caches a tile index built once at load; it
        // must be invalidated for the newly placed resource to be visible.
        context.resourceAccessSystem.invalidateResourceIndex();
        context.refreshTileVisuals(position.x, position.y);

        // Access is still gated by the resource's required technology, so note
        // when the target cannot yet use it (the yield bonus applies regardless).
        const requiredTechId = resource.resource.requiredTechId;
        const techNote = requiredTechId && !context.researchSystem.isResearched(target.nationId, requiredTechId)
          ? ` (${target.label} needs ${getTechnologyName(requiredTechId)} to access it; the tile yield applies regardless)`
          : '';
        return `Placed ${resource.resource.name} on the selected tile for ${target.label}${techNote}`;
      },
      complete: (args, context) => {
        if (args.length === 1) return completeResource(args[0]);
        if (args.length === 2) return completeNation(args[1], context);
        return [];
      },
    });

    this.register({
      name: 'diagnostic',
      description: 'Toggle the runtime diagnostics dialog.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: diagnostic';
        context.diagnosticSystem.toggle();
        return context.diagnosticSystem.isOpen()
          ? 'Diagnostics opened.'
          : 'Diagnostics closed.';
      },
    });

    this.register({
      name: 'turnlog',
      description: 'Toggle per-turn console logging.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: turnlog';
        context.diagnosticSystem.toggleTurnLogging();
        return context.diagnosticSystem.isTurnLoggingEnabled()
          ? 'Turn logging enabled.'
          : 'Turn logging disabled.';
      },
    });

    this.register({
      name: 'fog',
      description: 'Toggle fog of war with "fog on" or "fog off".',
      execute: (args, context) => {
        if (args.length !== 1 || (args[0] !== 'on' && args[0] !== 'off')) {
          return 'Usage: fog <on|off>';
        }
        const enabled = args[0] === 'on';
        context.setFogEnabled(enabled);
        return enabled ? 'Fog of war enabled.' : 'Fog of war disabled.';
      },
      complete: (args) => {
        if (args.length > 1) return [];
        return matchLiteralSuggestions(args[0] ?? '', [
          { value: 'on', description: 'Enable fog of war.' },
          { value: 'off', description: 'Disable fog of war (reveal whole map).' },
        ]);
      },
    });

    this.register({
      name: 'relations',
      description: 'Open the nation relationship memory editor.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: relations';
        context.openRelationsDialog();
        return 'Relations editor opened.';
      },
    });

    this.register({
      name: 'leaders reveal',
      description: 'Reveal one leader with "leaders reveal <name>" or every leader with "leaders reveal all".',
      execute: (args, context) => {
        if (!context.humanNationId) return 'No human player';
        if (args.length === 0) return 'Usage: leaders reveal <name|all>';

        const nations = context.nationManager.getAllNations()
          .filter((nation) => nation.id !== context.humanNationId);

        if (args.length === 1 && args[0] === 'all') {
          const lines: string[] = [];
          for (const nation of nations) {
            context.discoverySystem.revealNation(context.humanNationId, nation.id);
            lines.push(`Revealed leader: ${nation.name}`);
          }
          lines.push('All leaders revealed.');
          return lines.join('\n');
        }

        const search = args.join(' ').toLowerCase();
        const leader = ALL_LEADERS.find((candidate) => candidate.name.toLowerCase() === search)
          ?? ALL_LEADERS.find((candidate) => candidate.name.toLowerCase().includes(search))
          ?? ALL_LEADERS.find((candidate) => candidate.id.toLowerCase() === search);
        const target = nations.find((nation) => nation.name.toLowerCase() === search)
          ?? nations.find((nation) => nation.name.toLowerCase().includes(search))
          ?? nations.find((nation) => nation.id.toLowerCase() === search)
          ?? nations.find((nation) => nation.id === leader?.nationId);
        if (!target) return `Leader not found: ${args.join(' ')}`;

        context.discoverySystem.revealNation(context.humanNationId, target.id);
        return `Revealed leader: ${target.name}`;
      },
      complete: (args) => {
        if (args.length > 1) return [];
        return matchLiteralSuggestions(args[0] ?? '', [{ value: 'all', description: 'Reveal every leader.' }])
          .concat(completeLeader(args[0] ?? ''));
      },
    });

    this.register({
      name: 'meet',
      description: 'Force two nations to have met. Usage: "meet <nationA> <nationB>".',
      execute: (args, context) => {
        if (args.length !== 2) return 'Usage: meet <nationA> <nationB>';

        const a = resolveNationId(args[0], context);
        if (!a.ok) return a.message;
        const b = resolveNationId(args[1], context);
        if (!b.ok) return b.message;

        if (a.nationId === b.nationId) return 'Cannot meet the same nation.';

        context.discoverySystem.revealNation(a.nationId, b.nationId);
        return `${a.label} and ${b.label} have now met.`;
      },
      complete: (args, context) => {
        if (args.length === 1) return completeNation(args[0], context);
        if (args.length === 2) {
          const firstNation = resolveNationId(args[0], context);
          const excludedNationIds = firstNation.ok ? new Set([firstNation.nationId]) : undefined;
          return completeNation(args[1], context, excludedNationIds);
        }
        return [];
      },
    });

    this.register({
      name: 'alliance',
      description: 'Ally the human player with one or more nations. Usage: "alliance <nation> [nation ...]". The human player is always included.',
      execute: (args, context) => {
        if (!context.humanNationId) return 'No human player';
        if (args.length === 0) return 'Usage: alliance <nation> [nation ...]';

        const lines: string[] = [];
        const processedNationIds = new Set<string>();
        for (const arg of args) {
          const resolved = resolveNationId(arg, context);
          if (!resolved.ok) continue; // ignore invalid / unknown nation names
          if (resolved.nationId === context.humanNationId) continue; // skip the human player
          if (processedNationIds.has(resolved.nationId)) continue; // no duplicate participants
          processedNationIds.add(resolved.nationId);

          const result = context.formHumanAlliance(resolved.nationId);
          lines.push(result === 'created'
            ? `Alliance created with ${resolved.label}.`
            : `Alliance already exists with ${resolved.label}.`);
        }

        if (lines.length === 0) return 'No valid nations specified.';
        return lines.join('\n');
      },
      complete: (args, context) => {
        if (args.length === 0) return [];
        // Suggest nation names for the argument being typed, excluding the human
        // player and any nations already chosen in earlier arguments.
        const excludedNationIds = new Set<string>();
        if (context.humanNationId) excludedNationIds.add(context.humanNationId);
        for (let index = 0; index < args.length - 1; index += 1) {
          const earlier = resolveNationId(args[index], context);
          if (earlier.ok) excludedNationIds.add(earlier.nationId);
        }
        return completeNation(args[args.length - 1], context, excludedNationIds);
      },
    });

    this.register({
      name: 'map reveal',
      description: 'Temporarily reveal all natural resource icons until the next turn transition.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: map reveal';
        context.revealMapResourcesTemporarily();
        return 'Map resources revealed until the next turn transition.';
      },
    });

    this.register({
      name: 'corp list',
      description: 'List corporation definitions and whether each is founded.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: corp list';

        return CORPORATIONS.map((corporation) => {
          const founded = context.corporationSystem.getFoundedCorporation(corporation.id);
          if (!founded) return `${corporation.id} (${corporation.name}) - available`;

          const founder = context.nationManager.getNation(founded.founderNationId);
          const city = founded.cityId ? context.cityManager.getCity(founded.cityId) : undefined;
          const cityText = city ? ` in ${city.name}` : '';
          return `${corporation.id} (${corporation.name}) - founded by ${founder?.name ?? founded.founderNationId}${cityText} on turn ${founded.foundedTurn}`;
        }).join('\n');
      },
    });

    this.register({
      name: 'corp founded',
      description: 'List founded corporations and founding nations.',
      execute: (args, context) => {
        if (args.length !== 0) return 'Usage: corp founded';

        const founded = context.corporationSystem.getFoundedCorporations();
        if (founded.length === 0) return 'No corporations founded.';

        return founded.map((corporation) => {
          const definition = getCorporationById(corporation.corporationId);
          const founder = context.nationManager.getNation(corporation.founderNationId);
          const city = corporation.cityId ? context.cityManager.getCity(corporation.cityId) : undefined;
          const cityText = city ? ` in ${city.name}` : '';
          return `${definition?.name ?? corporation.corporationId} - founded by ${founder?.name ?? corporation.founderNationId}${cityText} on turn ${corporation.foundedTurn}`;
        }).join('\n');
      },
    });

    this.register({
      name: 'corp can',
      description: 'Check whether a nation can found a corporation. Usage: "corp can <corporationId> [nation]".',
      execute: (args, context) => {
        if (args.length < 1 || args.length > 2) return 'Usage: corp can <corporationId> [nation]';

        const corporation = resolveCorporationId(args[0]);
        if (!corporation.ok) return corporation.message;

        const target = resolveNationId(args[1], context);
        if (!target.ok) return target.message;

        const blockers = context.corporationSystem.getFoundingBlockers(target.nationId, corporation.corporation.id);
        if (blockers.length === 0) {
          return `${target.label} can found ${corporation.corporation.name}.`;
        }

        return `${target.label} cannot found ${corporation.corporation.name}:\n${blockers.map((blocker) => `- ${blocker}`).join('\n')}`;
      },
      complete: (args, context) => {
        if (args.length === 1) return completeCorporation(args[0]);
        if (args.length === 2) return completeNation(args[1], context);
        return [];
      },
    });

    this.register({
      name: 'corp found',
      description: 'Found a corporation for a nation. Usage: "corp found <corporationId> [nation]".',
      execute: (args, context) => {
        if (args.length < 1 || args.length > 2) return 'Usage: corp found <corporationId> [nation]';

        const corporation = resolveCorporationId(args[0]);
        if (!corporation.ok) return corporation.message;

        const target = resolveNationId(args[1], context);
        if (!target.ok) return target.message;

        const blockers = context.corporationSystem.getFoundingBlockers(target.nationId, corporation.corporation.id);
        if (blockers.length > 0) {
          return `${target.label} cannot found ${corporation.corporation.name}:\n${blockers.map((blocker) => `- ${blocker}`).join('\n')}`;
        }

        const founded = context.corporationSystem.foundCorporation(target.nationId, corporation.corporation.id);
        if (!founded) return `Could not found ${corporation.corporation.name}.`;

        return `${target.label} founded ${corporation.corporation.name}.`;
      },
      complete: (args, context) => {
        if (args.length === 1) return completeCorporation(args[0]);
        if (args.length === 2) return completeNation(args[1], context);
        return [];
      },
    });

    this.register({
      name: 'corp resources',
      description: 'List manufactured resource totals for a nation. Usage: "corp resources [nation]".',
      execute: (args, context) => {
        if (args.length > 1) return 'Usage: corp resources [nation]';

        const target = resolveNationId(args[0], context);
        if (!target.ok) return target.message;

        const produced = context.corporationSystem.getNationManufacturedResources(target.nationId);
        const available = context.resourceAccessSystem.getAvailableManufacturedResourceQuantities(target.nationId);
        const imported = context.resourceAccessSystem.getImportedResources(target.nationId)
          .filter((resourceId) => getManufacturedResourceById(resourceId) !== undefined);
        const exportable = context.resourceAccessSystem.getExportableResourceQuantities(target.nationId)
          .filter((entry) => getManufacturedResourceById(entry.resourceId) !== undefined);

        if (produced.size === 0 && available.length === 0 && imported.length === 0 && exportable.length === 0) {
          return `${target.label} has no manufactured corporation resources.`;
        }

        return [
          `Produced: ${formatManufacturedMap(produced)}`,
          `Available: ${formatManufacturedEntries(available)}`,
          `Imported: ${imported.length > 0 ? imported.map(formatManufacturedResourceName).join(', ') : 'none'}`,
          `Exportable: ${formatManufacturedEntries(exportable)}`,
        ].join('\n');
      },
      complete: (args, context) => {
        if (args.length === 1) return completeNation(args[0], context);
        return [];
      },
    });

    this.register({
      name: 'autoplay',
      description: 'Run AI for ALL nations for N rounds. Usage: "autoplay <rounds>", "autoplay pause", "autoplay resume", or "autoplay stop".',
      execute: (args, context) => {
        const autoplay = context.autoplaySystem;
        if (args.length === 1 && args[0] === 'stop') {
          if (!autoplay.isActive()) return 'Autoplay is not running.';
          autoplay.stop();
          return 'Autoplay stopped.';
        }
        if (args.length === 1 && args[0] === 'pause') {
          if (!autoplay.isRunning()) return 'Autoplay is not running.';
          autoplay.pause();
          return 'Autoplay paused.';
        }
        if (args.length === 1 && args[0] === 'resume') {
          if (!autoplay.isPaused()) return 'Autoplay is not paused.';
          autoplay.resume();
          return 'Autoplay resumed.';
        }
        if (args.length !== 1) return 'Usage: autoplay <rounds> | pause | resume | stop';
        const rounds = parseInteger(args[0]);
        if (rounds === null || rounds <= 0) return 'Usage: autoplay <rounds> (positive integer)';
        // Restarts cleanly if already active (start() handles the stop internally).
        autoplay.start(rounds);
        return `Autoplay started for ${rounds} round(s).`;
      },
    });

    this.register({
      name: 'playas',
      description: 'Experimental: reload the current game with another nation as the human player. Usage: "playas <nation>".',
      execute: (args, context) => {
        if (args.length !== 1) return 'Usage: playas <nation>';

        const target = resolveNationId(args[0], context);
        if (!target.ok) return target.message;

        return context.switchHumanPlayer(target.nationId);
      },
      complete: (args, context) => {
        if (args.length === 1) return completeNation(args[0], context);
        return [];
      },
    });

    this.register({
      name: 'help',
      description: 'List available commands.',
      execute: () => this.getHelpText(),
    });
  }

  execute(input: string): string {
    const trimmed = input.trim();
    if (trimmed.length === 0) return '';

    const normalized = normalizeCommand(trimmed);
    const command = this.findCommand(normalized);

    if (!command) {
      return `Unknown command: ${trimmed}. Type 'help' for list.`;
    }

    const args = normalized.length === command.name.length
      ? []
      : normalized.slice(command.name.length).trim().split(/\s+/).filter(Boolean);

    return command.execute(args, this.context);
  }

  getCompletions(input: string): CheatCompletionSuggestion[] {
    const trimmedStart = input.trimStart();
    const normalizedInput = normalizeCommand(trimmedStart);
    const command = this.findCommand(normalizedInput);

    if (!command) {
      return this.getCommandCompletions(normalizedInput);
    }

    if (isExactCommandInput(trimmedStart, command)) {
      return [{ value: normalizeCommand(command.name), description: command.description }];
    }

    const args = getCompletionArgs(trimmedStart, command);
    return command.complete?.(args, this.context) ?? [];
  }

  completeInput(input: string): string {
    const trimmedStart = input.trimStart();
    const leadingWhitespace = input.slice(0, input.length - trimmedStart.length);
    const normalizedInput = normalizeCommand(trimmedStart);

    if (normalizedInput.length === 0) return input;

    const command = this.findCommand(normalizedInput);
    const suggestions = command
      ? command.complete?.(getCompletionArgs(trimmedStart, command), this.context) ?? []
      : this.getCommandCompletions(normalizedInput);
    if (suggestions.length !== 1) return input;

    if (!command) {
      return `${leadingWhitespace}${suggestions[0].value} `;
    }

    return `${leadingWhitespace}${replaceCurrentArgument(trimmedStart, command, suggestions[0].value)}`;
  }

  getCompletionReplacement(input: string, suggestion: CheatCompletionSuggestion): string {
    const trimmedStart = input.trimStart();
    const leadingWhitespace = input.slice(0, input.length - trimmedStart.length);
    const normalizedInput = normalizeCommand(trimmedStart);
    const command = this.findCommand(normalizedInput);

    if (!command) return `${leadingWhitespace}${suggestion.value} `;
    if (isExactCommandInput(trimmedStart, command) && normalizeCommand(suggestion.value) === normalizeCommand(command.name)) {
      return `${leadingWhitespace}${normalizeCommand(command.name)} `;
    }
    return `${leadingWhitespace}${replaceCurrentArgument(trimmedStart, command, suggestion.value)}`;
  }

  register(command: CheatCommand): void {
    this.commands.push(command);
    this.commands.sort((a, b) => b.name.length - a.name.length);
  }

  /** Name + description for every registered command (excluding `help`). */
  getCommandSummaries(): { name: string; description: string }[] {
    return this.commands
      .filter((command) => normalizeCommand(command.name) !== 'help')
      .map((command) => ({ name: command.name, description: command.description }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Enumerates the canonical cheat command set without a live game context, for
   * documentation (e.g. the Tutorial view). The constructor only registers
   * command metadata and never touches the context, so a no-op proxy context is
   * safe purely for reading names/descriptions. Keeping this the single source
   * of truth means the docs cannot drift from the real commands.
   */
  static getDocumentedCommands(): { name: string; description: string }[] {
    const proxyContext = new Proxy({}, { get: () => () => undefined }) as unknown as GameContext;
    return new CheatSystem(proxyContext).getCommandSummaries();
  }

  private findCommand(normalizedInput: string): CheatCommand | undefined {
    return this.commands.find((command) => {
      const commandName = normalizeCommand(command.name);
      return normalizedInput === commandName || normalizedInput.startsWith(`${commandName} `);
    });
  }

  private getHelpText(): string {
    return this.commands
      .filter((command) => normalizeCommand(command.name) !== 'help')
      .map((command) => `${command.name} - ${command.description}`)
      .join('\n');
  }

  private getCompletionRoots(): string[] {
    return Array.from(new Set(
      this.commands
        .map((command) => normalizeCommand(command.name).split(' ')[0])
        .filter((root) => root !== 'help'),
    )).sort((a, b) => a.localeCompare(b));
  }

  private getCommandCompletions(normalizedInput: string): CheatCompletionSuggestion[] {
    const commandSuggestions = this.commands
      .filter((command) => normalizeCommand(command.name) !== 'help')
      .map((command) => ({
        value: normalizeCommand(command.name),
        description: command.description,
      }));
    if (normalizedInput.length === 0) {
      return this.getCompletionRoots().map((root) => ({ value: root }));
    }
    return matchSuggestions(normalizedInput, commandSuggestions);
  }
}

function normalizeCommand(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCompletionArgs(input: string, command: CheatCommand): string[] {
  const normalizedCommandName = normalizeCommand(command.name);
  const normalizedInput = normalizeCommand(input);
  const hasTrailingWhitespace = /\s$/.test(input);
  if (isExactCommandInput(input, command)) return [];
  if (normalizedInput === normalizedCommandName) return [''];

  const argText = normalizedInput.length === normalizedCommandName.length
    ? ''
    : normalizedInput.slice(normalizedCommandName.length).trimStart();
  if (argText.length === 0) return [''];
  const args = argText.split(/\s+/);
  if (hasTrailingWhitespace) args.push('');
  return args;
}

function replaceCurrentArgument(input: string, command: CheatCommand, value: string): string {
  const normalizedCommandName = normalizeCommand(command.name);
  const normalizedInput = normalizeCommand(input);
  const hasTrailingWhitespace = /\s$/.test(input);
  if (isExactCommandInput(input, command)) return `${normalizedCommandName} ${value} `;

  const argText = normalizedInput.length === normalizedCommandName.length
    ? ''
    : normalizedInput.slice(normalizedCommandName.length).trimStart();
  if (argText.length === 0) return `${normalizedCommandName} ${value} `;

  const args = argText.split(/\s+/);
  if (hasTrailingWhitespace) {
    args.push(value);
  } else {
    args[args.length - 1] = value;
  }
  return `${normalizedCommandName} ${args.join(' ')} `;
}

function isExactCommandInput(input: string, command: CheatCommand): boolean {
  return normalizeCommand(input) === normalizeCommand(command.name) && !/\s$/.test(input);
}

function completeNation(
  input: string,
  context: GameContext,
  excludedNationIds?: ReadonlySet<string>,
): CheatCompletionSuggestion[] {
  const suggestions = context.nationManager.getAllNations()
    .filter((nation) => !excludedNationIds?.has(nation.id))
    .map((nation) => ({
      value: nation.id,
      label: nation.name,
      description: nation.id,
      matchText: [nation.id, nation.name],
    }));
  return matchSuggestions(input, suggestions);
}

function completeTechnology(input: string): CheatCompletionSuggestion[] {
  return matchSuggestions(input, ALL_TECHNOLOGIES.map((technology) => ({
    value: technology.id,
    label: technology.name,
    description: technology.era,
    matchText: [technology.id, technology.name],
  })));
}

function completeUnit(input: string): CheatCompletionSuggestion[] {
  return matchSuggestions(input, ALL_UNIT_TYPES.map((unitType) => ({
    value: unitType.id,
    label: unitType.name,
    description: unitType.era,
    matchText: [unitType.id, unitType.name],
  })));
}

function completeResource(input: string): CheatCompletionSuggestion[] {
  return matchSuggestions(input, NATURAL_RESOURCES.map((resource) => ({
    value: resource.id,
    label: resource.name,
    description: resource.category,
    matchText: [resource.id, resource.name],
  })));
}

function completeCorporation(input: string): CheatCompletionSuggestion[] {
  return matchSuggestions(input, CORPORATIONS.map((corporation) => ({
    value: corporation.id,
    label: corporation.name,
    description: corporation.id,
    matchText: [corporation.id, corporation.name],
  })));
}

function completeLeader(input: string): CheatCompletionSuggestion[] {
  return matchSuggestions(input, ALL_LEADERS.map((leader) => ({
    value: leader.name,
    label: leader.name,
    description: leader.id,
    matchText: [leader.id, leader.name],
  })));
}

function matchLiteralSuggestions(
  input: string,
  suggestions: ReadonlyArray<CheatCompletionSuggestion>,
): CheatCompletionSuggestion[] {
  return matchSuggestions(input, suggestions.map((suggestion) => ({
    ...suggestion,
    matchText: [suggestion.value, suggestion.label ?? ''],
  })));
}

interface MatchableSuggestion extends CheatCompletionSuggestion {
  matchText?: readonly string[];
}

function matchSuggestions(
  input: string,
  suggestions: ReadonlyArray<MatchableSuggestion>,
): CheatCompletionSuggestion[] {
  const normalizedInput = normalizeCompletionMatchText(input);
  const ranked = suggestions
    .map((suggestion, index) => {
      const rank = getSuggestionRank(normalizedInput, suggestion);
      return { suggestion, index, rank };
    })
    .filter((entry): entry is { suggestion: MatchableSuggestion; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  return ranked.map((entry) => ({
    value: entry.suggestion.value,
    label: entry.suggestion.label,
    description: entry.suggestion.description,
  }));
}

function getSuggestionRank(normalizedInput: string, suggestion: MatchableSuggestion): number | null {
  if (normalizedInput.length === 0) return 0;

  const texts = suggestion.matchText ?? [suggestion.value, suggestion.label ?? ''];
  let bestRank: number | null = null;
  for (const text of texts) {
    const normalizedText = normalizeCompletionMatchText(text);
    const rank = getMatchRank(normalizedInput, normalizedText);
    if (rank !== null && (bestRank === null || rank < bestRank)) {
      bestRank = rank;
    }
  }
  return bestRank;
}

function getMatchRank(normalizedInput: string, normalizedText: string): number | null {
  if (normalizedText === normalizedInput) return 0;
  if (normalizedText.startsWith(normalizedInput)) return 1;
  if (normalizedText.includes(normalizedInput)) return 2;
  return null;
}

function normalizeCompletionMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseInteger(value: string | undefined): number | null {
  if (value === undefined || !/^-?\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

function resolveNationId(
  input: string | undefined,
  context: GameContext,
): { ok: true; nationId: string; label: string } | { ok: false; message: string } {
  if (input === undefined) {
    if (!context.humanNationId) return { ok: false, message: 'No human player' };
    const nation = context.nationManager.getNation(context.humanNationId);
    return {
      ok: true,
      nationId: context.humanNationId,
      label: nation?.name ?? context.humanNationId,
    };
  }

  const normalizedInput = normalizeNationMatchText(input);
  const nations = context.nationManager.getAllNations();

  const exactMatches = nations.filter((nation) =>
    normalizeNationMatchText(nation.id) === normalizedInput ||
    normalizeNationMatchText(nation.name) === normalizedInput
  );
  if (exactMatches.length === 1) {
    return { ok: true, nationId: exactMatches[0].id, label: exactMatches[0].name };
  }
  if (exactMatches.length > 1) return { ok: false, message: `Ambiguous nation: ${input}` };

  const partialMatches = nations.filter((nation) =>
    normalizeNationMatchText(nation.id).includes(normalizedInput) ||
    normalizeNationMatchText(nation.name).includes(normalizedInput)
  );
  if (partialMatches.length === 1) {
    return { ok: true, nationId: partialMatches[0].id, label: partialMatches[0].name };
  }
  if (partialMatches.length > 1) return { ok: false, message: `Ambiguous nation: ${input}` };

  return { ok: false, message: `Unknown nation: ${input}` };
}

function normalizeNationMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function resolveTechnologyId(
  input: string,
): { ok: true; tech: TechnologyDefinition } | { ok: false; message: string } {
  const normalizedInput = normalizeTechnologyMatchText(input);
  if (normalizedInput.length === 0) {
    return { ok: false, message: `Unknown technology: ${input}` };
  }

  const exactMatches = ALL_TECHNOLOGIES.filter((tech) =>
    normalizeTechnologyMatchText(tech.id) === normalizedInput ||
    normalizeTechnologyMatchText(tech.name) === normalizedInput
  );
  if (exactMatches.length === 1) return { ok: true, tech: exactMatches[0] };
  if (exactMatches.length > 1) return { ok: false, message: `Ambiguous technology: ${input}` };

  const partialMatches = ALL_TECHNOLOGIES.filter((tech) =>
    normalizeTechnologyMatchText(tech.id).includes(normalizedInput) ||
    normalizeTechnologyMatchText(tech.name).includes(normalizedInput)
  );
  if (partialMatches.length === 1) return { ok: true, tech: partialMatches[0] };
  if (partialMatches.length > 1) return { ok: false, message: `Ambiguous technology: ${input}` };

  return { ok: false, message: `Unknown technology: ${input}` };
}

function normalizeTechnologyMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function resolveUnitType(
  input: string,
): { ok: true; type: UnitType } | { ok: false; message: string } {
  const normalizedInput = normalizeCompletionMatchText(input);
  if (normalizedInput.length === 0) return { ok: false, message: `Unknown unit: ${input}` };

  const exactMatches = ALL_UNIT_TYPES.filter((unitType) =>
    normalizeCompletionMatchText(unitType.id) === normalizedInput ||
    normalizeCompletionMatchText(unitType.name) === normalizedInput
  );
  if (exactMatches.length === 1) return { ok: true, type: exactMatches[0] };
  if (exactMatches.length > 1) return { ok: false, message: `Ambiguous unit: ${input}` };

  const partialMatches = ALL_UNIT_TYPES.filter((unitType) =>
    normalizeCompletionMatchText(unitType.id).includes(normalizedInput) ||
    normalizeCompletionMatchText(unitType.name).includes(normalizedInput)
  );
  if (partialMatches.length === 1) return { ok: true, type: partialMatches[0] };
  if (partialMatches.length > 1) return { ok: false, message: `Ambiguous unit: ${input}` };

  return { ok: false, message: `Unknown unit: ${input}` };
}

function resolveNaturalResource(
  input: string,
): { ok: true; resource: NaturalResourceDefinition } | { ok: false; message: string } {
  const normalizedInput = normalizeCompletionMatchText(input);
  if (normalizedInput.length === 0) return { ok: false, message: `Unknown resource: ${input}` };

  const exactMatches = NATURAL_RESOURCES.filter((resource) =>
    normalizeCompletionMatchText(resource.id) === normalizedInput ||
    normalizeCompletionMatchText(resource.name) === normalizedInput
  );
  if (exactMatches.length === 1) return { ok: true, resource: exactMatches[0] };
  if (exactMatches.length > 1) return { ok: false, message: `Ambiguous resource: ${input}` };

  const partialMatches = NATURAL_RESOURCES.filter((resource) =>
    normalizeCompletionMatchText(resource.id).includes(normalizedInput) ||
    normalizeCompletionMatchText(resource.name).includes(normalizedInput)
  );
  if (partialMatches.length === 1) return { ok: true, resource: partialMatches[0] };
  if (partialMatches.length > 1) return { ok: false, message: `Ambiguous resource: ${input}` };

  return { ok: false, message: `Unknown resource: ${input}` };
}

function getTechnologyName(techId: string): string {
  return ALL_TECHNOLOGIES.find((technology) => technology.id === techId)?.name ?? techId;
}

function resolveCorporationId(
  input: string,
): { ok: true; corporation: CorporationDefinition } | { ok: false; message: string } {
  const normalizedInput = normalizeCorporationMatchText(input);
  if (normalizedInput.length === 0) {
    return { ok: false, message: `Unknown corporation: ${input}` };
  }

  const exactMatches = CORPORATIONS.filter((corporation) =>
    normalizeCorporationMatchText(corporation.id) === normalizedInput ||
    normalizeCorporationMatchText(corporation.name) === normalizedInput
  );
  if (exactMatches.length === 1) return { ok: true, corporation: exactMatches[0] };
  if (exactMatches.length > 1) return { ok: false, message: `Ambiguous corporation: ${input}` };

  const partialMatches = CORPORATIONS.filter((corporation) =>
    normalizeCorporationMatchText(corporation.id).includes(normalizedInput) ||
    normalizeCorporationMatchText(corporation.name).includes(normalizedInput)
  );
  if (partialMatches.length === 1) return { ok: true, corporation: partialMatches[0] };
  if (partialMatches.length > 1) return { ok: false, message: `Ambiguous corporation: ${input}` };

  return { ok: false, message: `Unknown corporation: ${input}` };
}

function normalizeCorporationMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function formatManufacturedMap(resources: ReadonlyMap<string, number>): string {
  if (resources.size === 0) return 'none';
  return formatManufacturedEntries(
    [...resources.entries()].map(([resourceId, quantity]) => ({ resourceId, quantity })),
  );
}

function formatManufacturedEntries(entries: ReadonlyArray<{
  readonly resourceId: string;
  readonly quantity: number;
}>): string {
  if (entries.length === 0) return 'none';
  return entries
    .map((entry) => `${formatManufacturedResourceName(entry.resourceId)}: ${entry.quantity}`)
    .join(', ');
}

function formatManufacturedResourceName(resourceId: string): string {
  return getManufacturedResourceById(resourceId)?.name ?? resourceId;
}

function producibleName(item: Producible): string {
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

function selectionTilePosition(
  selection: NonNullable<ReturnType<SelectionManager['getSelected']>>,
): { x: number; y: number } | null {
  switch (selection.kind) {
    case 'tile':
      return { x: selection.tile.x, y: selection.tile.y };
    case 'unit':
      return { x: selection.unit.tileX, y: selection.unit.tileY };
    case 'city':
      return { x: selection.city.tileX, y: selection.city.tileY };
  }
}
