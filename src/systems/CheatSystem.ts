import type { ResearchSystem } from './ResearchSystem';
import type { ResourceSystem } from './ResourceSystem';

export interface GameContext {
  humanNationId: string | undefined;
  researchSystem: ResearchSystem;
  resourceSystem: ResourceSystem;
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
