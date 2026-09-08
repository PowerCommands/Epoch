# Canada, Mexico, Argentina and Ukraine

Four canonical playable nations, using the existing registries and AI vocabulary. No AI architecture or audio files changed. Trudeau is the requested Canadian leader; these are game identities, not a current-officeholder roster.

| Nation ID | Default leader ID | Ideology | Agenda | Doctrine | Covert |
|---|---|---|---|---|---|
| nation_canada | leader_justin_trudeau | globalism | economic | defensiveModern | merchant |
| nation_mexico | leader_claudia_sheinbaum_pardo | progressivism | growth | defensiveModern | pragmatist |
| nation_argentina | leader_javier_milei | liberalism | economic | defensiveModern | opportunist |
| nation_ukraine | leader_volodymyr_zelenskyy | progressivism | homeland_defense | disciplinedInfantry | pragmatist |

All four disable military opportunism and Impulsive Bully. Argentina’s covert Opportunist profile remains independent of the military opportunism switch. Ukraine uses Defensive Builder from ancient onward (inherited in later eras); the others retain neutral era weights so their agenda and personality guide development without Tall Growth’s very low military readiness.

| Nation | Aggression | Expansion | Economy | Culture | Diplomacy | War tolerance | Peace preference | Loss threshold | Casualty ratio | Exploitation interest |
|---|---|---|---|---|---|---|---|---|---|---|
| Canada | -14 | -8 | 22 | 9 | 24 | 48 | 76 | 3 | 0.35 | 2 |
| Mexico | -12 | -6 | 18 | 14 | 14 | 52 | 70 | 3 | 0.4 | 1 |
| Argentina | -3 | -7 | 30 | -8 | -6 | 48 | 58 | 3 | 0.35 | 4 |
| Ukraine | -10 | -12 | 8 | 6 | 23 | 88 | 48 | 8 | 0.72 | 0 |

War tolerance and casualty thresholds are shared war-continuation settings, not defensive-war-only controls. Ukraine combines high endurance with low aggression/expansion and a defensive era posture. Disciplined Infantry allows overbuilding under threat and modernizes at 1.2; its existing war-weariness safeguards still apply. Homeland Defense supplies a defensive strategy bias with a smaller aggressive response bias; it is not a guarantee of specific retaliation. Canada, Mexico and Argentina use Defensive Modern’s smaller quality-focused forces.

## Cities, currency and Games preferences

**Canada** — Canadian Dollar ($), colors #d52b1e / #ffffff; Games: swimming / hundred_metres. 20 cities: Ottawa, Toronto, Montréal, Vancouver, Calgary, Edmonton, Québec City, Winnipeg, Halifax, Victoria, Regina, Saskatoon, St. John’s, Fredericton, Charlottetown, Whitehorse, Yellowknife, Iqaluit, Thunder Bay, Kelowna.

**Mexico** — Mexican Peso ($), colors #006847 / #ce1126; Games: marathon / boxing. 20 cities: Mexico City, Guadalajara, Monterrey, Puebla, Mérida, Tijuana, Chihuahua, Hermosillo, Culiacán, Durango, San Luis Potosí, León, Morelia, Querétaro, Veracruz, Oaxaca, Tuxtla Gutiérrez, Villahermosa, Campeche, Cancún.

**Argentina** — Argentine Peso ($), colors #74acdf / #ffffff; Games: wrestling / horse_racing. 20 cities: Buenos Aires, Córdoba, Rosario, Mendoza, La Plata, San Miguel de Tucumán, Salta, San Salvador de Jujuy, Resistencia, Corrientes, Posadas, Paraná, Santa Fe, San Juan, San Luis, Neuquén, Bahía Blanca, San Carlos de Bariloche, Comodoro Rivadavia, Ushuaia.

**Ukraine** — Hryvnia (₴), colors #0057b7 / #ffd700; Games: wrestling / boxing. 24 cities: Kyiv, Kharkiv, Odesa, Lviv, Dnipro, Zaporizhzhia, Donetsk, Luhansk, Simferopol, Sevastopol, Mykolaiv, Kherson, Vinnytsia, Poltava, Chernihiv, Sumy, Cherkasy, Zhytomyr, Rivne, Lutsk, Ternopil, Ivano-Frankivsk, Chernivtsi, Uzhhorod.

