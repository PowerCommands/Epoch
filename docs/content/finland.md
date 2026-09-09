# Finland — Alexander Stubb

Finland is a normal playable nation using the same registries, scenario identities, editor bundle and music discovery as Canada, Mexico, Argentina and Ukraine. No AI architecture changes or nation-specific behavioral branches were added.

| Setting | Value |
|---|---|
| Nation | `nation_finland` — Finland |
| Default leader | `leader_alexander_stubb` — President Alexander Stubb |
| Currency | Euro (€) |
| Colors | Finnish blue `#003580`, white `#ffffff` |
| Ideology | `globalism` |
| National agenda | `homeland_defense` |
| Military doctrine | `disciplinedInfantry` |
| Era strategy | `defensiveBuilder`, ancient onward, inherited in later eras |
| Covert personality | `pragmatist` |
| Military opportunism / Impulsive Bully | Both disabled |
| Games preferences | `javelin` (traditional), `pole_vault` (additional) |

## Personality and rationale

| Personality field | Value |
|---|---|
| aggressionBias | -8 |
| expansionBias | -10 |
| economyBias | 16 |
| cultureBias | 8 |
| diplomacyBias | 28 |
| warTolerance | 72 |
| peacePreference | 68 |
| minimumUnitsLostBeforePeace | 5 |
| casualtyToleranceRatio | 0.5 |
| resourceExploitationInterest | 1 |

Globalism adds diplomacy, trade and open-border preferences while reducing war and expansion bias. Homeland Defense adds defensive strategy bias +20, aggressive +8 and balanced +5. Defensive Builder favors embassies (1.4), open borders (1.2), trade (1.15), military readiness (1.2), military production (1.35) and productive infrastructure, while reducing war weight (0.8) and disabling weak-neighbor targeting. Disciplined Infantry favors modernization and quality (both 1.2) over quantity (0.9), with permission to overbuild when threatened. The result supports a cooperative, prepared diplomatic hawk using existing systems.

Culture priorities: `foreign_trade`, `state_workforce`, `military_tradition`, `defensive_tactics`, `civil_service_civics`, `diplomatic_service`.

## Cities

24 Finnish names, capital first: Helsinki, Espoo, Tampere, Vantaa, Oulu, Turku, Jyväskylä, Kuopio, Lahti, Pori, Joensuu, Lappeenranta, Vaasa, Rovaniemi, Hämeenlinna, Seinäjoki, Mikkeli, Kotka, Kajaani, Kokkola, Rauma, Savonlinna, Tornio, Maarianhamina.

## Assets and audio

- `public/assets/sprites/leaders/alexander-stubb.png`: 416×416 painted portrait.
- `public/assets/sprites/leaders/alexander-stubb-room.webp`: 2048×872 diplomatic audience scene, with space for dialogue on the left.
- Both generated with built-in imagegen, then resized/encoded to the established formats. Exact prompts are in `docs/content/finland-portrait-prompts.json`.
- Existing `public/assets/sounds/nation_finland/nation_finland_theme-01.mp3` and `nation_finland_theme-02.mp3` are discovered by the existing directory scanner under playlist key `nation_finland`. No alias or runtime music changes were needed. SHA-256 before/after checks passed for both original files.

## Integration and limitations

Shared nation/default-leader lookups expose Finland to Game Setup, random scenarios, nation replacement and the Scenario Editor. Generated nation and city manifests and the standalone leader editor bundle include Finland. Existing string-based scenario and save selections preserve its IDs; omitted default leader selections use the normal resolver.

All seven diplomacy flavor fields and ten leader-specific war declarations (two each for conquest, hostility, threat, ideological and ambition) are present. As with the other full leaders, `diplomacyFlavor` is editable metadata without a runtime conversation consumer. The separate war declaration catalog does feed runtime audience dialogue.

Personality and doctrine settings cannot guarantee retaliation or allied intervention in a particular situation. Existing relationship, alliance and military safety gates still decide actions. War tolerance applies to offensive and defensive wars alike. Production peace seeking uses PeaceTreatySystem pressure: Stubb's peace preference contributes +0.0288 and war tolerance -0.0264 before other factors. The casualty thresholds mainly affect the compatibility diplomacy path, not a separate defensive resolve mechanism. Disciplined Infantry retains its normal economic and war-weariness safeguards. No balancing autorun was performed.

## Files changed

- Canonical data: `src/data/nations.ts`, `src/data/leaders.ts`, `src/data/cityNames.json`, `src/data/aiLeaderEraStrategies.ts`, `src/data/leaderWarDeclarations.ts`.
- Generated integration: `public/assets/data/nations-manifest.json`, `public/assets/data/city-names-manifest.json`, `public/assets/sounds/manifest.json`, `public/assets/sprites/manifest.json`, `public/editor/epoch-leader-editor.js`.
- Assets: the two Stubb images listed above.
- Tests: `tools/fourNewNations.test.ts`, `tools/fourNewNations.browser.mjs` extended to Finland; existing npm test commands include the new cases.
- Documentation: this file and `docs/content/finland-portrait-prompts.json`.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed including manifest generation; existing Vite large-chunk warning remains. Sandbox IPC restrictions required the build to run with elevated local process access.
- Main integration suite: 71/71 passed across nation content, leader configuration, multiple/default leaders, modern alternatives, war termination and Games gossip preferences.
- Additional scenario generation, city editing, editor resource generation and war dialogue suite: 55/57 passed. Both failures reproduced against untouched HEAD: war catalog coverage expects dedicated entries for 14 existing alternative leaders, and Game Setup source assertion expects the outdated label `Official Scenarios` instead of `Scenarios`. Finland has all five dedicated war-reason pairs.
- Browser: passed editor export/import and default assignment, leader configuration controls, setup details and image decoding for all five nations; Finland additionally passed actual Game Setup random-scenario roster selection and both MP3s playing through SetupMusicManager, advancing and looping back to the first track. No page errors.
- Scenario JSON roundtrip and save validation preserve Finland and Stubb selections; currency, Unicode names, Games categories, flavor and all war reasons resolve. These persistence checks do not constitute a full played-game reload test.
- `git diff --check`: passed. Original MP3 checksums unchanged.
- Manifest generation also exposed unrelated pre-existing drift in the resource editor bundle's Tourism unlock. That generated change was excluded from this task.
