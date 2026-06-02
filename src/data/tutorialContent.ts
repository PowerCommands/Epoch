/**
 * Data-driven tutorial content.
 *
 * Each section is a self-contained chapter rendered by `TutorialView`. Content
 * is expressed as structured blocks rather than raw HTML so the view can render
 * it safely and consistently, and so new chapters can be added here without
 * touching any UI logic.
 *
 * The special `cheat-commands` block is a placeholder: the view fills it in at
 * render time from the live cheat command definitions, so the documentation
 * never drifts from the implemented commands.
 */

export type TutorialBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'cheat-commands' };

export interface TutorialSection {
  id: string;
  title: string;
  blocks: TutorialBlock[];
}

export const TUTORIAL_SECTIONS: readonly TutorialSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    blocks: [
      { kind: 'paragraph', text: 'Epoch is a grand-strategy 4X game: you eXplore, eXpand, eXploit and eXterminate as you guide a single civilization through the ages of history.' },
      { kind: 'paragraph', text: 'You begin with little more than a settler and a scout. From there, the world is yours to shape.' },
      { kind: 'heading', text: 'What you will do' },
      {
        kind: 'list',
        items: [
          'Explore the world and uncover what lies beyond the horizon',
          'Build cities and grow their population',
          'Expand your territory through culture and conquest',
          'Research technologies that unlock new possibilities',
          'Establish diplomacy with rival civilizations',
          'Create trade routes to enrich your economy',
          'Wage war when diplomacy is no longer enough',
        ],
      },
      { kind: 'heading', text: 'A world revealed gradually' },
      { kind: 'paragraph', text: 'Information is revealed as you explore. The map starts hidden in fog of war, and only what your units and cities can see is known to you. Discovery is a core part of play — send your scouts out early and often.' },
    ],
  },
  {
    id: 'exploration',
    title: 'Exploration',
    blocks: [
      { kind: 'heading', text: 'Scouts' },
      {
        kind: 'list',
        items: [
          'Scouts are specialized exploration units',
          'They move quickly across the map',
          'They are ideal for discovering the world early in the game',
        ],
      },
      { kind: 'heading', text: 'Fog of War' },
      {
        kind: 'list',
        items: [
          'Black areas of the map are completely unexplored',
          'Exploring reveals terrain, resources and other civilizations',
          'You may still order units to move into unexplored areas — they travel there and reveal the land as they go',
        ],
      },
      { kind: 'heading', text: 'Automated Exploration' },
      { kind: 'paragraph', text: 'Scout units have an Exploration action. When activated, the unit explores on its own using the same logic that AI scouts use.' },
      { kind: 'paragraph', text: 'Automated exploration continues turn after turn until you interrupt it by giving the scout another order.' },
      { kind: 'note', text: 'Auto-exploration is an important quality-of-life feature — set your scouts to explore and let them chart the map while you focus on your cities.' },
    ],
  },
  {
    id: 'cities',
    title: 'Cities',
    blocks: [
      { kind: 'heading', text: 'Founding Cities' },
      {
        kind: 'list',
        items: [
          'Settlers found new cities',
          'Cities are the foundation of your civilization — almost everything you do flows from them',
        ],
      },
      { kind: 'heading', text: 'Population' },
      {
        kind: 'list',
        items: [
          'City population grows over time as food accumulates',
          'Larger cities work more tiles and become more productive',
        ],
      },
      { kind: 'heading', text: 'Territory' },
      {
        kind: 'list',
        items: [
          'Cities expand their cultural borders outward as they grow',
          'Tiles and resources inside your borders become available to work',
        ],
      },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    blocks: [
      { kind: 'heading', text: 'Production Queue' },
      { kind: 'paragraph', text: 'Each city produces things over time. A city can build:' },
      {
        kind: 'list',
        items: [
          'Buildings — permanent improvements that boost the city',
          'Units — settlers, scouts, workers and military forces',
          'Wonders — powerful one-of-a-kind projects',
        ],
      },
      { kind: 'heading', text: 'Queue System' },
      { kind: 'paragraph', text: 'You can queue several items so a city keeps working through them automatically, one after another.' },
      { kind: 'paragraph', text: 'Always try to keep every city producing something — an idle city is wasted potential.' },
      { kind: 'note', text: 'Watch for the city reminder indicator 🏛️. It appears when one or more cities need your attention, such as an empty production queue. Click it to jump straight to the city.' },
    ],
  },
  {
    id: 'technologies',
    title: 'Technologies',
    blocks: [
      { kind: 'heading', text: 'Research' },
      { kind: 'paragraph', text: 'Your civilization researches technologies over time. Each technology unlocks new options:' },
      {
        kind: 'list',
        items: [
          'New buildings',
          'New units',
          'New diplomacy options',
          'Economic improvements',
        ],
      },
      { kind: 'heading', text: 'Early technologies' },
      {
        kind: 'list',
        items: [
          'Writing',
          'Bronze Working',
          'Sailing',
        ],
      },
      { kind: 'note', text: 'Some diplomatic actions require specific technologies. For example, Writing enables map exchange between civilizations.' },
    ],
  },
  {
    id: 'diplomacy',
    title: 'Diplomacy',
    blocks: [
      { kind: 'paragraph', text: 'Diplomacy governs your relationships with other civilizations. The major systems are:' },
      { kind: 'heading', text: 'Embassy' },
      { kind: 'paragraph', text: 'Establishes formal relations between two nations and opens the door to deeper diplomacy.' },
      { kind: 'heading', text: 'Open Borders' },
      { kind: 'paragraph', text: 'Allows your units to move through another nation’s territory (and theirs through yours).' },
      { kind: 'heading', text: 'Trade Relations' },
      { kind: 'paragraph', text: 'Required before you can create trade routes with another nation.' },
      { kind: 'heading', text: 'Alliance' },
      { kind: 'paragraph', text: 'The strongest peaceful relationship. Allies:' },
      {
        kind: 'list',
        items: [
          'Cooperate diplomatically',
          'Can become drawn into each other’s conflicts',
        ],
      },
      { kind: 'heading', text: 'War' },
      { kind: 'paragraph', text: 'Nations can declare war and become hostile. War is required before military units can attack one another.' },
    ],
  },
  {
    id: 'trade',
    title: 'Trade',
    blocks: [
      { kind: 'paragraph', text: 'Trade routes connect your civilization to others and generate ongoing benefits.' },
      { kind: 'heading', text: 'Creating a Trade Route' },
      {
        kind: 'list',
        items: [
          'Establish diplomatic relations with the other nation',
          'Create a trade proposal',
          'Wait while the route is constructed',
          'The route becomes active and starts generating benefits',
        ],
      },
      { kind: 'heading', text: 'In Progress' },
      { kind: 'paragraph', text: 'The trade route is still being established and is not yet producing benefits.' },
      { kind: 'heading', text: 'Active' },
      { kind: 'paragraph', text: 'The trade route is operating and generating benefits for both partners.' },
    ],
  },
  {
    id: 'military',
    title: 'Military',
    blocks: [
      { kind: 'heading', text: 'Military Units' },
      { kind: 'paragraph', text: 'Military units are used for:' },
      {
        kind: 'list',
        items: [
          'Defense of your cities and borders',
          'Expansion into contested land',
          'Warfare against rival civilizations',
        ],
      },
      { kind: 'heading', text: 'Unit Movement' },
      {
        kind: 'list',
        items: [
          'Select a unit',
          'Click a destination tile',
          'The unit travels there automatically, even across multiple turns',
        ],
      },
      { kind: 'paragraph', text: 'Naval transport uses embark and debark mechanics: land units can board the water to cross seas and disembark onto land on the far side.' },
      { kind: 'heading', text: 'Combat' },
      {
        kind: 'list',
        items: [
          'Combat occurs when hostile units engage one another',
          'Cities can be attacked and captured',
        ],
      },
    ],
  },
  {
    id: 'culture',
    title: 'Culture',
    blocks: [
      { kind: 'heading', text: 'Cultural Expansion' },
      { kind: 'paragraph', text: 'Culture expands your cities’ borders, claiming new tiles for your civilization over time.' },
      { kind: 'heading', text: 'Cultural Identity' },
      { kind: 'paragraph', text: 'Different nations develop unique strengths and characteristics as they progress.' },
      { kind: 'heading', text: 'Influence' },
      { kind: 'paragraph', text: 'Culture contributes to territorial control and to the broader development of your civilization.' },
    ],
  },
  {
    id: 'resources',
    title: 'Resources',
    blocks: [
      { kind: 'heading', text: 'Strategic Resources' },
      { kind: 'paragraph', text: 'Strategic resources are required to build advanced units. Examples:' },
      {
        kind: 'list',
        items: [
          'Iron',
          'Horses',
        ],
      },
      { kind: 'heading', text: 'Luxury Resources' },
      { kind: 'paragraph', text: 'Luxury resources improve the quality of life and prosperity of your civilization.' },
      { kind: 'heading', text: 'Access' },
      { kind: 'paragraph', text: 'A resource must be inside territory you control before you can make use of it.' },
    ],
  },
  {
    id: 'victory',
    title: 'Victory & Objectives',
    blocks: [
      { kind: 'paragraph', text: 'Epoch is a sandbox-oriented strategy game. Rather than chasing a single rigid win condition, you are encouraged to build the civilization you want.' },
      { kind: 'paragraph', text: 'There are many ways to play:' },
      {
        kind: 'list',
        items: [
          'Explore the far reaches of the world',
          'Expand across continents',
          'Build prosperous, thriving civilizations',
          'Forge alliances and lead through diplomacy',
          'Dominate your rivals militarily',
          'Experiment with completely different approaches',
        ],
      },
      { kind: 'paragraph', text: 'The real goal is to create a successful civilization and enjoy the history you make along the way.' },
    ],
  },
  {
    id: 'cheat-panel',
    title: 'Cheat Panel',
    blocks: [
      { kind: 'paragraph', text: 'The Cheat Panel is a built-in console of developer tools. Open it at any time during a game with Ctrl + Shift + C, type a command, and press Enter. Press Tab to autocomplete.' },
      { kind: 'paragraph', text: 'These tools are intended for:' },
      {
        kind: 'list',
        items: [
          'Testing features and edge cases',
          'Learning how the game’s systems work',
          'Experimentation and tinkering',
          'Scenario creation and setup',
          'Observing AI behavior',
        ],
      },
      { kind: 'heading', text: 'Autoplay' },
      { kind: 'paragraph', text: 'Autoplay is the most powerful tool in the panel. It temporarily hands control of your civilization (and the world) to the AI.' },
      { kind: 'paragraph', text: 'While Autoplay runs, the AI will:' },
      {
        kind: 'list',
        items: [
          'Move units around the map',
          'Manage and grow cities',
          'Research technologies',
          'Conduct diplomacy with other nations',
          'Wage wars',
          'Expand the empire',
        ],
      },
      { kind: 'paragraph', text: 'Why use it? Autoplay lets you:' },
      {
        kind: 'list',
        items: [
          'Observe how the AI makes decisions',
          'Learn game mechanics by watching them in action',
          'Test strategies and see how they unfold',
          'Watch alternate histories emerge',
          'Study the impact of balance changes',
        ],
      },
      { kind: 'paragraph', text: 'Suggested ways to use it:' },
      {
        kind: 'list',
        items: [
          'Run 50 turns and see how the map develops',
          'Observe how neighboring civilizations grow and compete',
          'Let the AI try to recover a struggling empire',
          'Watch long-term geopolitical developments play out',
        ],
      },
      { kind: 'note', text: 'Many players enjoy using Autoplay almost as a simulation mode — start a world, sit back, and watch history happen.' },
      { kind: 'paragraph', text: 'Control Autoplay from the cheat console: "autoplay <rounds>" to run, and "autoplay pause", "autoplay resume" or "autoplay stop" to manage it.' },
      { kind: 'heading', text: 'Cheat Command Reference' },
      { kind: 'paragraph', text: 'Every cheat command currently available is listed below, generated directly from the game’s definitions:' },
      { kind: 'cheat-commands' },
    ],
  },
];
