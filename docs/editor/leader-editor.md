# Leaders & AI editor

Open **Leaders & AI** in the Scenario Editor toolbar. Edits are staged until **Apply to Scenario**; Discard/Close (or Escape) discards the draft. Apply updates the current scenario and autosave. Download JSON and Save As My Own Scenario include the configuration. Built-in source definitions are never mutated.

## Architecture investigation

| Layer | Canonical source | Runtime role / editor treatment |
|---|---|---|
| Identity and alternative leaders | `src/data/leaders.ts`, `src/types/leader.ts` | ID, nation membership, and default status stay canonical. Edit name, title, description, portrait, and select a scenario leader. |
| Direct personality | `AILeaderPersonality`, `DEFAULT_AI_LEADER_PERSONALITY` | Strategy-selection biases, war/peace thresholds, losses before peace, casualty ratio, and exploitation interest. Sparse scenario patches merge over defaults. |
| National agendas | `aiNationalAgendas.ts` | Add scores to dynamic base strategy selection. Leader assignment → balanced fallback; scenario nation agenda takes precedence. |
| Base AI strategies | `aiStrategies.ts` | Tactical unit limits, city goals, production scores. Nation starts with its authored strategy or baseline; runtime selectors can change it. These are **not** era strategies. |
| Strategy behavior weights | `aiStrategyBehaviorWeights.ts`, `AIStrategyService` | Separate exploration, diplomacy, trade, aggression, defense weights, edited alongside each base strategy. |
| Era strategy definitions | `aiLeaderEraStrategies.ts` | Production, research, culture, diplomacy, military preparation, founding, resource, tile purchase, happiness, city focus, and production rhythm preferences. |
| Leader era assignments | `LEADER_ERA_STRATEGY_PROFILES` | Previously a separate leader-keyed mapping. Shared resolver shows the effective strategy and originating era for all nine eras. |
| Military doctrines | `aiMilitaryDoctrines.ts` | Role scores, target army composition, military budget, economic tolerance, modernization/quantity/quality preferences. |
| Covert personalities | `covertPersonalities.ts`, `LEADER_COVERT_PERSONALITY_DEFAULTS` | Explicit leader setting → leader-specific mapping → pragmatist; nation overrides take precedence. Suspicion and diplomacy modifiers are active. Some mission preference fields remain future-facing, as documented in the original types. |
| Ideologies | `ideologies.ts`, `ideologyCompatibility.ts` | Cooperation/trade/war/border/expansion/culture modifiers; compatibility is a separate global matrix, displayed read-only. Missing ideology uses traditionalism. |
| Culture priorities | Leader definitions + `cultureTree.ts` | Matching node IDs receive a culture selection bonus. Membership matters, not list order. Selectors show canonical node names and eras. These do not unlock nodes. |
| Games of Nations preferences | `GAMES_PREFERENCES_BY_LEADER` in `leaders.ts`, `gamesOfNationsSports.ts` | Original leader-keyed mapping is already composed into canonical leaders. Edit traditional and additional favorites using their proper sport categories. |
| Diplomacy metadata | `LeaderDiplomacyFlavor` | Seven optional descriptive lines; currently not consumed by diplomacy decisions/UI. Labeled as metadata. |
| Actual war announcements | `leaderWarDeclarations.ts` | Separate reason-specific two-line alternatives, with generic fallback and deterministic selection. Editable independently of diplomacy metadata. No effect on the war decision itself. |
| Voluntary city limit | `maxPreferredCities`, AISystem, AIOverseasExpansionSystem | Limits settlers/voluntary expansion, not cities acquired through war or transfers. Null scenario value explicitly removes a cap; absent inherits. |
| Legacy nation overrides | `ScenarioNation`, `setScenarioLeaderOverrides` | Names/descriptions, selected alternative, initial strategy, agenda and covert personality. Retained, visible and editable in the nation subsection. |

Other behavior examined includes scenario nation replacement/customization, NationManager initialization, strategy evaluation/selection, military capacity and doctrine evaluation, culture/research planning, covert operations and suspicion, diplomacy peace gates, gossip agenda information, war narrative classification, and GameScene/MainMenu/SaveLoad lifecycles.

### Behavior outside leader definitions

Era assignments, covert default mappings, Games favorites, war phrases, base strategy behavior weights, ideology compatibility, and nation-level starting strategy/agenda/covert choices were separate layers. They remain modular and are composed by the editor.

Two gameplay checks in AISystem depended on the literal `navalPower` doctrine ID. They now read `navalExpeditions` and `navalSaturationControl` flags on the doctrine. Only canonical Naval Power enables these flags, preserving prior behavior while allowing a cloned doctrine to retain its effects. Legacy top-level doctrine modernization/quantity/quality values remain for compatibility; the editor edits the authoritative production behavior block and synchronizes the mirrors.

No leader/nation-specific AI decision branches requiring relocation were found beyond those doctrine checks. Situation-dependent strategy selection, unit availability, national technology/culture, resource conditions, consolidation/recovery, peace treaty and capitulation rules remain in their own systems. National colors, currencies, city names, and audio metadata remain national identity data rather than AI personality fields.

## Persistence and resolution

`ScenarioData.leaderConfiguration` is optional and versioned:

