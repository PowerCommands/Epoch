# Opportunism

`LeaderDefinition.opportunism?: boolean` is a small explicit leader trait. Absent means disabled; it is independent of the covert personality named Opportunist. Scenario leader patches, alternative-leader selection, game-save configuration snapshots and the Leader Editor all preserve true/false values. The editor exposes the checkbox under Personality and adds Opportunistic to the derived character summary.

## Default roster

Enabled for Henry V, Mehmed II, Qin Shi Huang, Genghis Khan, Oda Nobunaga, Mad Jack, Ivan IV, Joseph Stalin, Benito Mussolini and Adolf Hitler.

These are game-personality choices: campaign-driven expansion for Henry/Mehmed/Qin/Genghis/Oda; raiding for Mad Jack; coercive imperial pressure for Ivan/Stalin; prestige-seeking expansion for Mussolini; coercive conquest for Hitler. They are not a rule automatically derived from aggression. Hermann, de Gaulle and Sikorski retain defensive militarism without this trait. Churchill explicitly disables it despite inheriting Henry V's other core tuning. Other leaders remain disabled unless a scenario opts them in.

## Observation and restraint

`OpportunismSystem` retains a small directional memory per known rival. AIDiplomacySystem evaluates it for AI nations only, with a five-round cadence. It never declares war and never calculates a separate military-strength definition.

It uses `AIMilitaryEvaluationSystem.getMilitaryStrength` and `getDefensiveWarPowerAgainst`: damaged-unit strength, city defenses, defensive alliance partners and peacekeepers retain the game's existing definitions. Own unit strength, rather than city defenses alone, must also meet the existing era-strategy readiness ratio (at least 1).

Activation requires a living, met, peaceful rival against which the canonical `canDeclareWar` currently permits war. Alliances, vassal restrictions, treaties and ceasefires therefore constrain this motive. Existing wars, high fear, high target threat, and a strong friendly relationship restrain activation. Doctrine shapes the forces the AI builds; aggression and war tolerance shape its opportunity war bonus; existing goals, ideology and era war weights continue shaping the normal war score.

Geography is deliberately conservative and reuses existing services:

- Land targets must share the existing land connectivity region and fall within the offensive operation system's distance limit.
- Naval projection requires a maritime doctrine and an actual ranged combat ship able to pathfind to a coastal approach. Up to three ships are checked, in stable ID order.

The land test is a connectivity/distance approximation, not a new hypothetical-invasion planner. It does not solve future third-party transit permission or calculate exactly how much of the total army can reach each target. A full campaign logistics model remains outside this feature.

## Pressure and deterrence

| Own / defensive-coalition strength | Gain per evaluation | Maximum temporary pressure |
|---|---:|---:|
| Below 1.75 | 0 | 0 |
| 1.75–2.5 | 6 | 12 |
| 2.5–4 | 10 | 32 |
| 4 or greater | 15 | 60 |

Pressure increases perceived hostility and reduces affinity by one third of its value through DiplomaticEvaluationSystem's temporary directional relation influence. Passive Audience attitude evaluation and AI decisions share that view. Permanent diplomatic memory is untouched: automatic remarks do not also apply the player Gossip penalties.

A reduced advantage immediately lowers the pressure ceiling used by decisions. Credible rearmament, increased allied defensive power, stronger friendship, or another restraint can suppress the influence immediately between cadence updates. The next evaluation updates saved memory and logs the cooling transition. Unrelated grievances and the normal consequences of wars/sanctions still belong to their existing systems.

## Escalation and presentation

Sixteen new Gossip definitions span mockery, intimidation, veiled territorial threats and military threats. The selected context follows accumulated pressure. They are automatic-only so adding them does not bypass the human player's existing culture-gated Gossip progression.

GossipFlavorEventSystem supplies deterministic selection, its existing 25-round shared pair cooldown, structured `leaderInsult` History events, human-recipient metadata and ordinary flavor logging. Chance rolls vary by stage; no uncontrolled randomness or special Opportunism popup is introduced. The opportunity memory and Gossip cooldowns both serialize through SaveLoadService and restore before gameplay resumes.

Sustained overwhelming weakness (pressure 45+) supplies an opportunity war-score bonus and can open the existing war evaluation even before a hostile attitude is reached. Temporary pressure can also make an existing ideology/grievance combination hostile earlier. Neither route bypasses ordinary military-risk checks, reclaim-recovery restrictions, treaty/ceasefire rules, declaration cooldowns, or `DiplomacyManager.declareWar`.

An actual successful declaration records whether opportunity contributed through its score or attitude escalation. Its existing narrative classifier receives this fact as a conquest motive and still selects among the existing reasons. Existing leader-specific conquest/ambition/other war phrases remain unchanged and flow through the normal declaration dialogue.

`[Opportunism]` logs report ratio and canonical strength components, pressure changes, generated remarks, cooling, and successful war contribution. Saturated, unchanged observations do not emit repeated evaluation logs.

## Verification

`npm run test:opportunism` runs the new tests alongside war-dialogue, Gossip/flavor and leader-configuration regressions. Focused cases cover disabled/missing flags, graduated imbalance, canonical damaged-unit and allied-power deterrence, immediate recovery, reachable/readiness/friendship/war restrictions, pressure bounds and quiet saturation, remark cooldown/save restoration, ordinary war eligibility and rejection, ceasefire enforcement, successful war attribution (both routes), alternative leaders and scenario serialization.

`tools/leaderEditor.browser.mjs` additionally checks the checkbox's default state, editing and scenario-output persistence. Typecheck and the production build are also verified. No long balance autorun was used to tune these initial thresholds.
