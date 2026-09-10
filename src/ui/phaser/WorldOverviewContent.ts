import { getWonderSpritePath, getCorporationSpritePath } from '../../utils/assetPaths';
import type { WorldCouncilResolutionId } from '../../types/worldCouncil';
import { getWonderById } from '../../data/wonders';
import { CORPORATIONS } from '../../data/corporations';
import { getManufacturedResourceById } from '../../data/manufacturedResources';
import type { City } from '../../entities/City';
import type { WonderSystem } from '../../systems/WonderSystem';
import type { CorporationSystem } from '../../systems/CorporationSystem';
import type { GamesOfNationsSystem } from '../../systems/GamesOfNationsSystem';
import type { WorldCouncilSystem } from '../../systems/WorldCouncilSystem';
import type { RightSidebarContent, RightSidebarRow, RightSidebarSection } from './RightSidebarPanelTypes';

export type WorldOverviewCategory = 'wonders' | 'corporations' | 'international';
export const WORLD_OVERVIEW_CATEGORIES: { id: WorldOverviewCategory; label: string }[] = [
  { id: 'wonders', label: 'World Wonders' },
  { id: 'corporations', label: 'Corporations' },
  { id: 'international', label: 'International' },
];

export interface WorldOverviewSources {
  wonders: Pick<WonderSystem, 'getCompletedWonders'> | null;
  corporations: Pick<CorporationSystem, 'getFoundedCorporations'> | null;
  games: Pick<GamesOfNationsSystem, 'getSummary'> | null;
  council: Pick<WorldCouncilSystem, 'getState' | 'getOrganizationName'> | null;
  city: (id: string) => Pick<City, 'id' | 'name' | 'ownerId' | 'tileX' | 'tileY'> | undefined;
  nationName: (id: string) => string;
  knowsNation: (id: string) => boolean;
  knowsCity: (id: string) => boolean;
  seesTile: (x: number, y: number) => boolean;
  focusCity: (id: string) => void;
  resolutionTitle: (id: WorldCouncilResolutionId) => string;
}

const text = (value: string, muted = false): RightSidebarRow => ({ kind: 'text', text: value, muted });

