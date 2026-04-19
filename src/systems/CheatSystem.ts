import type { CityManager } from './CityManager';
import type { ProductionSystem } from './ProductionSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceSystem } from './ResourceSystem';
import type { SelectionManager } from './SelectionManager';
import type { UnitManager } from './UnitManager';
import type { Producible } from '../types/producible';

export interface GameContext {
  humanNationId: string | undefined;
  researchSystem: ResearchSystem;
  resourceSystem: ResourceSystem;
  productionSystem: ProductionSystem;
  cityManager: CityManager;
  selectionManager: SelectionManager;
  unitManager: UnitManager;
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
      description: 'Set player gold with "gold <integer>" or add gold with "gold add <integer>".',
      execute: (args, context) => {
        if (!context.humanNationId) return 'No human player';

        if (args[0] === 'add') {
          const amount = parseInteger(args[1]);
          if (amount === null || args.length !== 2) return 'Usage: gold add <integer>';

          const total = context.resourceSystem.addGold(context.humanNationId, amount);
          if (total === null) return 'No human player';

          return `Gold added: ${amount}. Total gold: ${total}`;
        }

        const amount = parseInteger(args[0]);
        if (amount === null || args.length !== 1) return 'Usage: gold <integer>';

        const total = context.resourceSystem.setGold(context.humanNationId, amount);
        if (total === null) return 'No human player';

        return `Gold set: ${total}`;
      },
    });

    this.register({
      name: 'research complete',
      description: 'Complete the current research for the player nation.',
      execute: (_args, context) => {
        if (!context.humanNationId) return 'No active research';

        const technology = context.researchSystem.completeCurrentResearch(context.humanNationId);
        if (!technology) return 'No active research';

        return `Research complete: ${technology.name}`;
      },
    });

    this.register({
      name: 'production complete',
      description: 'Complete current production in the selected human city. Use "production complete --all" to finish it in every human city.',
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

        if (args.length !== 0) return 'Usage: production complete [--all]';

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

function producibleName(item: Producible): string {
  switch (item.kind) {
    case 'unit':
      return item.unitType.name;
    case 'building':
      return item.buildingType.name;
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
