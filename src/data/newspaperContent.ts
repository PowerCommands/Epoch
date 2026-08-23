import type { NewspaperArticleContext, NewspaperEventDefinition, NewspaperEventType } from '../types/newspaper';

const NEWS_PATH = '/assets/sprites/news/';

export const NEWSPAPER_IMAGE_PATHS = {
  victory: `${NEWS_PATH}victory.png`,
  nationEliminated: `${NEWS_PATH}nation-defeated.png`,
  capitalCaptured: `${NEWS_PATH}capital-lost.png`,
  warDeclared: `${NEWS_PATH}war-declared.png`,
  allianceFormed: `${NEWS_PATH}alliance-formed.png`,
  cityCaptured: `${NEWS_PATH}city-captured.png`,
  peace: `${NEWS_PATH}peace-signed.png`,
  joinedWar: `${NEWS_PATH}war-joined.png`,
  worldCouncilFounded: `${NEWS_PATH}world-council-founded.png`,
  worldCouncilResolution: `${NEWS_PATH}major-resolution.png`,
  wonderBuilt: `${NEWS_PATH}wonder-built.png`,
  eraReached: `${NEWS_PATH}new-era.png`,
  corporationFounded: `${NEWS_PATH}corporation-founded.png`,
  governmentChanged: `${NEWS_PATH}government-changed.png`,
  majorDiscovery: `${NEWS_PATH}discovery.png`,
  cityFounded: `${NEWS_PATH}city-founded.png`,
  firstContact: `${NEWS_PATH}first-contact.png`,
  tradeRouteCompleted: `${NEWS_PATH}trade-route.png`,
  embassyEstablished: `${NEWS_PATH}embassy-established.png`,
  tradeRelations: `${NEWS_PATH}trade-relations.png`,
} as const;

function names(context: NewspaperArticleContext): [string, string] {
  return [context.nationNames[0] ?? 'An unknown nation', context.nationNames[1] ?? 'another nation'];
}

function upper(value: string): string { return value.toLocaleUpperCase(); }

/** Ten era-neutral alternatives, specialized by the factual subject phrase. */
function comments(subject: string): readonly string[] {
  return [
    `Observers say ${subject} may shape the years ahead.`,
    `The wider consequences of ${subject} remain uncertain.`,
    `Across the world, attention has turned to ${subject}.`,
    `Few expect the memory of ${subject} to fade quickly.`,
    `Chroniclers have already marked ${subject} as a notable moment.`,
    `Rival courts are weighing what ${subject} may mean for them.`,
    `For ordinary citizens, the effects of ${subject} are only beginning.`,
    `Diplomats and commanders alike are studying ${subject} closely.`,
    `Whether ${subject} brings lasting change remains to be seen.`,
    `Future generations may judge ${subject} more clearly than the present one.`,
  ];
}

function definition(
  priority: number,
  imagePath: string,
  subject: string,
  buildHeadline: NewspaperEventDefinition['buildHeadline'],
  buildBody: NewspaperEventDefinition['buildBody'],
): NewspaperEventDefinition {
  return { priority, imagePath, buildHeadline, buildBody, comments: comments(subject) };
}

