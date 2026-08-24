import type { GamesOfNationsSportResolvedEvent } from './GamesOfNationsSystem';
import type { GamesOfNationsSport } from '../types/gamesOfNations';
import type {
  GamesOfNationsNewspaperIssue,
  NewspaperArticle,
} from '../types/newspaper';

const IMAGE_ROOT = '/assets/sprites/news/games-of-nations/';

export const GAMES_OF_NATIONS_SPORT_IMAGES: Readonly<Record<GamesOfNationsSport, string>> = {
  Wrestling: `${IMAGE_ROOT}wrestling.jpg`,
  Marathon: `${IMAGE_ROOT}marathon.jpg`,
  Swimming: `${IMAGE_ROOT}swimming.jpg`,
  Javelin: `${IMAGE_ROOT}javelin.jpg`,
  'Long Jump': `${IMAGE_ROOT}long-jump.jpg`,
};

/** Flavor-only identities: exactly 100 names, deliberately not nation-specific. */
export const GAMES_OF_NATIONS_ATHLETE_NAMES = [
  'Adrian Vale', 'Aisha Rowan', 'Alejandro Voss', 'Amara Bell', 'Anika Stone',
  'Arden Cole', 'Ari Mercer', 'Beatrice Hale', 'Benoit Carver', 'Bianca Reyes',
  'Caleb North', 'Camille Duran', 'Carmen Wells', 'Cassian Reed', 'Celeste Marin',
  'Dalia Quinn', 'Damon Pierce', 'Daniela Frost', 'Darius Wynn', 'Delia Hart',
  'Elias Morel', 'Elina Ward', 'Emil Navarro', 'Esme Laurent', 'Evan Calder',
  'Farah Linden', 'Felix Arden', 'Freya Solberg', 'Gabriel Neri', 'Giselle Park',
  'Hana Mercer', 'Hector Blaine', 'Helena Cross', 'Hugo Serrat', 'Idris Vale',
  'Imani Rhodes', 'Ines Caron', 'Iris Novak', 'Isaac Bell', 'Jasper Kade',
  'Jonas Varela', 'Julia Morrow', 'Kai Delaney', 'Karina Moss', 'Keira Anton',
  'Lara Quinn', 'Leandro Sanz', 'Leila Monroe', 'Leon Darrow', 'Lina Corbett',
  'Lucian Webb', 'Maeve Arden', 'Malik Rowan', 'Mara Velez', 'Marcel Hart',
  'Maya Lind', 'Mina Duarte', 'Nadia Wells', 'Nico Ferran', 'Noa Sinclair',
  'Noemi Calder', 'Omar Vance', 'Ophelia Kent', 'Orion Blake', 'Paolo Mercer',
  'Petra Marin', 'Quentin Ames', 'Rafael Stone', 'Rhea Navarro', 'Rina Cole',
  'Robin Serrat', 'Rosa Delaney', 'Rowan Pierce', 'Sabine Cross', 'Samir Frost',
  'Selene Morel', 'Sofia Voss', 'Soren Bell', 'Talia Wynn', 'Tariq Hale',
  'Theo Laurent', 'Una Carver', 'Valentina Reed', 'Vera North', 'Victor Duran',
  'Violeta Park', 'Wesley Morrow', 'Willow Neri', 'Xavier Rhodes', 'Yara Corbett',
  'Yasmin Kade', 'Zane Caron', 'Zara Blaine', 'Avery Moss', 'Cleo Anton',
  'Dorian Lind', 'Elise Duarte', 'Finn Varela', 'Greta Monroe', 'Milo Ames',
] as const;

export interface GamesChronicleContext {
  event: GamesOfNationsSportResolvedEvent;
  dateLabel: string;
  worldYear: number;
  getNationName: (nationId: string) => string | undefined;
  seed: string;
}