/** Read-only projection of canonical systems; no additional discovery/history state. */
export function buildWorldOverviewContent(category: WorldOverviewCategory, source: WorldOverviewSources): RightSidebarContent {
  const nation = (id: string) => source.knowsNation(id) ? source.nationName(id) : 'Unknown nation';
  const location = (id: string | undefined, label = 'City'): RightSidebarRow => {
    const city = id ? source.city(id) : undefined;
    if (!city) return text(`${label}: location unavailable`, true);
    if (!source.knowsCity(city.id)) return text(`${label}: undiscovered location`, true);
    return {
      kind: 'button', text: `${label}: ${city.name} →`,
      onClick: () => { if (source.knowsCity(city.id)) source.focusCity(city.id); },
    };
  };
  let sections: RightSidebarSection[] = [];
  if (category === 'wonders') {
    // Global completion already controls availability for every nation's production.
    // Ownership/location and live damage still require the appropriate intelligence.
    sections = (source.wonders?.getCompletedWonders() ?? []).map(wonder => {
      const city = source.city(wonder.cityId);
      const known = city && source.knowsCity(city.id);
      const visible = city && source.seesTile(wonder.tileX ?? city.tileX, wonder.tileY ?? city.tileY);
      return {
        spritePath: getWonderSpritePath(wonder.wonderId),
        title: getWonderById(wonder.wonderId)?.name ?? wonder.wonderId,
        rows: [
          text(`Owner: ${known ? nation(wonder.ownerId) : 'Unknown nation'}`),
          location(wonder.cityId),
          text(visible ? (wonder.broken ? 'Damaged — effects suspended until repaired' : 'Active') : 'Completed — current condition unknown', !visible),
        ],
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
    if (!sections.length) sections = [{ title: 'World Wonders', rows: [text('No World Wonders have been completed yet.', true)] }];
  } else if (category === 'corporations') {
    sections = (source.corporations?.getFoundedCorporations() ?? [])
      .filter(corporation => source.knowsNation(corporation.founderNationId))
      .map(corporation => {
        const definition = CORPORATIONS.find(entry => entry.id === corporation.corporationId);
        const good = definition ? getManufacturedResourceById(definition.manufacturedResourceId) : undefined;
        const city = corporation.cityId ? source.city(corporation.cityId) : undefined;
        return {
          spritePath: getCorporationSpritePath(corporation.corporationId),
          title: definition?.name ?? corporation.corporationId,
          rows: [
            text(`Founded by ${nation(corporation.founderNationId)}`),
            location(corporation.cityId, 'Headquarters'),
            ...(city && source.knowsCity(city.id) ? [text(`Headquarters nation: ${nation(city.ownerId)}`)] : []),
            ...(good ? [text(`Manufactured resource: ${good.name}`, true)] : []),
          ],
        };
      }).sort((a, b) => a.title.localeCompare(b.title));
    if (!sections.length) sections = [{ title: 'Corporations', rows: [text('No corporations founded by known nations.', true)] }];
  } else {
    const games = source.games?.getSummary();
    const phases = { inactive: 'Not founded', waitingForFirstGames: 'First Games approaching', preparation: 'Preparation', competition: 'Competition', cancelled: 'Cancelled', cooldown: 'Between Games' };
    const gamesRows: RightSidebarRow[] = games?.founded ? [
      text(games.suspendedForWorldWar ? 'Suspended by World War' : phases[games.phase]),
      ...(games.hostNationId ? [text(`Host: ${nation(games.hostNationId)}`), location(games.hostCityId ?? undefined, 'Host city')] : [text('Host not yet selected', true)]),
      ...(games.upcomingHostNationId && games.upcomingHostCityId !== games.hostCityId ? [text(`Next host: ${nation(games.upcomingHostNationId)}`), location(games.upcomingHostCityId ?? undefined, 'Next host city')] : []),
      ...(!games.suspendedForWorldWar && games.turnsUntilGames !== null ? [text(`Next Games in ${games.turnsUntilGames} turns`)] : []),
      ...(games.activeSports.length ? [text(`Sports: ${games.activeSports.join(', ')}`, true)] : []),
    ] : [text('The Games of Nations have not been founded.', true)];
    const council = source.council?.getState();
    const activeResolutions = council?.enactedResolutions.filter(resolution => resolution.active !== false && !resolution.repealed && !resolution.expired) ?? [];
    const councilRows: RightSidebarRow[] = council ? [
      text(council.status === 'active' ? 'Active' : `Under construction — ${council.constructionTurnsRemaining} turns remaining`),
      location(council.foundingCityId, 'Seat'),
      text(`Founded by ${nation(council.foundingNationId)}`),
      text(`Members: ${council.memberNationIds.map(nation).join(', ') || 'None'}`),
      ...(council.status === 'active' ? [
        text(`Next regular meeting: turn ${council.nextRegularMeetingTurn}`),
        text(`Active resolutions: ${activeResolutions.length}`),
        ...activeResolutions.map(resolution => text([
          source.resolutionTitle(resolution.resolutionId),
          resolution.targetNationId ? nation(resolution.targetNationId) : undefined,
          resolution.secondaryTargetNationId ? nation(resolution.secondaryTargetNationId) : undefined,
          resolution.expirationTurn !== undefined ? `until turn ${resolution.expirationTurn}` : undefined,
        ].filter(Boolean).join(' · '), true)),
      ] : []),
    ] : [text('No World Council or United Nations has been founded.', true)];
    sections = [
      { title: 'Games of Nations', rows: gamesRows },
      { title: source.council?.getOrganizationName() ?? 'World Council / United Nations', rows: councilRows },
    ];
  }
  return { title: 'World Overview', sections };
}
