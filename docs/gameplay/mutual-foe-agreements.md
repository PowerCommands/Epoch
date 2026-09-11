# Mutual Foe Agreements

A scenario can protect specific signatory governments against a predetermined antagonist nation. Open **Mutual Foe Agreements** in the Scenario Editor to create, edit, or remove agreements. Select one antagonist nation, at least two leaders from different participating nations, and one shared support percentage (0–100%). The editor shows each leader together with their nation and preserves the agreement ID when editing.

```json
{
  "mutualFoeAgreements": [
    {
      "id": "european_mutual_defense",
      "name": "European Mutual Defense Agreement",
      "antagonistNationId": "nation_russia",
      "supportPercent": 20,
      "memberLeaderIds": [
        "leader_volodymyr_zelenskyy",
        "leader_olof_palme",
        "leader_angela_merkel"
      ]
    }
  ]
}
```

An agreement activates only on a new canonical war declaration by its antagonist against a currently protected government. Existing scenario-start wars and restored wars do not activate agreements. Changing the antagonist's leader has no effect. Replacing a signatory leader suspends that nation's membership; replacing the defended leader ends the crisis.

Each agreement has at most one active crisis and one recipient. Activation ends wars and terminates vassal contracts **only between currently active member governments**. It does not negotiate settlements, reset diplomatic memory, create alliances, grant borders, or make any member enter the antagonist war.

Eligible supporters immediately transfer the shared percentage of available Gold to the defended nation, rounding down to whole Gold. There are no refunds. A supporter already at war with the antagonist fulfills its obligation militarily and pays nothing. Any later war entry against the antagonist likewise marks that signatory as fulfilled for the remainder of the crisis. Separate peace, leader absence/return, and reload never undo fulfillment or turn the supporter into another recipient.

## Economy ordering

Recurring contributions use ordinary positive **net** national income: canonical city/manufactured/trade income with the existing happiness modifier, occupation and renewable maintenance costs, and unit upkeep. Incoming and outgoing Mutual Foe transfers never enter this basis.

ResourceSystem credits the donor's ordinary income on its income turn, then commits the support as an atomic treasury transfer. The recipient gets the same amount immediately; its own turn does not credit a second copy. Transfer amounts round down and clamp to available treasury. Zero or negative normal income contributes zero.

For overlapping agreements, each requested contribution uses the same ordinary income. Agreements settle in stable agreement-ID order; their combined outgoing commitment is capped at that donor's positive income. This prevents debt even if authored percentages total more than 100%. Initial reserve contributions instead use the available reserve at each agreement's activation.

The HUD Gold tooltip and Leader Details treasury breakdown show outgoing **Mutual Foe Agreement** and incoming **Mutual Foe Agreement Support**. `NationResources.goldPerTurn` remains ordinary income; `effectiveGoldPerTurn` adds the derived Mutual Foe delta. These previews are not saved as additional balances or city modifiers.

## State and integration

- `MutualFoeAgreementSystem` owns only crisis history and eligibility coordination. NationManager, canonical leader lookup/events, DiplomacyManager, and ResourceSystem own the underlying state.
- The active-crisis collection stores the agreement, antagonist, defended nation/leader, canonical war-start round, signatories whose initial contribution was processed, fulfilled signatory leader IDs, and the last settled round per donor nation.
- Epoch has no distinct persistent war ID. The system uses the canonical war-start round and war-ended events. Event deduplication lasts until that bilateral war ends; declaration metadata is not treated as a unique event ID.
- SaveLoadService stores authored definitions separately from active crises and restores crises quietly after canonical leaders, nations, diplomacy, and the turn cursor. Restoring never transfers reserve Gold or repeats activation effects. Missing runtime data means no crisis.
- Scene shutdown removes global leader subscriptions and clears runtime/derived state. Restart and load construct a fresh session system.
- Invalid external definitions are skipped with `[MutualFoe]` diagnostics. Valid agreements in the same scenario remain usable. No changes are required to old scenarios or saves.
- Activation enters the existing historical timeline/newspaper pipeline. Relevant players receive the existing queued event popup on activation, military fulfillment, member departure, or crisis end. Gold transfers do not generate per-turn articles.

## Verification

```sh
npm run test:mutual-foe
node --import tsx scripts/generateEditorResourceBundle.ts
# With a local Vite server running:
EPOCH_BASE_URL=http://127.0.0.1:5187 node tools/mutualFoeAgreement.browser.mjs
```

The automated suite covers triggers, canonical leadership and Overthrow Leadership, internal wars and vassals, conservation and rounding, overlapping agreements, military fulfillment, separate peace, lifecycle, malformed data, editor operations, and full SaveLoadService round trips.

The browser check authors the agreement in the actual Scenario Editor, boots a four-nation GameScene, verifies initial and recurring transfers, joins Sweden to the war, signs separate peace, saves/restarts the scene, tests reattack, and ends the triggering war. Its scenario, screenshots, save, and verification report are written to `/tmp/epoch-mutual-foe` by default.