export function buildGamesOfNationsEdition(context: GamesChronicleContext): GamesOfNationsNewspaperIssue {
  const { event } = context;
  const usedNames = new Set<string>();
  const athlete = (role: string): string => selectAthleteName(
    `${context.seed}|${event.gamesNumber}|${event.sport}|${role}`,
    usedNames,
  );
  const nationName = (id: string | undefined, fallback: string): string =>
    id ? context.getNationName(id) ?? id : fallback;
  const goldName = nationName(event.result.goldNationId, 'No nation');
  const silverName = nationName(event.result.silverNationId, 'No nation');
  const bronzeName = nationName(event.result.bronzeNationId, 'No nation');
  const hostName = nationName(event.hostNationId, 'The host nation');
  const hostCity = event.hostCityName ?? 'the host city';

  const goldAthlete = event.result.goldNationId ? athlete('gold') : undefined;
  const silverAthlete = event.result.silverNationId ? athlete('silver') : undefined;
  const bronzeAthlete = event.result.bronzeNationId ? athlete('bronze') : undefined;
  const mainArticle = buildGoldArticle(event.sport, goldName, goldAthlete, hostCity, event, context.seed);
  const podiumArticle = buildPodiumArticle(
    event.sport,
    event.result.silverNationId,
    event.result.silverNationId ? silverName : undefined,
    silverAthlete,
    event.result.bronzeNationId,
    event.result.bronzeNationId ? bronzeName : undefined,
    bronzeAthlete,
  );
  const hostArticle = buildHostArticle(event.hostNationId, hostName, hostCity, event.competitionDay, context.seed, event.gamesNumber);
  const previewArticle = event.nextSport
    ? buildNextSportArticle(event, context, athlete)
    : buildClosingArticle(event, nationName(event.overallWinnerNationId, 'the leading nations'), hostCity);

  return {
    id: `games-special-${event.gamesNumber}-${event.competitionDay}-${event.turn}`,
    issueType: 'gamesSpecial',
    gamesNumber: event.gamesNumber,
    competitionDay: event.competitionDay,
    sport: event.sport,
    issueRound: event.turn,
    coverageStartRound: event.turn,
    coverageEndRound: event.turn,
    worldYear: context.worldYear,
    dateLabel: context.dateLabel,
    mainArticle,
    secondaryArticles: [podiumArticle, hostArticle, previewArticle],
  };
}

export function selectNextSportFavorite(
  candidates: readonly { nationId: string; gamesPoints: number }[],
): string | undefined {
  let favorite: { nationId: string; gamesPoints: number } | undefined;
  for (const candidate of candidates) {
    if (candidate.gamesPoints <= 0) continue;
    if (!favorite || candidate.gamesPoints > favorite.gamesPoints) favorite = candidate;
  }
  return favorite?.nationId;
}

function buildGoldArticle(
  sport: GamesOfNationsSport,
  nationName: string,
  athleteName: string | undefined,
  hostCity: string,
  event: GamesOfNationsSportResolvedEvent,
  seed: string,
): NewspaperArticle {
  if (!event.result.goldNationId || !athleteName) {
    return article(
      `${sport.toLocaleUpperCase()} ENDS WITHOUT A CHAMPION`,
      `An unusually empty field in ${hostCity} left today's ${sport} contest without a Gold medalist.`,
      'Officials confirmed that no competitor met the Games eligibility rules.',
      [],
      [],
      GAMES_OF_NATIONS_SPORT_IMAGES[sport],
    );
  }
  const vocabulary = SPORT_COPY[sport];
  const headlines = [
    `${nationName.toLocaleUpperCase()} TAKES ${sport.toLocaleUpperCase()} GOLD!`,
    `${nationName.toLocaleUpperCase()} TRIUMPHS IN ${sport.toLocaleUpperCase()}!`,
    `${sport.toLocaleUpperCase()} GLORY FOR ${nationName.toLocaleUpperCase()}!`,
  ];
  const bodies = [
    `${athleteName} of ${nationName} claimed Gold after a commanding ${vocabulary.contest} in ${hostCity}, delivering the decisive ${vocabulary.finish}.`,
    `${nationName}'s ${athleteName} mastered the ${vocabulary.stage} in ${hostCity} and emerged as today's ${sport} champion.`,
    `Cheers swept through ${hostCity} as ${athleteName} secured ${sport} Gold for ${nationName} with a memorable ${vocabulary.finish}.`,
  ];
  const variant = stableIndex(`${seed}|${event.gamesNumber}|${sport}|gold-copy`, headlines.length);
  return article(
    headlines[variant]!,
    bodies[variant]!,
    `The Epoch Chronicle salutes today's champion, ${athleteName}.`,
    [event.result.goldNationId],
    [nationName],
    GAMES_OF_NATIONS_SPORT_IMAGES[sport],
  );
}

