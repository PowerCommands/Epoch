# Historical World Events

Author events in **Editor → Scenario Details → Historical Events**. Existing World Wars and Turning Points retain their existing behavior. The four new types use calendar scheduling and round durations; they do not change the calendar cadence. Overdue events start at the next pre-round boundary. Each authored ID is an independent, single-use instance.

`ScenarioHistoricalEventSystem` owns `HistoricalWorldEvents` and includes its JSON state in the existing scenario historical-event save payload. The child module handles targeting, lifecycle and owned modifiers. `HistoricalWorldEventAdapters` connects population and irreversible cancellation to the existing managers. GameScene supplies runtime dependencies; ResourceSystem, HappinessSystem and TradeDealSystem consume the historical providers.

Defaults and illustration filenames live in `WORLD_EVENT_DEFINITIONS`. Add a type to `ScenarioTimedHistoricalEvent`, its definition, targeting/effect rules and relevant editor field descriptors to extend the feature. The Chronicle uses existing HistoricalTimeline/Newspaper machinery and four dedicated images under `public/assets/sprites/news/`.

## Economic behavior

- Crash reductions affect positive city/policy/manufactured Gold generation and export receipts. Negative entries, import payments, occupation costs and the existing upkeep systems retain their costs. Happiness continues to affect the economy through its normal rules.
- Famine multiplies gross city Food, including building yields and maritime bonuses, before civilian consumption and military growth upkeep. Growth uses the resulting normal Food surplus. This does not add a separate starvation/population simulation.
- Pandemic snapshots the deterministic origin and both directions of embassy connectivity at activation. Trade contracts and directional Open Borders involving affected nations are cancelled through their managers; embassies and unrelated diplomatic state remain.
- Energy crises cancel only Coal, Natural Gas, Oil and Uranium contracts. Domestic access remains intact. At completion, a saved per-resource multiplier compounds by `1 + percentage / 100`. Human quotes and AI offers apply it to their existing base price and round up to the integer Gold contract unit. Base resource definitions remain unchanged. Existing and newly negotiated contracts are never silently repriced.

## Humanitarian aid

An active Council or UN is required at famine activation. The existing Council records a famine emergency meeting. Its Overview shows relief commitments, an explicit decline option, production diversion estimates, cumulative Food sent and earned Diplomatic Score. Commitments can be changed there throughout the emergency. AI considers Food surplus, war/relationship state and leader diplomacy bias; it reserves part of its surplus.

Aid percentages across simultaneous emergencies are capped at 100% of a donor's production. Each donor's normal Food calculation first applies famine losses, then deducts committed percentages before consumption. The same amount enters a saved recipient delivery balance. The recipient consumes the balance at its next normal Food calculation, distributed evenly across its cities. Received aid is not donated again. Last-turn shipments can arrive after an emergency expires. If the Council disappears, further donations stop; already dispatched Food remains deliverable. Eliminated recipients receive no new shipments.

The full configured score corresponds to supplying the recipient's initial lost Food production for the entire event. Earned score is `floor(reward × min(1, cumulative Food sent / initial total Food deficit))`. Only increments are passed to the Council's canonical member score accounting. Turn settlement markers, cumulative contributions, awarded score and delivery balances are saved, so previews, loading and repeated settlement cannot generate extra Food or score.

Start/end status transitions own article emission and permanent consequences. Restoration replaces state without replaying transitions. Temporary modifiers are derived only from active instances; expiration never restores an old economy or recreates a contract.

## Verification

Run `node --import tsx tools/historicalWorldEvents.test.ts`, the existing `scenarioHistoricalEvent*.test.ts` tests, `node tools/historicalWorldEvents.browser.mjs`, relevant resource/trade/Council/Newspaper regression tests, `npm run typecheck` and `npm run build`.
