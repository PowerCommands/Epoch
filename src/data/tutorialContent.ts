/**
 * Data-driven tutorial content.
 *
 * Each section is a self-contained chapter rendered by `TutorialView`. Content
 * is expressed as structured blocks rather than raw HTML so the view can render
 * it safely and consistently, and so new chapters can be added here without
 * touching any UI logic.
 *
 * The special `cheat-commands`, `corporations` and `manufactured-resource-effects`
 * blocks are placeholders: the view fills them in at render time from the live
 * cheat command definitions, the canonical `CORPORATIONS` data and the shared
 * `MANUFACTURED_RESOURCE_EFFECTS` table, so the documentation never drifts from
 * the implemented commands, Corporation requirements or resource effects.
 */

export type TutorialBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'corporations' }
  | { kind: 'manufactured-resource-effects' }
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
          'Ctrl + H — Show or hide the History panel; the choice is remembered for future games',
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
      { kind: 'heading', text: 'Power Plants & Energy' },
      { kind: 'paragraph', text: 'As your civilization advances, a city can only keep growing if it has the infrastructure to support its people. A new city supports up to 6 population; sanitation buildings raise this modestly — Sewers to 8 and an Aqueduct to 10 — without needing any energy. Beyond that, only a Power Plant can push the ceiling higher, and a city can never grow past the limit its current infrastructure allows:' },
      {
        kind: 'list',
        items: [
          'No Power Plant — up to 6 population (8 with Sewers, 10 with an Aqueduct)',
          'Coal Power Plant — up to 16 population',
          'Oil Power Plant — up to 20 population',
          'Gas Power Plant — up to 24 population',
          'Nuclear Power Plant — up to 48 population',
        ],
      },
      { kind: 'paragraph', text: 'An active Power Plant also multiplies the city\'s production. The bonus applies only while the plant is active:' },
      {
        kind: 'list',
        items: [
          'No Power Plant — ×1 production',
          'Coal Power Plant — ×2 production',
          'Oil Power Plant — ×3 production',
          'Gas Power Plant — ×4 production',
          'Nuclear Power Plant — ×6 production',
        ],
      },
      { kind: 'paragraph', text: 'Every Power Plant runs on a strategic resource, and each source of that resource can power only one plant:' },
      {
        kind: 'list',
        items: [
          'Coal Power Plant needs Coal',
          'Oil Power Plant needs Oil',
          'Gas Power Plant needs Natural Gas',
          'Nuclear Power Plant needs Uranium',
        ],
      },
      { kind: 'note', text: 'This is stricter than military units, where one resource source can equip many units — a Power Plant claims a source of its own. Resource access can be domestic or gained through trade, so a city that relies on an imported energy resource will lose its Power Plant benefits if that access disappears. Secure your energy supply before you come to depend on it.' },
      { kind: 'paragraph', text: 'Power Plants do not last forever. Each has a limited operational lifespan, after which it is removed and must be rebuilt at its full production cost:' },
      {
        kind: 'list',
        items: [
          'Coal Power Plant — 20 turns',
          'Oil Power Plant — 40 turns',
          'Gas Power Plant — 50 turns',
          'Nuclear Power Plant — 100 turns',
        ],
      },
      { kind: 'paragraph', text: 'A city can have only one Power Plant at a time. Building a new one replaces the old plant, letting a city move between Coal, Oil, Gas and Nuclear power as its technology and available resources change.' },
      { kind: 'note', text: 'If a city\'s population is already above what its energy can support — because a plant expired, went inactive, or lost access to its resource — it does not lose people at once. There is a short grace period of about 5 turns to recover. If enough capacity is not restored, the city then loses 1 population every 5 turns until it settles at a level its energy can support. Restore capacity and the decline stops.' },
      { kind: 'heading', text: 'Territory' },
      {
        kind: 'list',
        items: [
          'Cities expand their cultural borders outward as they grow',
          'Tiles and resources inside your borders become available to work',
        ],
      },
      { kind: 'heading', text: 'City Defense' },
      { kind: 'paragraph', text: 'Every city begins with 25 City Defense. Fortifications are produced inside the city and do not occupy map tiles. Walls, Castle and Arsenal each add +25% City Defense, stacking additively to 31, 37 and 43 effective Defense as the city reaches fortification levels 1, 2 and 3.' },
      {
        kind: 'list',
        items: [
          'Higher City Defense increases the damage dealt back to melee attackers',
          'Fortifications reduce incoming damage from both melee and ranged attacks',
          'A dark-gray ring around the city grows thicker at each fortification level',
          'Broken fortifications provide no Defense bonus and do not count toward the visible ring level',
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
          'Luxury resources you have access to, whether owned or imported',
          'Manufactured Goods such as Trade Goods, Colonial Goods, Vehicles and Media, plus some Corporations',
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
      { kind: 'heading', text: 'Audience and Gossip' },
      { kind: 'paragraph', text: 'Open a foreign leader in Leader Details and use the Dialog section to speak with them directly. Audience is for formal diplomacy; Gossip is for informal conversation, political information and provocation.' },
      {
        kind: 'list',
        items: [
          'Arrange an audience with {leader} — negotiate formal diplomatic and trade matters',
          'Gossip with {leader} — ask questions, spread rumors, insult or threaten the leader',
        ],
      },
      { kind: 'heading', text: 'Gossip: Information' },
      { kind: 'paragraph', text: 'Information questions reveal what a leader thinks: whom they trust, distrust or fear, who they consider a rival, their strategic agenda and who may start a war. Questions cost no Influence and never change diplomatic relations. More advanced questions may require Cultural progress.' },
      { kind: 'heading', text: 'Gossip: Manipulation' },
      { kind: 'paragraph', text: 'Manipulation spends Influence to spread a rumor about a third nation. It changes how the recipient feels about that target through Trust, Suspicion, Hostility, Affinity or Fear. You choose how strongly to invest; more serious rumors can cause broader diplomatic damage and cost more, and costs rise as your civilization advances through the eras.' },
      { kind: 'paragraph', text: 'Manipulation changes diplomatic attitudes—it does not force an action. Telling England that France is preparing for war will not make England declare war. England’s normal AI decides what the changed relationship means.' },
      { kind: 'note', text: 'A leader must be willing to listen to your rumors. Manipulation has a cooldown against the same recipient, and advanced claims may require Cultural progress.' },
      { kind: 'heading', text: 'Gossip: Insults' },
      { kind: 'paragraph', text: 'Insults cost no Influence and directly worsen the recipient’s attitude toward your nation; they never target a third nation. Provocations can raise Hostility or reduce Trust and Affinity. Military threats may also create Fear, but only when your armed forces make the threat credible. A much stronger leader may simply become angry—or mock your bluff.' },
      { kind: 'heading', text: 'Culture and Gossip' },
      { kind: 'paragraph', text: 'Culture, rather than Technology, unlocks more sophisticated ways to understand leaders, gather political information, spread rumors and pressure rivals. Each locked option shows its own requirement in the Gossip interface.' },
      { kind: 'heading', text: 'Leader Remarks in History' },
      { kind: 'paragraph', text: 'Leaders may occasionally insult or threaten one another—and sometimes you—during severe hostility, approaching conflict, war declarations, ongoing wars or city captures. These remarks appear in History as storytelling flavor. They reflect existing tensions but do not change diplomatic relations themselves.' },
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
      { kind: 'heading', text: 'Economic Pressure: Tariffs, Boycotts & Embargoes' },
      { kind: 'paragraph', text: 'Economic Pressure lets you punish and pressure a rival without going to war. The three measures form an escalating ladder — Tariffs, then Boycott, then Embargo — each unlocked further along the economic technology line: Tariffs need Currency, Boycotts need Banking, and Embargoes need Economics. You impose them from a leader’s Audience.' },
      {
        kind: 'list',
        items: [
          'Tariffs — symbolic. Trade continues, but relations sour, and imposing them from an Audience makes the target retaliate with automatic reciprocal Tariffs.',
          'Boycott — you stop buying from the target: your imports from them (and the effects those goods gave) are suspended. One-directional — they can still buy from you.',
          'Embargo — a total, two-way trade shutdown while either side imposes it, including trade routes and all imports. The heaviest blow to relations.',
        ],
      },
      { kind: 'paragraph', text: 'Sanctions suspend agreements rather than delete them. Existing trade deals caught by a Boycott or Embargo simply stop working while the measure is active and resume automatically if it is lifted, and new deals cannot be created in a blocked direction. Tariffs never block trade or change a deal’s value.' },
      { kind: 'paragraph', text: 'Ending a measure: the nation that imposed it can lift it at any time. AI-to-AI sanctions expire on their own after about 25 turns. A sanction that involves you does not expire automatically, but after roughly 25 turns it becomes negotiable — you can pay gold to have an incoming sanction lifted, and an AI may offer you gold to drop one of yours.' },
      { kind: 'note', text: 'Because these effects follow live resource access, a Boycott or Embargo is a real economic weapon against a nation that depends on imported Manufactured Goods — cutting the import also removes the Happiness, Production, Gold or Food it was providing.' },
      { kind: 'heading', text: 'War' },
      { kind: 'paragraph', text: 'Nations can declare war and become hostile. War is required before military units can attack one another.' },
      { kind: 'heading', text: 'Foreign Resource Exploitation' },
      { kind: 'paragraph', text: 'Colonialism also unlocks Foreign Resource Exploitation Rights, letting resource access be used as a diplomatic concession in trade, war and peace. See the Foreign Resource Exploitation section for the full explanation.' },
    ],
  },
  {
    id: 'foreign-resource-exploitation',
    title: 'Foreign Resource Exploitation',
    blocks: [
      { kind: 'paragraph', text: 'Foreign Resource Exploitation Rights let one nation develop natural resources inside another nation’s territory as a diplomatic arrangement. The option to introduce such rights becomes available once you unlock Colonialism in the Culture tree.' },
      { kind: 'heading', text: 'What the agreement does' },
      {
        kind: 'list',
        items: [
          'Another nation may receive the right to exploit natural resources inside your territory — or you inside theirs.',
          'The receiving nation’s Workers and Work Boats gain peaceful access to the granting nation’s territory.',
          'Military units do NOT gain Open Borders from this agreement — only Workers and Work Boats may enter.',
          'The receiving nation may build only on natural-resource tiles.',
          'The tile must currently have no improvement.',
          'Normal technology and terrain requirements for the improvement still apply.',
        ],
      },
      { kind: 'heading', text: 'Ownership' },
      {
        kind: 'list',
        items: [
          'Territory does not change owner — the tile stays part of the granting nation.',
          'The resource improvement belongs to the exploiting nation and is shown in that nation’s colour.',
          'The exploiting nation receives the resource; the territorial owner does not also receive that exploited source.',
        ],
      },
      { kind: 'heading', text: 'Existing improvements' },
      {
        kind: 'list',
        items: [
          'An existing improvement protects the resource — foreign Workers cannot replace or take over an improvement that is already there.',
          'If that improvement is later destroyed and the agreement still exists, the resource can become exploitable again.',
        ],
      },
      { kind: 'heading', text: 'Using rights in diplomacy' },
      { kind: 'paragraph', text: 'Exploitation rights can be offered or requested in Trade Deals, offered as an incentive when asking another nation to join a war, offered as a concession in a Peace proposal, or demanded from a defeated enemy during Capitulation.' },
      { kind: 'heading', text: 'Long-term consequence' },
      { kind: 'paragraph', text: 'Allowing another nation to exploit your territory gradually damages your Affinity toward that nation. The friction is small each time but persistent, and over many turns it can turn a good relationship sour.' },
      { kind: 'heading', text: 'Duration' },
      { kind: 'paragraph', text: 'Exploitation rights have no normal expiry. They persist until the relationship is broken — under the current rules, war between the two nations ends the rights.' },
      { kind: 'heading', text: 'AI leaders' },
      { kind: 'paragraph', text: 'Leaders differ in how highly they value foreign resource exploitation. Some actively seek such rights and will bargain hard for them, while others have little or no interest.' },
      { kind: 'note', text: 'Colonialism is a Culture advance — look for it in the Culture tree to unlock these options.' },
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
      { kind: 'note', text: 'With Colonialism unlocked, a trade negotiation can also grant or request Foreign Resource Exploitation Rights — see the Foreign Resource Exploitation section.' },
    ],
  },
  {
    id: 'corporations',
    title: 'Corporations',
    blocks: [
      { kind: 'paragraph', text: 'Corporations are powerful economic institutions your cities can found once you meet their requirements. Each Corporation produces a Manufactured Good, which then flows into your trade and wider economy.' },

      { kind: 'heading', text: 'Manufactured Goods' },
      { kind: 'paragraph', text: 'Manufactured Goods are different from the natural resources found on the map. Where Silk, Iron or Oil occur naturally, Manufactured Goods are created by Corporations. Examples include Trade Goods, Maritime Goods, Tools, Colonial Goods, Banking Services, Refined Fuel, Steel Goods, Vehicles, Chips and Media. These goods take part in the economic and trade systems according to the normal game rules.' },

      { kind: 'heading', text: 'Manufactured Good Effects' },
      { kind: 'paragraph', text: 'Beyond being valuable trade commodities, most Manufactured Goods now give your nation a direct, ongoing bonus. Each available unit contributes its effect, and the bonuses stack — so the more units you have access to, the larger the benefit.' },
      { kind: 'paragraph', text: 'What matters is access, not where the good comes from. A unit you produce yourself and a unit you import through a trade agreement give exactly the same effect. If you lose access — a trade deal ends, or a Boycott or Embargo cuts off an import — the matching bonus disappears at the same time.' },
      { kind: 'paragraph', text: 'The current effects are:' },
      { kind: 'manufactured-resource-effects' },
      { kind: 'note', text: 'Production and Food bonuses are shared out automatically across your cities (smaller, still-growing cities are favoured); Happiness and Gold bonuses are national. Aerospace Parts are the exception — they carry no economic bonus and are used only for the Science Victory (see below).' },

      { kind: 'heading', text: 'Global Uniqueness' },
      { kind: 'paragraph', text: 'Each specific Corporation is globally unique. Once any nation has founded a Corporation, no other nation can ever found that same Corporation.' },
      { kind: 'note', text: 'For example, if one nation founds the Silk Road Consortium, the Silk Road Consortium is no longer available to anyone else. This makes founding Corporations competitive — reaching their requirements before your rivals is what secures them.' },

      { kind: 'heading', text: 'Founding Requirements' },
      { kind: 'paragraph', text: 'A Corporation normally requires a combination of the following, all of which must be met by the same nation:' },
      {
        kind: 'list',
        items: [
          'A required technology',
          'One or more required natural resources, where applicable',
          'One or more required buildings',
          'A city able to produce and found the Corporation',
        ],
      },
      { kind: 'paragraph', text: 'The required production building must be active in the city where the Corporation is founded. Once founded, the Corporation supplies its Manufactured Good according to the existing Corporation production rules — typically one unit of the good for each qualifying production building your nation operates.' },

      { kind: 'heading', text: 'The Corporations' },
      { kind: 'paragraph', text: 'Every Corporation currently in the game is listed below, generated directly from the game’s definitions:' },
      { kind: 'corporations' },

      { kind: 'heading', text: 'AeroSpace Industries & the Science Victory' },
      { kind: 'paragraph', text: 'AeroSpace Industries is a special Corporation. Founding it starts and unlocks the global Aerospace Part manufacturing race, and the founding nation gains +50% Production toward Aerospace Parts.' },
      { kind: 'paragraph', text: 'Unlike ordinary Corporations, Factories do not automatically generate Aerospace Parts. Aerospace Parts must be deliberately produced using the existing Aerospace Part production system in eligible cities.' },
      { kind: 'note', text: 'A nation needs 10 accumulated Aerospace Parts to satisfy the Aerospace Part requirement for a Science Victory. The first nation to reach 10 Aerospace Parts wins.' },
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
      { kind: 'note', text: 'Only the highest-ranked currency is Dominant, and a Dominant currency is one of the four requirements for the normal Cultural Victory route. A strong economy therefore feeds directly into your victory options.' },
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
      { kind: 'heading', text: 'Strategic Resource Requirements' },
      { kind: 'paragraph', text: 'Most advanced units cannot be built without access to a specific Strategic Resource — for example Niter for gunpowder units, Oil for tanks, aircraft and modern ships, Aluminum for the most advanced jets, and Uranium for nuclear forces. Each accessible source supports only a limited number of such units, so securing and importing the right resources is part of fielding a modern army. See the Resources section for the full list.' },
      { kind: 'heading', text: 'Combat' },
      {
        kind: 'list',
        items: [
          'Combat occurs when hostile units engage one another',
          'Cities can be attacked and captured',
        ],
      },
      { kind: 'note', text: 'When persuading another nation to join your war, or settling a war through Peace or Capitulation, Foreign Resource Exploitation Rights (unlocked by Colonialism) can be offered or demanded — see the Foreign Resource Exploitation section.' },
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
          'Colonialism, which unlocks Foreign Resource Exploitation Rights',
          'Certain buildings and units',
        ],
      },
      { kind: 'note', text: 'Because governments, policy slots and even alliances are unlocked here, the culture tree shapes your civilization just as much as the technology tree does.' },
      { kind: 'heading', text: 'Cultural Expansion' },
      { kind: 'paragraph', text: 'Culture also expands your cities’ borders, claiming new tiles for your civilization over time. Each city works toward a planned expansion tile, which you can retarget, and tiles and resources brought inside your borders become available to work.' },
      { kind: 'heading', text: 'Cultural Victory' },
      { kind: 'paragraph', text: 'Sustained cultural output is a victory path in its own right, normally combined with World Wonders, a dominant currency and victory in Games of Nations. A civilization can instead achieve Cultural Victory through overwhelming cultural dominance at 250,000 Culture regardless of those other requirements. See Games of Nations for the sporting system and Victory & Objectives for the full victory requirements.' },
    ],
  },
  {
    id: 'games-of-nations',
    title: 'Games of Nations',
    blocks: [
      { kind: 'paragraph', text: 'Games of Nations is a recurring international sporting competition. Nations divert Culture and Production into sporting preparation, choose where to focus their Games Points and compete for medals, prestige and an opening toward Cultural Victory.' },

      { kind: 'heading', text: 'Founding the Games' },
      { kind: 'paragraph', text: 'Completing the Games Of Nations culture, formerly called Games and Recreation, founds the institution. The nation that completes it receives the first opportunity to host, and the first Competition is scheduled 25 turns later. If it declines or cannot host, the offer passes through the host rotation.' },
      { kind: 'paragraph', text: 'Once founded, the Games recur. Each cycle has a 10-turn Preparation phase, a Competition with one sport resolved per turn, and a 10-turn Cooldown before the next Preparation. Because every active sport receives its own Competition turn, later Games last longer as new sports join the program.' },

      { kind: 'heading', text: 'Participation and Preparation' },
      { kind: 'paragraph', text: 'Nations normally enter each Games. At the start of Preparation, you choose whether your nation will participate and configure its investment. A host must participate, but may commit zero resources; a non-host may sit out the entire cycle. World Council politics can also exclude a nation.' },
      { kind: 'paragraph', text: 'During Preparation you set a Culture commitment and a base Production commitment per turn. Culture is diverted from what you generate that turn, not spent from accumulated progress. Each resource is attempted separately and on an all-or-nothing basis: if you cannot provide the full promised amount that turn, none of that resource is diverted and it produces no GP. Production is taken from base Production before percentage bonuses, so the effect on normal construction can be greater than the displayed base commitment.' },
      {
        kind: 'list',
        items: [
          '1 successfully invested Culture generates 10 Games Points (GP).',
          '1 successfully invested base Production generates 10 GP.',
          'Changing a commitment affects future Preparation turns only.',
        ],
      },

      { kind: 'heading', text: 'Assigning Games Points' },
      { kind: 'paragraph', text: 'Your Culture and base Production commitments immediately define a GP-per-turn planning budget. Assign that full budget as a recurring sport strategy before applying it; no resource is charged and no GP becomes locked until a Preparation turn is processed. Use Distribute Remaining Evenly to fill any unassigned budget; remaining points are then automatically distributed evenly across the active sports.' },
      { kind: 'paragraph', text: 'Each successful payment applies the strategy to that turn’s GP. Actually invested sport GP is permanent for the current Games and cannot be withdrawn, moved to another sport or returned. If the resources available that turn cannot fund the full plan, the strategy is reduced from its largest sport allocations until it fits; human players are then shown the panel to review and rebalance it.' },

      { kind: 'heading', text: 'Sports, Competition and Medals' },
      { kind: 'paragraph', text: 'The original program contains five traditional sports: Wrestling, Marathon, Swimming, Javelin and Long Jump. Later Games may add Horse Racing, Boxing, 100 Metres, Pole Vault and Fencing; these additional sports are not all available at the beginning.' },
      { kind: 'paragraph', text: 'Competition resolves one sport per turn. More effective GP in a sport gives a nation a better chance, so the largest investment is favored but does not guarantee victory. Each event can award Gold, Silver and Bronze to different participating nations.' },
      { kind: 'paragraph', text: 'A tournament is decided first by Gold medals, then Silver, then Bronze. The cumulative Medal League values Gold at 5 points, Silver at 3 and Bronze at 1; tied league nations are ordered by points, Gold medals, Silver medals and then nation name.' },

      { kind: 'heading', text: 'Hosting and the Grand Stadium' },
      { kind: 'paragraph', text: 'Hosting rotates between nations. When you receive an offer, you may accept or decline; after accepting, select one of your eligible cities as the host city. AI hosts make the same preparations and attempt to complete the required stadium.' },
      { kind: 'paragraph', text: 'The chosen city must contain a completed Grand Stadium before Competition begins. If it is unfinished, the Games are cancelled and no sports or medals are awarded. The Grand Stadium is permanent city infrastructure, uses normal construction rules and remains after the Games.' },
      { kind: 'paragraph', text: 'A future host may reuse a completed Grand Stadium by selecting that same city. Selecting a different city without one requires another Grand Stadium there. Its permanent Happiness benefit equals a normal Stadium, and if both buildings are present their normal Happiness benefits stack.' },
      { kind: 'heading', text: 'Host Advantage' },
      { kind: 'paragraph', text: 'After the participating nations confirm their initial commitments, the host receives bonus GP equal to 10% of the other participants’ combined initial GP commitment. The host assigns the bonus to one active sport. That choice is fixed for the Games and can provide a meaningful advantage in that event.' },

      { kind: 'heading', text: 'New Sports and Gold Auctions' },
      { kind: 'paragraph', text: 'The first time the world reaches the Renaissance, Industrial, Modern, Atomic and Information eras, an available additional sport can be introduced through an international Gold auction. If sports still remain in the Future Era, later hosting cycles provide further opportunities until the program can contain all ten sports.' },
      { kind: 'paragraph', text: 'Nations nominate an available sport and bid Gold for the prestige of introducing it. Only the winning nation pays; the winning sport joins Games of Nations and the introducing nation receives lasting historical credit.' },
      { kind: 'paragraph', text: 'AI nations submit their proposals first. You can see their nominations and bids before choosing to abstain, nominate an available sport or submit a bid above the current leader. The proposals may also hint at which sports rivals value.' },

      { kind: 'heading', text: 'Leader Preferences and Gossip' },
      { kind: 'paragraph', text: 'Every leader favors one traditional sport and one additional sport. These preferences influence how AI nations prepare and which new sport they may want to introduce. If powerful rivals share a favorite, another event may offer a less crowded route to a medal.' },
      { kind: 'paragraph', text: 'After Games of Nations has been founded and you have met a leader, use Gossip to ask “Which sports do you prefer?” The answer is remembered as Known Information in that leader’s dialog. It can reveal a favored additional sport before that sport has joined the Games, which is useful intelligence for future auctions and tournaments.' },

      { kind: 'heading', text: 'Leaderboard and Historical Record' },
      { kind: 'paragraph', text: 'Open the GoN tab in Leaderboard to review Games history. Games of Nations Medal League shows each nation’s cumulative Rank, Gold, Silver, Bronze and total Medals. Games of Nations Tournament History records the Year, Host Nation, Host City and Winner of every completed or cancelled Games.' },
      { kind: 'paragraph', text: 'The Epoch Chronicle publishes special Games editions during Competition, reporting results and the next event. Hosting announcements, new sports, Gold medals, completed or cancelled tournaments and major World Council interventions also become part of the historical record.' },

      { kind: 'heading', text: 'Games of Nations and the World Council' },
      { kind: 'paragraph', text: 'Once both institutions exist, the World Council can make the upcoming Games a subject of international politics. Games-related resolutions are available only before Competition begins.' },
      { kind: 'paragraph', text: 'A Games of Nations Hosting Resolution proposes that its sponsor replace the current host. If it passes, the sponsor becomes host, chooses a host city and begins a fresh hosting and Preparation process. Previous Games investments from the abandoned preparation are not refunded, but permanent infrastructure such as an existing Grand Stadium is not destroyed.' },
      { kind: 'paragraph', text: 'A Games of Nations Participation Resolution can exclude a nation from the upcoming Games. The target cannot compete or win medals, its future Culture and Production commitments stop, and resources already invested are not refunded. The exclusion lasts for that Games only. Even the host can be excluded from competing while remaining responsible for hosting.' },
      { kind: 'note', text: 'After Competition begins, neither host replacement nor participant exclusion is available. Results and medals already being decided cannot be rewritten halfway through a tournament.' },

      { kind: 'heading', text: 'Games and Cultural Victory' },
      { kind: 'paragraph', text: 'Winning Games of Nations does not grant victory by itself. It makes your nation the reigning winner of the most recently completed Games and opens the Games-based eligibility window for the normal Cultural Victory route while you also meet all other cultural requirements. The separate 250,000-Culture overwhelming-dominance route does not require a Games title. See Victory & Objectives for the exact requirements.' },
      { kind: 'note', text: 'A rival nearing Cultural Victory may be checked by competing hard in selected sports, learning leader preferences or using World Council politics before Competition. No single approach guarantees success.' },
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
      { kind: 'paragraph', text: 'Strategic resources gate your most important military units and your power plants. Without access to the right resource you simply cannot build the units — or run the power plants — that depend on it, which is why controlling them (or importing them) matters so much.' },
      { kind: 'paragraph', text: 'Each strategic resource has concrete uses in the current game:' },
      {
        kind: 'list',
        items: [
          'Horses — mounted units: Horseman, Knight and Cavalry.',
          'Iron — the melee line: Swordsman and Longswordsman. It also feeds the Steel Goods Corporation (together with Coal).',
          'Niter — the gunpowder era. Every gunpowder unit needs it: Musketman, Cannon, Rifleman and Artillery, so a supply of Niter is essential for staying competitive from the Renaissance into the Industrial era.',
          'Coal — runs the Coal Power Plant (city energy and population capacity) and, with Iron, supplies the Steel Goods Corporation.',
          'Oil — the backbone of modern war: Landship, Tank, Fighter, Bomber, Battleship and Carrier all require it. It also runs the Oil Power Plant and supplies oil-based Corporations.',
          'Natural Gas — runs the Natural Gas Power Plant.',
          'Aluminum — required by the most advanced aircraft: Jet Fighter and Stealth Bomber. It also supplies aluminum-based Corporations.',
          'Uranium — required for nuclear forces: Nuclear Submarine, Atomic Bomb and Nuclear Missile, and to run the Nuclear Power Plant.',
        ],
      },
      { kind: 'paragraph', text: 'Quantity matters, not just presence. Every accessible source of a strategic resource supports a limited number of units that need it (currently four units per source). Field more than that and you will not be able to build additional units of that type until you secure another source — by taking territory that contains it or importing it through trade.' },
      { kind: 'note', text: 'Imported strategic resources count exactly like ones inside your own territory, so trade agreements are a valid way to unlock a unit or power plant you have no local supply for — and losing that import removes the capacity again.' },
      { kind: 'heading', text: 'Luxury Resources' },
      { kind: 'paragraph', text: 'Luxury resources such as wine, silver and gems improve happiness and the prosperity of your civilization.' },
      { kind: 'heading', text: 'Bonus Resources' },
      { kind: 'paragraph', text: 'Bonus resources such as wheat, cattle and fish simply boost the yields of the tiles they sit on. Building the matching tile improvement increases the benefit further.' },
      { kind: 'heading', text: 'Access' },
      { kind: 'paragraph', text: 'You gain access to a resource in one of two ways: by controlling the tile it sits on inside your borders, or by importing it through an active trade agreement. Imported resources count exactly like ones you own — for building units, running power plants, and every other effect — and that access disappears again if the trade ends or is cut off by a Boycott or Embargo.' },
      { kind: 'note', text: 'With Foreign Resource Exploitation Rights (unlocked by Colonialism), a nation can develop natural resources inside another nation’s territory; the resource then belongs to the exploiting nation, not the territorial owner. See the Foreign Resource Exploitation section.' },
    ],
  },
  {
    id: 'victory',
    title: 'Victory & Objectives',
    blocks: [
      { kind: 'paragraph', text: 'Epoch has four formal victory conditions: Domination, Science, Cultural and Diplomatic Victory. A victory is awarded when a nation meets all requirements for one of these conditions.' },

      { kind: 'heading', text: 'Domination Victory' },
      { kind: 'paragraph', text: 'Win by making every other surviving nation your direct vassal state.' },
      {
        kind: 'list',
        items: [
          'Domination progress is your current direct vassals divided by all other living nations.',
          'Capturing a current capital immediately vassalizes its nation, after which the capital is returned to the new vassal.',
          'Progress is reversible: released vassals and nations that buy independence no longer count.',
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
      { kind: 'paragraph', text: 'A nation normally achieves Cultural Victory while it is the reigning winner of the most recently completed Games of Nations. Winning the Games does not grant Cultural Victory by itself; it opens a temporary opportunity to win if all four normal requirements are met simultaneously:' },
      {
        kind: 'list',
        items: [
          'Accumulate at least 75,000 Culture.',
          'Own at least 8 completed, unbroken World Wonders.',
          'Have your active national currency ranked Dominant.',
          'Be the reigning winner of the most recently completed Games of Nations.',
        ],
      },
      { kind: 'paragraph', text: 'Alternatively, a civilization achieves Cultural Victory through overwhelming cultural dominance upon reaching 250,000 Culture, regardless of its Wonder count, currency status or Games of Nations champion status.' },
      { kind: 'paragraph', text: 'World Wonders count for the nation that currently owns their city. Conquering or losing a Wonder city therefore changes Cultural Victory progress. Currency strength is relative to other active currencies, and only the highest-ranked currency is Dominant.' },
      { kind: 'paragraph', text: 'When another nation wins a later Games, the previous champion loses this Games-based eligibility. A culturally dominant nation may therefore need to win the Games and then satisfy or maintain the other three requirements before the next completed tournament replaces it as champion.' },
      { kind: 'paragraph', text: 'Exclusion from an upcoming Games does not immediately remove the reigning champion’s current eligibility: it remains champion until another Games is successfully completed, although it cannot defend its title while excluded. A cancelled Games creates no new champion, so the winner of the latest successfully completed Games remains reigning champion.' },
      { kind: 'note', text: 'See Games of Nations for preparation, medals, hosting and the World Council options that can help prevent a rival from becoming or remaining champion.' },

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