function buildPodiumArticle(
  sport: GamesOfNationsSport,
  silverNationId: string | undefined,
  silverNation: string | undefined,
  silverAthlete: string | undefined,
  bronzeNationId: string | undefined,
  bronzeNation: string | undefined,
  bronzeAthlete: string | undefined,
): NewspaperArticle {
  if (silverNation && silverAthlete && bronzeNation && bronzeAthlete) {
    return article(
      `${silverNation.toLocaleUpperCase()} AND ${bronzeNation.toLocaleUpperCase()} COMPLETE THE PODIUM`,
      `${silverAthlete} of ${silverNation} claimed Silver, while ${bronzeNation}'s ${bronzeAthlete} secured Bronze after a fiercely contested ${SPORT_COPY[sport].contest}.`,
      'Every place on the podium was earned today.',
      [silverNationId!, bronzeNationId!],
      [silverNation, bronzeNation],
    );
  }
  if (silverNation && silverAthlete) {
    return article(
      `${silverNation.toLocaleUpperCase()} CLAIMS THE ONLY OTHER MEDAL`,
      `${silverAthlete} earned Silver for ${silverNation}; the small field meant no Bronze medal was awarded in today's ${sport}.`,
      'The medal ceremony was brief, but no less proud.',
      [silverNationId!],
      [silverNation],
    );
  }
  return article(
    'A PODIUM WITH EMPTY STEPS',
    `No Silver or Bronze medal was awarded in today's ${sport}, reflecting an exceptionally small eligible field.`,
    'Organizers insist the unused podium space was entirely intentional.',
    [],
    [],
  );
}

const HOST_TEMPLATES = [
  (nation: string, city: string) => [`${city.toLocaleUpperCase()} ORGANIZATION PRAISED BY ${nation.toLocaleUpperCase()}`, `${nation} officials report that every detail in ${city} has been flawless, a conclusion generously confirmed by the officials themselves.`],
  (nation: string, city: string) => [`${city.toLocaleUpperCase()} TRANSPORT DECLARED A MODERN MARVEL`, `${nation} credits ${city}'s perfect transport for spectators arriving precisely where organizers hoped they would.`],
  (nation: string, city: string) => [`RECORD CROWDS CHEER ${city.toLocaleUpperCase()}`, `${nation} says the magnificent crowds prove that ${city} has become the unquestioned center of international sport.`],
  (nation: string, city: string) => [`${nation.toLocaleUpperCase()} HOSPITALITY WINS UNIVERSAL ACCLAIM`, `Visitors in ${city} have enjoyed such excellent food and hospitality that host officials expect formal thanks from every nation at any moment.`],
  (nation: string, city: string) => [`${city.toLocaleUpperCase()} ONCE AGAIN OUTSHINES EVERY CITY`, `${nation} describes the host city as more beautiful with every Competition day, an improvement experts had considered impossible.`],
  (nation: string, city: string) => [`INTERNATIONAL HARMONY BLOOMS IN ${city.toLocaleUpperCase()}`, `${nation} credits its impeccable hosting for unprecedented friendship among rivals, particularly whenever host photographers are nearby.`],
  (nation: string, city: string) => [`${nation.toLocaleUpperCase()} CLAIMS RECORD-BREAKING GAMES ALREADY`, `Authorities in ${city} have declared these the greatest Games in history, with several Competition days still available to improve upon perfection.`],
  (nation: string, city: string) => [`PERFECT WEATHER CREDITED TO ${nation.toLocaleUpperCase()} ORGANIZERS`, `Officials in ${city} confirm that even the skies appear committed to the host nation's carefully prepared Games schedule.`],
] as const;

