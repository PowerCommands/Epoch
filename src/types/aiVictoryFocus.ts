/** Victory paths currently understood by the AI endgame strategy layer. */
export type AIVictoryFocusType = 'science';

/** The concrete next objective within the active victory path. */
export type AIVictoryFocusObjective =
  | 'foundAerospaceIndustries'
  | 'produceAerospaceParts';

/** Small persistent representation; evaluation and scoring live in AI systems. */
export interface AIVictoryFocusState {
  type: AIVictoryFocusType;
  objective: AIVictoryFocusObjective;
  activatedTurn: number;
}
