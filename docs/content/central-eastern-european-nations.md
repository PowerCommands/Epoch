# Belarus, Yugoslavia and Czechoslovakia

Three built-in nations use the existing nation registry, default leader resolver, AI profiles and string-based save/scenario identities. No nation-specific gameplay branches or shared balance changes were added.

## Nations and personalities

All leaders have the title President, explicit defaults, seven diplomacy flavor fields, and ten unique war-declaration lines (two for each of the five reasons). Dialogue, personality values and Games preferences are game interpretations, not historical quotations or claims about private psychology.

| Nation / default leader | Currency; colors | Existing profiles | Games preferences |
| --- | --- | --- | --- |
| Belarus / Alexander Lukashenko (`nation_belarus`, `leader_alexander_lukashenko`) | Belarusian Ruble (Br); `#71933c` / `#c83142` | Nationalism; Isolationist agenda; Defensive Modern doctrine; Schemer covert profile; Defensive Builder in every era | Wrestling / Boxing |
| Yugoslavia / Josip Broz Tito (`nation_yugoslavia`, `leader_josip_broz_tito`) | Yugoslav Dinar (din); `#6866a8` / `#d33b40` | Nationalism; Homeland Defense agenda; Disciplined Infantry doctrine; Pragmatist covert profile; Balanced Growth, then Defensive Builder from industrial | Marathon / Fencing |
| Czechoslovakia / Antonín Zápotocký (`nation_czechoslovakia`, `leader_antonin_zapotocky`) | Czechoslovak Koruna (Kčs); `#7097ae` / `#c52c39` | Nationalism; Economic agenda; Fortified Defense doctrine; Paranoid covert profile; Tall Growth, then Defensive Builder from industrial | Javelin / Boxing |

Epoch has no communist ideology ID. Nationalism provides the existing sovereignty/resistance profile; Class Struggle culture priorities provide the socialist government path for Yugoslavia and Czechoslovakia. Their historical descriptions retain the political context. Neither those states nor Belarus receives a hardcoded alliance or hostility toward any named nation.

Belarus has limited expansion, moderate war endurance, economic investment and covert pressure. Culture priorities emphasize State Workforce, Civil Engineering and Nationalism. Tito combines high diplomacy and war endurance with modest expansion, foreign trade, diplomacy and socialist development. Czechoslovakia has the highest economy/resource interest, lowest aggression, strong peace preference, and priorities in state industry, engineering, Class Struggle and Totalitarianism. Opportunism and Impulsive Bully are explicitly disabled for all three. These are distinct combinations, not copies of another complete leader.

Zápotocký fits the requested decade directly: he was prime minister until 1953, then president from 21 March 1953 until his death in November 1957. See [Prague Castle's historical biography](https://www.hrad.cz/cs/prezident-cr/prezidenti-v-minulosti/antonin-zapotocky). The [National Bank of Slovakia's 1953 monetary reform account](https://www.nbs.sk/_img/documents/_publik_nbs_fsr/biatec/rok1998/biatec_5_1998.pdf) documents the Czechoslovak koruna and Kčs denomination. See also the [National Bank of Serbia's currency history](https://www.nbs.rs/en/novac-i-placanja/numizmatika_str/istorijat-novca/index.html).

## Audio and artwork

`audioPlaylistNationId` maps Belarus to `nation_russia` and Yugoslavia/Czechoslovakia to `nation_poland`. The generated sounds manifest resolves each new nation key to the original two tracks. No audio assets or nation audio directories were created.

Six original images were generated with the built-in image_gen tool, visually inspected, and resized/encoded to the existing opaque oil-painted portrait and diplomacy-room conventions:

- `public/assets/sprites/leaders/alexander-lukashenko.png` (416×416) and `alexander-lukashenko-room.webp` (2048×872)
- `public/assets/sprites/leaders/josip-broz-tito.png` (416×416) and `josip-broz-tito-room.webp` (2048×872)
- `public/assets/sprites/leaders/antonin-zapotocky.png` (416×416) and `antonin-zapotocky-room.webp` (2048×872)

The complete prompts, generation source paths and final workspace destinations are recorded in `central-eastern-european-art-prompts.json` beside this document. No placeholder art remains. The room art includes national flags; separate flag icons are optional in the current architecture.

## Files and integration

- Canonical content: `src/data/nations.ts`, `centralEasternEuropeanLeaders.ts`, `leaders.ts`, `cityNames.json`, `aiLeaderEraStrategies.ts`, `leaderWarDeclarations.ts`.
- Generated catalogs: `public/assets/data/nations-manifest.json`, `city-names-manifest.json`, `public/assets/sounds/manifest.json`, `public/assets/sprites/manifest.json`, `public/editor/epoch-leader-editor.js`.
- Validation: `tools/centralEasternEuropeanNations.test.ts`, `tools/centralEasternEuropeanNations.browser.mjs`; registration in `package.json` under `test:new-nations` and `test:leader-editor`.
- Documentation: this file and `central-eastern-european-art-prompts.json`; six assets listed above.

Game Setup and random scenarios consume the canonical nation registry. Scenario Editor consumes the generated nation/city catalogs; Leader Editor consumes the generated bundle. BootScene preloads all registered leader portraits and convention-derived rooms. The new city-name pools contain twenty unique names each, with capitals first. General leader statements already use shared personality-driven content and require no individual registration. Diplomacy flavor is currently descriptive metadata; war-declaration lines have an active runtime consumer.

## Validation and limits

- `npm run typecheck` and `npm run build` passed, including all manifest generators. Build reports the existing large-chunk warning.
- 48 tests passed across the new suite, multiple leaders, leader configuration, four-new-nations and Middle Eastern nations. The new suite verifies canonical/default identity, currencies/colors, catalogs, culture/profile IDs without unintended fallback, era assignments, editor changes, scenario/save roundtrips, war-dialogue routing, image decoding, playlist aliases and absence of duplicated audio directories. `EPOCH_VERIFY_BUILD=1` also verified deployed image bytes.
- The war-declaration and random-scenario suites added 31 passes and two failures. Both failures were reproduced from an isolated `git archive HEAD` copy: older alternative leaders lack dedicated war catalogs, and one setup test still expects `Official Scenarios` where the UI uses `Scenarios`. These unrelated behaviors were left unchanged.
- Browser check: `node --import tsx tools/centralEasternEuropeanNations.browser.mjs` against Vite on port 5174 passed. Verified editor export/import and default assignment, leader editing, setup selection, all six image decodes/dimensions, audio HTTP responses, actual playback and looping through all three aliases, normal game starts as each new leader with all three nations present, and actual downloaded saves loaded back through Load Game. All identities survived, with no page errors.
- Default leader selections may be omitted in saves by design. Reload correctly resolves them through the canonical nation registry; no save schema migration was required.
- `git diff --check` passed. No long AI balance simulations were performed.
