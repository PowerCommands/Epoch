import type { AutoplaySystem } from './AutoplaySystem';
import type { CityManager } from './CityManager';
import type { CultureSystem } from './culture/CultureSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceSystem } from './ResourceSystem';
import type { DiagnosticSystem } from './DiagnosticSystem';
import type { DiscoverySystem } from './DiscoverySystem';
import type { NationManager } from './NationManager';
import type { SelectionManager } from './SelectionManager';
import type { UnitManager } from './UnitManager';
import { ALL_LEADERS } from '../data/leaders';
import { ALL_TECHNOLOGIES, type TechnologyDefinition } from '../data/technologies';
import type { Producible } from '../types/producible';

export interface GameContext {
  humanNationId: string | undefined;
  researchSystem: ResearchSystem;
  cultureSystem: CultureSystem;
  resourceSystem: ResourceSystem;
  diagnosticSystem: DiagnosticSystem;
  discoverySystem: DiscoverySystem;
  nationManager: NationManager;
  productionSystem: ProductionSystem;
  cityManager: CityManager;
  selectionManager: SelectionManager;
  unitManager: UnitManager;
  autoplaySystem: AutoplaySystem;
  revealMapResourcesTemporarily: () => void;
}

export interface CheatCommand {
  name: string;
  description: string;
  execute: (args: string[], context: GameContext) => string;
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

  completeInput(input: string): string {
    const roots = this.getCompletionRoots();
    if (roots.length === 0) return input;

    const trimmedStart = input.trimStart();
    const leadingWhitespace = input.slice(0, input.length - trimmedStart.length);
    const normalizedInput = normalizeCommand(trimmedStart);

    if (normalizedInput.length === 0) {
      return `${leadingWhitespace}${roots[0]} `;
    }

    if (/\s/.test(trimmedStart)) return input;

    const firstToken = normalizedInput.split(' ')[0];
    if (roots.includes(firstToken)) {
      return `${leadingWhitespace}${firstToken} `;
    }

    const matches = roots.filter((root) => root.startsWith(firstToken));
    if (matches.length === 1) {
      return `${leadingWhitespace}${matches[0]} `;
    }

    return input;
  }

  register(command: CheatCommand): void {
    this.commands.push(command);
    this.commands.sort((a, b) => b.name.length - a.name.length);
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
}

function normalizeCommand(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
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

function producibleName(item: Producible): string {
  switch (item.kind) {
    case 'unit':
      return item.unitType.name;
    case 'building':
      return item.buildingType.name;
    case 'wonder':
      return item.wonderType.name;
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