```ts
{
  version: 1,
  leaders: { [leaderId]: sparseLeaderPatch },
  profiles: { agendas?, doctrines?, covert?, ideologies?, strategies?, eraStrategies? },
  eraAssignments: { [leaderId]: sparseEraTransitionMap },
  behaviorWeights: { [baseStrategyId]: completeWeights },
  warDeclarations: { [leaderId]: completeReasonPhraseSet }
}
```

Profile collections contain complete scenario definitions. Matching IDs override a built-in definition; new IDs create variants. Leader personality and diplomacy flavor patches merge with built-in values. Other leader properties replace the corresponding value. Identity IDs, nation membership, and canonical default markers cannot be patched.

Each authored era map replaces that leader's built-in map. Only transition entries are stored. Removing an entry exposes the nearest earlier assignment; an empty map uses Balanced Growth throughout. Reset timeline removes the scenario map and restores built-in transitions. Gameplay and editor both call `resolveEraAssignment` in `leaderEraResolution.ts`. Era activation follows the highest **researched technology** era, not the calendar year or culture progression.

The editor browser bundle imports canonical TypeScript definitions and resolvers. `scripts/generateEditorResourceBundle.ts` generates `public/editor/epoch-leader-editor.js` alongside the existing resource bundle during manifest generation. There are no copied tuning tables in handwritten editor JavaScript. `leaderParameterHelp.ts` contains explanatory metadata, not a second set of tuning values.

The runtime configuration store is installed before scenario nation replacement/initialization, refreshed on menu scenario selection, and cleared for scenarios without overrides. All relevant runtime accessors consult it. SavedGameState includes a detached configuration snapshot, restored before system initialization. This follows the existing application-wide active leader-selection/legacy override lifecycle; it does not mutate the exported canonical arrays.

## Shared profiles and diagnostics

Users are recalculated from canonical leaders plus scenario patches whenever the view renders. Links work in both directions. Agenda/covert usage reports both leader references and overriding scenario nation values, so a masked leader reference remains discoverable. Era usage reports every effective era with Explicit or Inherited-from provenance. Base strategies show **potential runtime users**, not a false fixed leader assignment.

Variant creation is supported for agendas, doctrines, covert personalities and era strategies. It creates an unassigned scenario definition; the designer then assigns it in a leader view. Existing leaders retain their original reference. Shared editors state their user count and list users before parameters.

Base strategy and ideology IDs deliberately remain fixed. The former are enumerated by runtime selectors and the latter by the compatibility matrix. Their parameters can be edited, but creating a new ID would otherwise misleadingly suggest full runtime support.

Validation covers unknown leader/profile/era/culture/sport references, sport categories, duplicate IDs, profile structure, finite numbers, personality ranges, core ratio ranges, city limits, and required phrase pairs. Invalid authored edits block Apply. Existing scenario exports retain the editor's existing soft-warning convention. Imported broken references are preserved and labeled Unknown rather than silently replaced by a selector default. Malformed structures show a recovery view.

Personality biases previously had no enforced runtime range. The editor uses an explicit authoring range of −100 to 100; tolerances use 0–100, casualty ratio 0–1, exploitation interest integer 0–4, and loss count integer 0–10000. No canonical personality values were changed.

## Deliberate boundaries and follow-up findings

- Charles VII has a pre-existing `drama_poetry` culture priority that does not exist in the canonical culture tree. The leader view displays this diagnostic. It is not silently corrected or rebalanced.
- Ideology compatibility remains a fixed global matrix. A future extensible ideology system should define compatibility for new IDs before allowing variants.
- Base strategy selection remains a fixed set of candidate IDs. A future extension should define selection rules for new candidates before allowing new base strategies.
- Gossip agenda text and war narrative reason classification contain fixed-ID flavor branches. Custom agendas fall back to their description in gossip; custom IDs do not inherit the special narrative labels of their source agenda. These are flavor distinctions, not decision-system changes.
- Some covert preference parameters are explicitly future-facing in the existing system; exposing them does not add a new covert AI decision algorithm.
- The seven diplomacy flavor metadata fields remain unused by current runtime consumers. The separate war phrase system is active and editable.
- Full scenario profile overrides are snapshots, so an overridden profile does not automatically inherit future upstream parameter changes. Reset restores the updated built-in profile.
- The existing global active-configuration lifecycle supports one active game in this application. Concurrent independent simulations within one JavaScript realm would benefit from per-game configuration contexts in a future task.

## Verification

- `npm run test:leader-editor` covers configuration and existing alternative-leader regressions.
- `node --import tsx tools/leaderConfiguration.test.ts` runs 16 focused cases: all canonical leaders and all eras, sparse serialization, scenario/legacy/alternative composition, shared overrides, scenario reset, variants and usage, invalid references/shapes/ranges, phrase round trips, city-cap removal, doctrine flags, cloning every reusable definition, and sparse flavor merging.
- `tools/leaderEditor.browser.mjs` exercises the actual Scenario Editor toolbar, personality edit, era inheritance, variant creation/assignment, cross-links, scenario output persistence, reopen, validation blocking, and discard. Run against a local Vite server with `EPOCH_EDITOR_URL`; `CHROME_PATH` can specify a Chrome executable.
- Existing Gandhi/Genghis/Mad Jack/de Gaulle/Stalin/Mussolini configurations are covered through all-leader comparisons, with existing alternative leader/de Gaulle/Hitler regressions and gossip information tests run as well.
- TypeScript typecheck and Vite production build pass. Vite retains the existing large-chunk advisory.