function buildHostArticle(hostNationId: string | undefined, hostNation: string, hostCity: string, day: number, seed: string, gamesNumber: number): NewspaperArticle {
  const start = stableIndex(`${seed}|${gamesNumber}|host-propaganda`, HOST_TEMPLATES.length);
  const template = HOST_TEMPLATES[(start + day - 1) % HOST_TEMPLATES.length]!;
  const [headline, body] = template(hostNation, hostCity);
  return article(
    headline,
    body,
    `A statement issued with considerable confidence by ${hostNation}.`,
    hostNationId ? [hostNationId] : [],
    [hostNation],
  );
}

function buildNextSportArticle(
  event: GamesOfNationsSportResolvedEvent,
  context: GamesChronicleContext,
  athlete: (role: string) => string,
): NewspaperArticle {
  const nextSport = event.nextSport!;
  const favoriteId = selectNextSportFavorite(event.nextSportCandidates);
  if (!favoriteId) {
    return article(
      `TOMORROW'S ${nextSport.toLocaleUpperCase()} APPEARS WIDE OPEN`,
      `No nation enters tomorrow's ${nextSport} as a clear favorite, leaving anticipation high across the Games.`,
      'The Chronicle expects opportunity—and nerves—in equal measure.',
      [],
      [],
    );
  }
  const favoriteName = context.getNationName(favoriteId) ?? favoriteId;
  const favoriteAthlete = athlete('next-favorite');
  return article(
    `${favoriteName.toLocaleUpperCase()} FAVORED FOR TOMORROW'S ${nextSport.toLocaleUpperCase()}`,
    `${favoriteAthlete} of ${favoriteName} enters tomorrow's ${nextSport} with high expectations after the nation devoted more preparation to the event than any rival.`,
    'A favorite has been named, but the lottery for medals remains gloriously uncertain.',
    [favoriteId],
    [favoriteName],
  );
}

function buildClosingArticle(
  event: GamesOfNationsSportResolvedEvent,
  winnerName: string,
  hostCity: string,
): NewspaperArticle {
  if (event.overallWinnerNationId) {
    return article(
      `${winnerName.toLocaleUpperCase()} LEADS GAMES INTO CLOSING CELEBRATION`,
      `With the final medal table settled, ${winnerName} will be celebrated as the overall winner when the Games conclude in ${hostCity}.`,
      'No sixth sport awaits—only ceremony, applause, and extensive host speeches.',
      [event.overallWinnerNationId],
      [winnerName],
    );
  }
  return article(
    'FINAL STANDINGS SET AS GAMES PREPARE TO CLOSE',
    `Competition is complete and ${hostCity} now turns toward the closing celebration, with no overall winner emerging from the medal table.`,
    'The stadium prepares for one last international ovation.',
    [],
    [],
  );
}

function article(
  headline: string,
  body: string,
  comment: string,
  involvedNationIds: string[],
  involvedNationNames: string[],
  imagePath?: string,
): NewspaperArticle {
  return {
    headline,
    body,
    comment,
    involvedNationIds,
    involvedNationNames,
    involvedLeaderNames: [],
    imagePath,
  };
}

function selectAthleteName(key: string, used: Set<string>): string {
  const start = stableIndex(key, GAMES_OF_NATIONS_ATHLETE_NAMES.length);
  for (let offset = 0; offset < GAMES_OF_NATIONS_ATHLETE_NAMES.length; offset += 1) {
    const name = GAMES_OF_NATIONS_ATHLETE_NAMES[(start + offset) % GAMES_OF_NATIONS_ATHLETE_NAMES.length]!;
    if (used.has(name)) continue;
    used.add(name);
    return name;
  }
  return GAMES_OF_NATIONS_ATHLETE_NAMES[start]!;
}

function stableIndex(key: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

const SPORT_COPY: Readonly<Record<GamesOfNationsSport, { contest: string; stage: string; finish: string }>> = {
  Wrestling: { contest: 'bout', stage: 'mat', finish: 'grapple in the final' },
  Marathon: { contest: 'endurance contest', stage: 'course', finish: 'surge to the finish' },
  Swimming: { contest: 'pool final', stage: 'water', finish: 'charge through the final length' },
  Javelin: { contest: 'throwing final', stage: 'field', finish: 'towering final attempt' },
  'Long Jump': { contest: 'jumping final', stage: 'runway', finish: 'decisive final leap' },
};
