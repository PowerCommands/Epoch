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
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'cheat-commands' };

export interface TutorialSection {
  id: string;
  title: string;
  blocks: TutorialBlock[];
}

export const TUTORIAL_SECTIONS: readonly TutorialSection[] = [
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    blocks: [
      { kind: 'paragraph', text: 'Epoch can be played almost entirely from the keyboard. The shortcuts below cover normal play, the cheat panel and the scenario editor.' },
      { kind: 'heading', text: 'During Play' },
      {
        kind: 'list',
        items: [
          'Enter / Return (or Numpad Enter) — End the current turn',
          'Space — Skip the active unit and move to the next unit in the turn queue',
          'C — Center the camera on the active unit, or on your capital if no unit is active',
          'M — Put the selected unit into Move mode',
          'A — Put the selected unit into Attack mode',
          'R — Put the selected unit into Ranged Attack mode',
          'S — Put the selected unit to Sleep; on a working unit it cancels the current build instead',
          'Tab — While a city is open, jump to your next city (Shift + Tab for the previous one)',
          'Esc — Release a focused unit into inspect mode, close an open panel, or open the game menu',
          'Ctrl + Q — Open or close the game menu',
          'Ctrl + S — Open the Save Game dialog',
        ],
      },
      { kind: 'note', text: 'While you are typing in a text field (for example renaming a city), shortcuts are paused so your keystrokes go to the field.' },
      { kind: 'heading', text: 'Cheat Panel' },
      {
        kind: 'list',
        items: [
          'Ctrl + Shift + C — Open or close the cheat panel',
          'Enter — Run the typed command',
          'Tab — Autocomplete the current command',
          'Arrow Up / Arrow Down — Browse previously entered commands',
          'Esc — Close the cheat panel',
        ],
      },
      { kind: 'heading', text: 'Scenario Editor' },
      {
        kind: 'list',
        items: [
          'Ctrl + Z — Undo your most recent brush stroke',
          'Ctrl + Shift + Z — Redo an undone action',
        ],
      },
    ],
  },
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
    id: 'happiness',
    title: 'Happiness',
    blocks: [
      { kind: 'paragraph', text: 'Happiness 😀 is measured for your whole nation, not city by city. It is shown in the top resource bar, along with your current mood — from Crisis at the low end up to a Golden Age at the very top.' },
      { kind: 'heading', text: 'What raises happiness' },
      {
        kind: 'list',
        items: [
          'Happiness buildings such as temples and colosseums',
          'World Wonders',
          'Luxury resources inside your territory',
          'Certain policies and culture effects',
        ],
      },
      { kind: 'heading', text: 'What lowers happiness' },
      {
        kind: 'list',
        items: [
          'Each city you own',
          'Large populations',
          'Recently conquered cities',
          'War weariness from prolonged conflict',
        ],
      },
      { kind: 'heading', text: 'Why it matters' },
      { kind: 'paragraph', text: 'Your happiness state applies nation-wide modifiers. A happy or prosperous nation grows faster and produces more, while an unhappy nation suffers penalties to growth and production. If happiness collapses into unrest or crisis, growth can stop entirely and production falls sharply.' },
      { kind: 'note', text: 'Expanding quickly is powerful, but every new city adds unhappiness. Balance expansion with happiness buildings and luxury resources so your empire keeps growing.' },
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
      { kind: 'note', text: 'Some diplomatic actions require specific technologies. For example, Writing unlocks the Establish Embassy and Exchange Maps actions with nations you have met.' },
      { kind: 'heading', text: 'Eras' },
      { kind: 'paragraph', text: 'Technology and culture carry your civilization through the ages — Ancient, Classical, Medieval, Renaissance, Industrial, Modern and beyond. Reaching a new era unlocks more advanced units, buildings and options, and some units and improvements only become fully effective in later eras.' },
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
    id: 'world-council',
    title: 'The World Council',
    blocks: [
      { kind: 'paragraph', text: 'The World Council is a global forum where nations meet to pass resolutions. Once founded it convenes regularly, and it can later evolve into the United Nations. It is the arena in which Diplomatic Victory is contested.' },
      { kind: 'heading', text: 'Influence' },
      { kind: 'paragraph', text: 'Influence is a resource shown in the top resource bar. Your cities generate it each turn — larger populations produce more — and certain policies increase it further. You spend Influence at the council to support the resolutions you favour.' },
      { kind: 'heading', text: 'Resolutions' },
      { kind: 'paragraph', text: 'At each meeting, resolutions are put forward — trade agreements, sanctions, shared cartography, peacekeeping and more. Nations then vote by committing Influence for or against each proposal.' },
      {
        kind: 'list',
        items: [
          'The nation that proposes a resolution that passes earns the most Diplomatic Score',
          'Nations that spend Influence to support a resolution that passes share a smaller reward, split by how much Influence they committed',
          'Blocking a rival’s proposal earns no score directly, but denying them their reward can be worth it',
        ],
      },
      { kind: 'heading', text: 'Emergencies' },
      { kind: 'paragraph', text: 'Events such as a declaration of war can trigger an emergency meeting. Donating gold to an emergency Defense Support resolution grants a small, one-time score reward.' },
      { kind: 'note', text: 'Consistent participation is the key to Diplomatic Victory — build Influence, propose resolutions that can pass, and back winning coalitions meeting after meeting.' },
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
      { kind: 'heading', text: 'Trade Capacity' },
      { kind: 'paragraph', text: 'A city must have available Trade Capacity to create a trade route. Each route consumes one capacity in both participating cities, so a city with none cannot start (or be the target of) a new route.' },
      { kind: 'paragraph', text: 'Trade Capacity comes from commercial and port buildings:' },
      {
        kind: 'list',
        items: [
          'Market: +1 Trade Capacity',
          'Harbor: +2 Trade Capacity',
          'Seaport: +3 Trade Capacity',
          'Stock Exchange: +2 Trade Capacity',
        ],
      },
      { kind: 'note', text: 'If a city is shown disabled in the trade route proposal table, it usually means it has no available Trade Capacity. Build commercial or port buildings there to unlock more routes.' },
      { kind: 'heading', text: 'In Progress' },
      { kind: 'paragraph', text: 'The trade route is still being established and is not yet producing benefits.' },
      { kind: 'heading', text: 'Active' },
      { kind: 'paragraph', text: 'The trade route is operating and generating benefits for both partners.' },
    ],
  },
  {
    id: 'currency',
    title: 'Currency',
    blocks: [
      { kind: 'paragraph', text: 'Once you research Currency, your civilization gains its own named national currency, shown with its symbol and strength in the top resource bar.' },
      { kind: 'heading', text: 'Currency Strength' },
      { kind: 'paragraph', text: 'Your currency is ranked against the currencies of other active nations, and its strength is re-evaluated periodically. Strength ranges from Collapsing, through Weak, Stable and Strong, up to Dominant — the single strongest currency in the world.' },
      { kind: 'paragraph', text: 'Currency strength is driven by the health of your economy:' },
      {
        kind: 'list',
        items: [
          'Gold reserves and income',
          'Active trade relations and trade partners',
          'Corporations and banks',
        ],
      },
      { kind: 'note', text: 'Only the highest-ranked currency is Dominant, and a Dominant currency is one of the three requirements for a Cultural Victory. A strong economy therefore feeds directly into your victory options.' },
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
    id: 'espionage',
    title: 'Espionage & Insurgency',
    blocks: [
      { kind: 'paragraph', text: 'Not all conflicts are fought by conventional armies.' },
      { kind: 'heading', text: 'Spy' },
      { kind: 'paragraph', text: 'Available in the Medieval Era.' },
      { kind: 'paragraph', text: 'Spies can infiltrate foreign cities to gather intelligence about rival nations. They can also sabotage improvements without declaring war. Spies can only be detected and defeated by other Spies or Agents.' },
      { kind: 'heading', text: 'Agent' },
      { kind: 'paragraph', text: 'Available in the Industrial Era.' },
      { kind: 'paragraph', text: 'Agents are more advanced operatives that perform the same tasks as Spies but are better suited for modern covert operations. Agents can counter enemy Spies and Agents while gathering intelligence and conducting sabotage missions.' },
      { kind: 'heading', text: 'Partisan' },
      { kind: 'paragraph', text: 'Partisans are irregular fighters that operate behind enemy lines. They belong to a hidden nation and can engage in combat without formally representing another civilization. Partisans automatically seek out enemies and fight on their own, although human players may relocate them if desired.' },
      { kind: 'heading', text: 'Rebel' },
      { kind: 'paragraph', text: 'Rebels represent local uprisings and resistance movements. Like Partisans, they operate independently and belong to a hidden nation. Rebels automatically engage nearby enemies and continue fighting without direct control.' },
      { kind: 'heading', text: 'Intel Operations' },
      { kind: 'paragraph', text: 'When a Spy or Agent enters a foreign city, the Intel action becomes available.' },
      { kind: 'paragraph', text: 'Intel reveals:' },
      {
        kind: 'list',
        items: [
          "The target nation's cities",
          'Current production in each city',
          'Strategic information about the rival civilization',
        ],
      },
      { kind: 'heading', text: 'Counter Intelligence' },
      { kind: 'paragraph', text: 'Enemy Spies and Agents can block intelligence gathering by occupying the same city. Covert units are the only units capable of detecting and fighting other covert units.' },
    ],
  },
  {
    id: 'culture',
    title: 'Culture',
    blocks: [
      { kind: 'paragraph', text: 'Culture is a second research track that runs alongside technology. Where technology advances your tools, buildings and units, culture advances your society — its laws, institutions and traditions.' },
      { kind: 'heading', text: 'The Culture Tree' },
      { kind: 'paragraph', text: 'Your civilization generates Culture ⭐ every turn, and that culture accumulates as progress toward a chosen node on the culture tree. Open the culture panel to pick what your civilization studies next, from a Code of Laws in the ancient era through to the great ideologies of the modern age.' },
      { kind: 'paragraph', text: 'Completing a culture node can unlock:' },
      {
        kind: 'list',
        items: [
          'New forms of government',
          'Policy slots, which let you run more policies at once',
          'Diplomatic options such as trade delegations and alliances',
          'Certain buildings and units',
        ],
      },
      { kind: 'note', text: 'Because governments, policy slots and even alliances are unlocked here, the culture tree shapes your civilization just as much as the technology tree does.' },
      { kind: 'heading', text: 'Cultural Expansion' },
      { kind: 'paragraph', text: 'Culture also expands your cities’ borders, claiming new tiles for your civilization over time. Each city works toward a planned expansion tile, which you can retarget, and tiles and resources brought inside your borders become available to work.' },
      { kind: 'heading', text: 'Cultural Victory' },
      { kind: 'paragraph', text: 'Sustained cultural output is a victory path in its own right, combined with World Wonders and a dominant currency. See Victory & Objectives for the full requirements.' },
    ],
  },
  {
    id: 'government-and-policies',
    title: 'Government & Policies',
    blocks: [
      { kind: 'paragraph', text: 'As your culture tree advances, you gain access to new forms of government and to policies that let you tailor your civilization to your strategy.' },
      { kind: 'heading', text: 'Government' },
      { kind: 'paragraph', text: 'Governments are unlocked through the culture tree. Early societies begin with simple tribal governments and can progress toward classical republics, autocracies and theocracies, and eventually to the modern ideological states — democracy, fascism and communism among them.' },
      { kind: 'heading', text: 'Policies' },
      { kind: 'paragraph', text: 'Policies are individual bonuses you slot into your government. Open the Policies dialog from the culture panel to assign them.' },
      {
        kind: 'list',
        items: [
          'Policies come in categories: military, economic, diplomatic and ideology',
          'Each policy occupies a slot of its own category, and wildcard slots accept any policy',
          'You unlock additional policy slots by advancing the culture tree',
          'Policies can be swapped as your situation changes',
        ],
      },
      { kind: 'note', text: 'Some policies increase happiness, production or Influence, so revisit your policy loadout as new slots and policies unlock.' },
      { kind: 'heading', text: 'Ideology' },
      { kind: 'paragraph', text: 'Each nation has an ideology — such as Liberalism, Nationalism, Globalism or Militarism — that expresses its character. Ideology shapes how a nation approaches diplomacy, trade, open borders, war and cultural pressure, and it has its own policy category.' },
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
      { kind: 'paragraph', text: 'Luxury resources such as wine, silver and gems improve happiness and the prosperity of your civilization.' },
      { kind: 'heading', text: 'Bonus Resources' },
      { kind: 'paragraph', text: 'Bonus resources such as wheat, cattle and fish simply boost the yields of the tiles they sit on. Building the matching tile improvement increases the benefit further.' },
      { kind: 'heading', text: 'Access' },
      { kind: 'paragraph', text: 'A resource must be inside territory you control before you can make use of it.' },
    ],
  },
  {
    id: 'victory',
    title: 'Victory & Objectives',
    blocks: [
      { kind: 'paragraph', text: 'Epoch has four formal victory conditions: Domination, Science, Cultural and Diplomatic Victory. A victory is awarded when a nation meets all requirements for one of these conditions at the end of a turn.' },

      { kind: 'heading', text: 'Domination Victory' },
      { kind: 'paragraph', text: 'Win by controlling every active nation’s original capital at the same time.' },
      {
        kind: 'list',
        items: [
          'You must own your own original capital and the original capital of every rival still in the game.',
          'Capturing ordinary cities helps your campaign but does not directly satisfy the victory condition.',
          'An original capital remains a required objective after it changes hands, so another nation can recapture it and prevent your victory.',
        ],
      },

      { kind: 'heading', text: 'Science Victory' },
      { kind: 'paragraph', text: 'Win by producing and accumulating 10 Aerospace Parts for your nation.' },
      {
        kind: 'list',
        items: [
          'Research Rocketry, secure access to Aluminum and operate an active Factory to found AeroSpace Industries.',
          'AeroSpace Industries must be founded before any nation can manufacture Aerospace Parts. Its founding starts the global space race.',
          'After the corporation is founded, a city can produce an Aerospace Part only when its nation has Rocketry and Aluminum and the city has an active Factory.',
          'The founder of AeroSpace Industries receives +50% Production toward Aerospace Parts, but every eligible nation may compete.',
          'Aerospace Parts belong to the nation that produces them. Each Part locks its Production cost when started, increasing by 10% for each Part that nation has already completed or has in production.',
          'The first nation to accumulate 10 Aerospace Parts wins.',
        ],
      },

      { kind: 'heading', text: 'Cultural Victory' },
      { kind: 'paragraph', text: 'Win by meeting all three cultural requirements simultaneously:' },
      {
        kind: 'list',
        items: [
          'Accumulate at least 75,000 Culture.',
          'Own at least 8 completed, unbroken World Wonders.',
          'Have your active national currency ranked Dominant.',
        ],
      },
      { kind: 'paragraph', text: 'World Wonders count for the nation that currently owns their city. Conquering or losing a Wonder city therefore changes Cultural Victory progress. Currency strength is relative to other active currencies, and only the highest-ranked currency is Dominant.' },

      { kind: 'heading', text: 'Diplomatic Victory' },
      { kind: 'paragraph', text: 'Win by reaching 5,000 Diplomatic Score through successful participation in the World Council or United Nations.' },
      {
        kind: 'list',
        items: [
          'Propose a resolution that passes to earn 600 Diplomatic Score.',
          'Spend Influence to support a resolution that passes. Supporting nations share a pool of 300 Diplomatic Score in proportion to the Influence they committed.',
          'Gold donated to an emergency Defense Support resolution grants a small one-time score award, capped at 40 for each donation.',
          'Opposing or blocking a proposal grants no Diplomatic Score directly.',
        ],
      },
      { kind: 'paragraph', text: 'Diplomatic Victory depends on accumulated score, not on maintaining alliances with every nation or winning a single vote. Build Influence, propose resolutions that can pass and support successful coalitions consistently.' },

      { kind: 'heading', text: 'Choosing Your Objective' },
      { kind: 'paragraph', text: 'You may pursue several victory paths at once, and preventing a rival from completing their requirements can be as important as advancing your own. The game remains open-ended until a formal victory condition is met.' },
    ],
  },
  {
    id: 'scenario-editor',
    title: 'Scenario Editor',
    blocks: [
      { kind: 'heading', text: '1. Introduction to the Editor' },
      { kind: 'paragraph', text: 'The Scenario Editor lets you create your own custom scenarios to play.' },
      { kind: 'paragraph', text: 'A scenario can contain a custom map, nations, resources, cities and starting positions. The editor is built so you can gradually shape a whole world from scratch — start small and build it up.' },

      { kind: 'heading', text: '2. Drawing Terrain' },
      { kind: 'paragraph', text: 'Painting terrain is the foundation of every scenario — it comes first, before anything else.' },
      {
        kind: 'list',
        items: [
          'Pick a terrain type, then paint it onto the map with the terrain brush',
          'Drag across the map to lay down land, ocean, hills, forest and more',
          'Zoom and pan to move around the map while you work',
          'Increase the brush size to cover large areas quickly',
        ],
      },

      { kind: 'heading', text: '3. Resources and Placement' },
      { kind: 'paragraph', text: 'Once the terrain exists, you can place resources on top of it.' },
      {
        kind: 'list',
        items: [
          'Place resources where they make geographic sense (e.g. fish at sea, ore in hills)',
          'Strategic resources matter a lot later during gameplay — they unlock advanced units',
        ],
      },

      { kind: 'heading', text: '4. Nations and Starting Positions' },
      { kind: 'paragraph', text: 'Nations are placed on the map, and their starting positions decide where each civilization begins play.' },
      { kind: 'paragraph', text: 'Use Nation Details to customize the nations in your scenario and their relationships.' },

      { kind: 'heading', text: '5. Magic Wand' },
      { kind: 'paragraph', text: 'The Magic Wand is designed to dramatically speed up map creation.' },
      { kind: 'image', src: 'assets/editor.webp', alt: 'The Scenario Editor showing the Magic Wand tool' },
      { kind: 'paragraph', text: 'Magic Wand analyzes the background image and attempts to automatically generate terrain from it. Instead of manually painting every tile, the tool can create a first draft of the map based on the shapes and colors found in the source image.' },
      {
        kind: 'list',
        items: [
          'It is intended as a starting point, not a finished map',
          'Manual adjustments are usually still needed afterwards',
          'It can save many hours when creating large maps',
          'Best results come from clear, well-defined map images',
        ],
      },

      { kind: 'heading', text: '6. Spray Mode' },
      { kind: 'paragraph', text: 'Spray Mode highlights only the tiles that have not been painted yet; already-painted tiles become visually de-emphasized.' },
      {
        kind: 'list',
        items: [
          'Great for finishing large maps — it makes gaps and missing terrain obvious',
          'Especially useful right after using Magic Wand, to spot what it missed',
        ],
      },

      { kind: 'heading', text: '7. Undo and Redo' },
      {
        kind: 'list',
        items: [
          'Undo (Ctrl + Z) reverses your most recent brush stroke',
          'Redo (Ctrl + Shift + Z) restores an undone action',
        ],
      },
      { kind: 'note', text: 'Undo support makes long terrain-editing sessions much safer — experiment freely, knowing you can always step back.' },

      { kind: 'heading', text: '8. Scenario Details' },
      { kind: 'paragraph', text: 'Finally, give your scenario its identity in Scenario Details:' },
      {
        kind: 'list',
        items: [
          'Scenario name',
          'Scenario description',
          'Start year',
          'Other scenario metadata',
        ],
      },
      { kind: 'paragraph', text: 'This information is shown to players when they browse and select scenarios.' },

      { kind: 'heading', text: 'Putting It Together' },
      { kind: 'paragraph', text: 'A typical editor workflow:' },
      {
        kind: 'list',
        items: [
          'Draw the terrain',
          'Place resources',
          'Configure nations and starting positions',
          'Use Magic Wand to accelerate map creation',
          'Use Spray Mode to locate unfinished areas',
          'Use Undo/Redo while refining the map',
        ],
      },
      { kind: 'note', text: 'There is no single right way to build a scenario — experiment and iterate. The best maps come from trying things, refining, and trying again.' },
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
