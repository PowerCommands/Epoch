export interface NationConfig {
  id: string;
  name: string;
  color: number; // hex-färg, t.ex. 0xff4444
  isHuman?: boolean;
}

/**
 * Nation representerar en spelbar (eller AI-styrd) nation i spelet.
 *
 * Avsiktligt fri från Phaser-beroenden — ren data som kan serialiseras,
 * testas och i framtiden skickas över nätverket.
 */
export class Nation {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  isHuman: boolean;

  constructor(config: NationConfig) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.isHuman = config.isHuman ?? false;
  }
}