export const NEWSPAPER_EVENT_DEFINITIONS: Readonly<Record<NewspaperEventType, NewspaperEventDefinition>> = {
  nationEliminated: definition(98, NEWSPAPER_IMAGE_PATHS.nationEliminated, 'the fall of a nation', (c) => {
    const [fallen] = names(c); return `${upper(fallen)} FALLS FROM THE WORLD STAGE`;
  }, (c) => { const [fallen, conqueror] = names(c); return `${fallen} has been eliminated${c.nationNames[1] ? ` after the advance of ${conqueror}` : ''}.`; }),
  capitalCaptured: definition(95, NEWSPAPER_IMAGE_PATHS.capitalCaptured, 'the capture of a capital', (c) => {
    const [captor] = names(c); return `${upper(c.cityName ?? 'CAPITAL')} FALLS TO ${upper(captor)}`;
  }, (c) => { const [captor, former] = names(c); return `${captor} has seized ${c.cityName ?? 'a rival capital'} from ${former}.`; }),
  warDeclared: definition(90, NEWSPAPER_IMAGE_PATHS.warDeclared, 'the outbreak of war', (c) => {
    const [a, b] = names(c); return `WAR ERUPTS BETWEEN ${upper(a)} AND ${upper(b)}`;
  }, (c) => { const [a, b] = names(c); return `${a} has declared war on ${b}, ending the peace between them.`; }),
  allianceFormed: definition(87, NEWSPAPER_IMAGE_PATHS.allianceFormed, 'the new alliance', (c) => {
    const [a, b] = names(c); return `${upper(a)} AND ${upper(b)} FORGE ALLIANCE`;
  }, (c) => { const [a, b] = names(c); return `${a} and ${b} have formally joined their fortunes in alliance.`; }),
  cityCaptured: definition(84, NEWSPAPER_IMAGE_PATHS.cityCaptured, 'the captured city', (c) => {
    const [captor] = names(c); return `${upper(c.cityName ?? 'CITY')} FALLS TO ${upper(captor)}`;
  }, (c) => { const [captor, former] = names(c); return `${captor} has captured ${c.cityName ?? 'a city'} from ${former}.`; }),
  peace: definition(82, NEWSPAPER_IMAGE_PATHS.peace, 'the peace agreement', (c) => {
    const [a, b] = names(c); return `${upper(a)} AND ${upper(b)} SIGN PEACE`;
  }, (c) => { const [a, b] = names(c); return `${a} and ${b} have agreed to end hostilities.`; }),
  joinedWar: definition(79, NEWSPAPER_IMAGE_PATHS.joinedWar, 'the widening war', (c) => {
    const [a, b] = names(c); return `${upper(a)} ENTERS WAR AGAINST ${upper(b)}`;
  }, (c) => { const [a, b] = names(c); return `${a} has joined the existing war against ${b}.`; }),
  worldCouncilFounded: definition(77, NEWSPAPER_IMAGE_PATHS.worldCouncilFounded, 'the founding of the world council', () => 'WORLD COUNCIL FOUNDED', (c) => `${c.nationNames[0] ?? 'The nations of the world'} has established a new forum for international deliberation.`),
  worldCouncilResolution: definition(74, NEWSPAPER_IMAGE_PATHS.worldCouncilResolution, 'the council decision', (c) => `COUNCIL ADOPTS ${upper(c.resolutionName ?? 'MAJOR RESOLUTION')}`, (c) => `The World Council has decided the question of ${c.resolutionName ?? 'a major international resolution'}.`),
  wonderBuilt: definition(70, NEWSPAPER_IMAGE_PATHS.wonderBuilt, 'the great construction', (c) => `${upper(c.wonderName ?? 'GREAT WONDER')} COMPLETED`, (c) => `${c.nationNames[0] ?? 'A nation'} has completed ${c.wonderName ?? 'a great wonder'}${c.cityName ? ` in ${c.cityName}` : ''}.`),
  eraReached: definition(68, NEWSPAPER_IMAGE_PATHS.eraReached, 'the dawn of a new era', (c) => `${upper(c.nationNames[0] ?? 'A NATION')} ENTERS THE ${upper(c.eraName ?? 'NEW')} ERA`, (c) => `${c.nationNames[0] ?? 'A nation'} has reached the ${c.eraName ?? 'next'} era.`),
  corporationFounded: definition(65, NEWSPAPER_IMAGE_PATHS.corporationFounded, 'the new corporation', (c) => `${upper(c.corporationName ?? 'NEW CORPORATION')} FOUNDED`, (c) => `${c.nationNames[0] ?? 'A nation'} has founded ${c.corporationName ?? 'a major corporation'}${c.cityName ? ` in ${c.cityName}` : ''}.`),
  governmentChanged: definition(62, NEWSPAPER_IMAGE_PATHS.governmentChanged, 'the change of government', (c) => `${upper(c.nationNames[0] ?? 'A NATION')} ADOPTS ${upper(c.governmentName ?? 'NEW GOVERNMENT')}`, (c) => `${c.nationNames[0] ?? 'A nation'} has adopted ${c.governmentName ?? 'a new form of government'}.`),
  majorDiscovery: definition(58, NEWSPAPER_IMAGE_PATHS.majorDiscovery, 'the major discovery', (c) => `${upper(c.discoveryName ?? 'MAJOR DISCOVERY')} REVEALED`, (c) => `${c.nationNames[0] ?? 'Explorers'} report the discovery of ${c.discoveryName ?? 'a remarkable new frontier'}.`),
  cityFounded: definition(52, NEWSPAPER_IMAGE_PATHS.cityFounded, 'the founding of a city', (c) => `${upper(c.cityName ?? 'NEW CITY')} FOUNDED`, (c) => `${c.nationNames[0] ?? 'A nation'} has founded ${c.cityName ?? 'a new city'}, extending its settlements.`),
  firstContact: definition(48, NEWSPAPER_IMAGE_PATHS.firstContact, 'the first meeting', (c) => { const [a, b] = names(c); return `${upper(a)} MEETS ${upper(b)}`; }, (c) => { const [a, b] = names(c); return `Representatives of ${a} and ${b} have met for the first time.`; }),
  tradeRouteCompleted: definition(42, NEWSPAPER_IMAGE_PATHS.tradeRouteCompleted, 'the new trade route', () => 'NEW TRADE ROUTE OPENS', (c) => `A trade route now links ${c.cityName ?? (c.nationNames.join(' and ') || 'distant markets')}.`),
  embassyEstablished: definition(35, NEWSPAPER_IMAGE_PATHS.embassyEstablished, 'the new embassy', (c) => { const [a, b] = names(c); return `${upper(a)} OPENS EMBASSY IN ${upper(b)}`; }, (c) => { const [a, b] = names(c); return `${a} has established a permanent embassy in ${b}.`; }),
  tradeRelations: definition(32, NEWSPAPER_IMAGE_PATHS.tradeRelations, 'the trade agreement', (c) => { const [a, b] = names(c); return `${upper(a)} AND ${upper(b)} ESTABLISH TRADE`; }, (c) => { const [a, b] = names(c); return `${a} and ${b} have opened formal trade relations.`; }),
};
