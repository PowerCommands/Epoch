import type { GamesOfNationsSport, GamesOfNationsSportId } from '../types/gamesOfNations';

export interface GamesOfNationsSportDefinition {
  readonly id: GamesOfNationsSportId;
  readonly name: GamesOfNationsSport;
  readonly category: 'traditional' | 'additional';
  readonly image: string;
}

const IMAGE_ROOT = '/assets/sprites/news/games-of-nations/';

export const GAMES_OF_NATIONS_SPORT_DEFINITIONS: readonly GamesOfNationsSportDefinition[] = [
  { id: 'wrestling', name: 'Wrestling', category: 'traditional', image: `${IMAGE_ROOT}wrestling.jpg` },
  { id: 'marathon', name: 'Marathon', category: 'traditional', image: `${IMAGE_ROOT}marathon.jpg` },
  { id: 'swimming', name: 'Swimming', category: 'traditional', image: `${IMAGE_ROOT}swimming.jpg` },
  { id: 'javelin', name: 'Javelin', category: 'traditional', image: `${IMAGE_ROOT}javelin.jpg` },
  { id: 'long_jump', name: 'Long Jump', category: 'traditional', image: `${IMAGE_ROOT}long-jump.jpg` },
  { id: 'horse_racing', name: 'Horse Racing', category: 'additional', image: `${IMAGE_ROOT}horse-racing.jpg` },
  { id: 'boxing', name: 'Boxing', category: 'additional', image: `${IMAGE_ROOT}boxing.jpg` },
  { id: 'hundred_metres', name: '100 Metres', category: 'additional', image: `${IMAGE_ROOT}hundred-metres.jpg` },
  { id: 'pole_vault', name: 'Pole Vault', category: 'additional', image: `${IMAGE_ROOT}pole-vault.jpg` },
  { id: 'fencing', name: 'Fencing', category: 'additional', image: `${IMAGE_ROOT}fencing.jpg` },
] as const;

export const TRADITIONAL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS
  .filter((sport) => sport.category === 'traditional');
export const ADDITIONAL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS
  .filter((sport) => sport.category === 'additional');

export const TRADITIONAL_GAMES_SPORT_IDS = TRADITIONAL_GAMES_SPORTS.map((sport) => sport.id);
export const ADDITIONAL_GAMES_SPORT_IDS = ADDITIONAL_GAMES_SPORTS.map((sport) => sport.id);
export const ALL_GAMES_SPORTS = GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => sport.name);

const BY_ID = new Map(GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => [sport.id, sport]));
const BY_NAME = new Map(GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => [sport.name, sport]));

export function getGamesSportById(id: GamesOfNationsSportId): GamesOfNationsSportDefinition {
  return BY_ID.get(id)!;
}

export function getGamesSportByName(name: GamesOfNationsSport): GamesOfNationsSportDefinition {
  return BY_NAME.get(name)!;
}

export function isGamesSportId(value: unknown): value is GamesOfNationsSportId {
  return typeof value === 'string' && BY_ID.has(value as GamesOfNationsSportId);
}

export function isGamesSportName(value: unknown): value is GamesOfNationsSport {
  return typeof value === 'string' && BY_NAME.has(value as GamesOfNationsSport);
}
