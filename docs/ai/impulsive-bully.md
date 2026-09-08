# Impulsive Bully and Leader Statements

`LeaderDefinition.impulsiveBully?: boolean` is an explicit characteristic, independent of covert personality and Opportunism. Missing means disabled. Built-in defaults enable Mad Jack, Ivan IV, Benito Mussolini and the alternative leader Adolf Hitler. These are game-personality choices; the trait is not inferred from aggression, ideology, or government. All other leaders can be enabled or disabled in scenario leader overrides and the Leader Editor.

The editor exposes the trait under Personality and includes it in the derived character summary. Alternative-leader selection, sparse scenario patches, configuration serialization and game-save configuration snapshots retain explicit true/false values. Generated editor JavaScript comes from `leaderEditorBundle.ts`.

## Personality and capabilities

The canonical technology era determines expression: Ancient .15, Classical .30, Medieval .50, Renaissance .75, Industrial .90, Modern and all later eras 1. Nothing unlocks the trait. Intensity changes event perception, severity selection, behavior frequency, economic escalation and public support probability. It never multiplies a particular insult or Statement's diplomatic effects.

`ImpulsiveBullySystem` keeps one directional grievance per AI leader's nation, lasting 15 rounds. A new grievance can replace it; at most one is perceived per round. A five-round nation-wide cadence bounds ambient actions regardless of the number of rivals. Sources include:

- rejected diplomatic proposals, including trade, peace summits and requests to join a war;
- opposed World Council votes, condemnation and Council decisions concerning the nation;
- economic pressure, with greater sensitivity to retaliation against the Bully's own pressure;
- public insults, threatening Statements, military unit losses in ordinary wars and city losses;
- foreign Wonders and Games results;
- spontaneous irritation, dubious claims, anonymous reports, or no discernible reason.

Only known, living rivals are grievance targets. Human leaders are not made to issue outbursts or select retaliation automatically. Low treasury and negative net income can prompt denial rhetoric and strategic retreat. This is a flavor trigger using existing resources, not a misinformation or economic simulation.

A grievance temporarily adds 8/16/24 Hostility and subtracts 4/8/12 Affinity in the directional diplomatic evaluation. It composes with Opportunism's existing temporary influence. A severe unresolved grievance contributes .30/.45 to normal war evaluation after its creation round. The Bully system cannot declare war. Readiness comparisons, allied defensive power, high military threat, reclaim-capital restraint, treaties, ceasefires, declaration cooldowns and `DiplomacyManager.declareWar` remain authoritative.

Economic retaliation is considered inside the routine AI pressure path. Tariffs are favored, Boycott is occasional, and Embargo requires a severe grievance with a lower selection probability. All candidates pass `canImposeEconomicPressure`, the existing eight-round escalation cooldown, and the normal `EconomicPressureActionService` used by other AI actions. Currency, Banking and Economics remain the canonical prerequisites; the leader's era never supplies an action whitelist. Failed eligibility produces a diagnostic and cannot unlock a measure.

A Bully can lift pressure when militarily endangered or economically distressed, including after the grievance has expired. Existing sanction expiry, removal negotiation, peace and capitulation continue operating. Removal and peace clear the relevant grievance, delay further impulsive actions, and queue a declaration of success. Historical and canonical outcomes are never rewritten to support that declaration.

## Public communication

`LeaderStatementSystem.issue` selects from `LEADER_STATEMENTS` using a content predicate, allowing other personalities to use the same API. The pool supports constructive, concerned, assertive, grandiose, bizarre and threatening tones, plus denial, retreat, endorsement and defense contexts. The first automatic speaker is Impulsive Bully; ordinary leaders' serious rhetoric is available for future callers without introducing a second scheduler.

Statements address the world. Observers are living nations that have met the speaker, sorted deterministically. History stores the exact quote, frozen display names, tone, content event ID, optional subject and optional response ID. Epoch Chronicle reports them as normal public addresses with serious editorial language. Targeted remarks instead use the existing automatic Gossip definitions and `leaderInsult` History/Newspaper path.

Statement speakers share an eight-round cooldown across original speeches and responses; the last six content IDs are excluded while alternatives remain, falling back to the least recently used line if a small pool is exhausted. Bully Gossip shares the existing 25-round pair cooldown with all other automatic Gossip and excludes the speaker's last three Bully lines. Automatic definitions remain unavailable through the human Culture-gated Gossip menu.

Threat Fear reuses `calculateThreatFearMultiplier` and the normal military evaluator's power. Weak nations may make absurd threats, but generate Hostility and Suspicion without Fear. Effects on canonical pair memory follow Epoch's existing symmetric semantics; the emotional grievance and temporary evaluation remain directional.

## Mutual admiration and volatility

Two Bullies receive a modest +4 temporary Affinity predisposition. Their grandiose, bizarre or threatening rhetoric can add modest real Affinity; public endorsement adds stronger Affinity and a little Trust. Ordinary observers become suspicious of bizarre rhetoric and endorsements. A defense of another Bully's denial can worsen relations with the criticizing nation.

Support probability increases with the responding leader's era intensity. War, substantial Hostility or a grievance against the speaker suppress endorsements. Admiration never protects a friendship from new grievances or canonical diplomacy. There is no special bloc, alliance, Join War, aid or voting commitment. Extravagant rhetoric promises nothing mechanically.

Publication listeners cannot recursively publish. Automatic support is processed after publication, selects at most one respondent, and never responds to a response. Pending originals survive a save between publication and the next AI turn.

## Persistence, diagnostics and verification

State is optional in old saves. SaveLoadService persists grievances, cadence, pending rhetoric, pending responses, speaker cooldowns, recent content and the existing Gossip state. HistoricalTimelineService's `onRecorded` observes only newly recorded events; restoring History does not replay reactions. Selection uses the existing FNV-based deterministic flavor hash plus scenario seed, round and stable identifiers. No global random generator or external service is involved.

`[ImpulsiveBully]` diagnostics include grievance cause/severity/expiry, outbursts, unavailable capabilities, retaliation, de-escalation, public support and contributions to normal war evaluation/declaration. `[LeaderStatement]` logs include quote, ID, context and tone. Production logs include the speaker's normal AI log prefix and involved nation IDs, so an autorun can trace a crisis back to a dubious report.

`npm run test:impulsive-bully` runs focused behavior and adjacent regressions. The focused suite exercises real save-service capture/application, canonical pressure eligibility, normal AI war safeguards, observer credibility, public support without commitments, response bounds, deterministic continuation, cooldowns, repetition avoidance, editor/configuration round trips, and Chronicle/History integration. `tools/leaderEditor.browser.mjs` verifies the checkbox and scenario output in Chrome. Broader Gossip, Council, economic pressure, peace, war termination and personality regression suites are also run, along with typecheck and production build.

These are initial controlled probabilities. No long balance autoruns have been performed; behavioral tuning remains a manual follow-up.