## Assets

All files reside under `public`. Portraits are 416×416 PNG; diplomatic room scenes are 2048×872 WebP. They were missing and were generated with the built-in imagegen tool, then resized/encoded to the established asset formats.

- `/assets/sprites/leaders/justin-trudeau.png` and `/assets/sprites/leaders/justin-trudeau-room.webp`
- `/assets/sprites/leaders/claudia-sheinbaum-pardo.png` and `/assets/sprites/leaders/claudia-sheinbaum-pardo-room.webp`
- `/assets/sprites/leaders/javier-milei.png` and `/assets/sprites/leaders/javier-milei-room.webp`
- `/assets/sprites/leaders/volodymyr-zelenskyy.png` and `/assets/sprites/leaders/volodymyr-zelenskyy-room.webp`

Each nation uses its existing `/assets/sounds/nation_<name>/nation_<name>_theme-01.mp3` and `..._theme-02.mp3` assets. The directory-based generator discovers the underscore naming; no aliases, renames or audio changes are needed.

## Integration and limitations

Nation and leader IDs use the existing string-based scenario/save architecture. Game Setup takes the canonical nation registry; the standalone Editor receives generated nation/city manifests and leader bundle. Editor exports may omit default leader IDs; the normal default resolver restores their identity. Nation presentation uses registry colors, portraits and rooms; no separate nation flag asset is required.

All seven diplomacy flavor fields are filled. Existing `LeaderDefinition.diplomacyFlavor` is metadata only and has no runtime dialogue consumer; this task preserves that architecture. Each leader separately has ten active war lines (two per reason), tested through the normal audience request. No leader-specific AI logic was added.

## Files

Canonical content: `src/data/nations.ts`, `leaders.ts`, `cityNames.json`, `aiLeaderEraStrategies.ts`, `leaderWarDeclarations.ts`. Generated content: `public/assets/data/nations-manifest.json`, `city-names-manifest.json`, `public/assets/sounds/manifest.json`, `public/assets/sprites/manifest.json`, `public/editor/epoch-leader-editor.js`. Tests: `tools/fourNewNations.test.ts`, `tools/fourNewNations.browser.mjs`, updated stale Poland roster assertions in `tools/polandNation.test.ts`; npm test registration in `package.json`. Eight visual assets listed above. Prompt provenance: `docs/content/four-new-nations-portrait-prompts.json`.

## Validation performed

- `npm run typecheck`: passed.
- `npm run build`: passed, including regenerated manifests and production bundle; Vite reports its existing large-chunk warning.
- `tools/fourNewNations.test.ts`: all 9 tests passed (registry/defaults, validated leader configuration and culture IDs, currency, Games sport categories, city pools, audio discovery, portrait files, scenarios, save validation, all war reasons and defensive profile properties).
- `node --import tsx tools/fourNewNations.browser.mjs`: passed Editor export/import and default assignment, Game Setup nation-details selection, all eight image decodes at expected sizes and eight HTTP 200 audio fetches, with no page errors.
- Relevant suite: 123 tests, 121 passed, 2 existing failures. Included new nations, multiple leaders, leader configuration, Poland, modern alternative leaders, random scenarios, war declaration dialogue, scenario city editing, editor resource generation, scenario order and gossip sports preferences.
- Both remaining failures were reproduced using an isolated `git archive HEAD` source copy: the old war catalog coverage assertion requires dedicated lines for all 14 existing modern alternatives (which currently use fallback lines); the setup source assertion expects `Official Scenarios` while the menu uses `Scenarios`. Neither failure concerns the new nations. The four new leaders each have their own full war catalog.
- Updated two stale Poland roster assertions to recognize its already-existing Donald Tusk alternative while retaining Sikorski as default.
- `git diff --check`: passed. No long autoruns performed.
