# Timeline Calibration Report

Date: 2026-06-06
Scenario: `map_maritime_expansion`
Victory mode: domination only (`science: off`, `cultural: off`)

## Scope

This pass calibrated the display calendar against naturally observed era progression. Technology costs, culture costs, and AI behavior were not changed.

The calendar was retuned once after the first fresh 0-200 run showed believable era progression paired with implausibly ancient display years. After that change, the accepted checkpoint chain continued from save to save in 200-turn segments.

## Code Changes

- Retuned auto calendar progression in `src/systems/GameDate.ts`.
  - `BASE_YEARS_PER_ROUND`: `25` -> `167`
  - `YEAR_PROGRESS_DECAY`: `0.002677` -> `0.02762`
- Added era milestone diagnostics to `src/scenes/GameScene.ts`.
  - Captures nation, turn, displayed year/date, previous era, new era, and transition source.
  - Initializes milestone baselines before autoplay and after saved-game restore so continuation runs do not report false era jumps.
- Extended `scripts/autorun.ts`.
  - Writes era milestones to `latest-summary.md`.
  - Writes structured milestones to `latest-timeline-calibration.json`.
  - Preserves domination-only metadata for continued saves.
  - Fixed continued-save metadata handling after a run exposed a `savedState` reference error at summary-write time.

## Rejected Segment

### Segment 0-200, Fresh Start

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --victory domination --timeout-ms 3600000
```

Result: rejected.

Final checkpoint: turn 201, January 744 BC.

Observed milestones:

| Era | Nation | Turn | Date | Judgment |
| --- | --- | ---: | --- | --- |
| classical | Sweden | 43 | 3056 BC | Too early in displayed history |
| classical | England | 43 | 3056 BC | Too early in displayed history |
| classical | China | 44 | 2976 BC | Too early in displayed history |
| classical | India | 50 | 2937 BC | Too early in displayed history |
| classical | Mongolia | 73 | 2421 BC | Too early in displayed history |
| classical | HRE | 101 | 1645 BC | Too early in displayed history |
| medieval | China | 103 | 1951 BC | Too early in displayed history |
| medieval | India | 117 | 1802 BC | Too early in displayed history |
| medieval | Sweden | 122 | 1773 BC | Too early in displayed history |
| medieval | England | 116 | 1744 BC | Too early in displayed history |
| medieval | Mongolia | 123 | 1729 BC | Too early in displayed history |

Reasoning: AI progression was allowed to run naturally, but the displayed year lagged badly behind the observed era transitions. This was a calendar issue, not a tech or culture progression issue. The calendar constants were adjusted and the 0-200 segment was restarted.

## Accepted Segments

### Segment 0-200, Fresh Start

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --victory domination --timeout-ms 3600000
```

Final checkpoint: turn 201, January 1121 AD.

Observed milestones:

| Era | Nation | Turn | Date | Judgment |
| --- | --- | ---: | --- | --- |
| classical | Sweden | 43 | 753 BC | Acceptable |
| classical | England | 43 | 753 BC | Acceptable |
| classical | China | 44 | 717 BC | Acceptable |
| classical | India | 50 | 523 BC | Acceptable |
| classical | Mongolia | 73 | 24 AD | Late, but natural laggard |
| classical | HRE | 101 | 440 AD | Late, but natural laggard |
| medieval | China | 103 | 463 AD | Acceptable |
| medieval | England | 116 | 600 AD | Acceptable |
| medieval | India | 117 | 609 AD | Acceptable |
| medieval | Sweden | 122 | 655 AD | Acceptable |
| medieval | Mongolia | 123 | 664 AD | Acceptable |
| medieval | HRE | 181 | 1035 AD | Late, but natural laggard |

Evaluation: accepted. The main Classical cluster landed within the 1000-500 BC target, and the main Medieval cluster landed within the 400-800 AD target.

### Segment 200-400, Continued Save

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --save autorun-output/latest-save.json --victory domination --timeout-ms 3600000
```

Final checkpoint: turn 401, January 1545 AD.

Observed milestones:

| Era | Nation | Turn | Date | Judgment |
| --- | --- | ---: | --- | --- |
| renaissance | China | 254 | 1290 AD | Slightly early, acceptable |
| renaissance | India | 331 | 1450 AD | Acceptable |
| renaissance | Mongolia | 359 | 1492 AD | Acceptable |
| renaissance | England | 364 | 1499 AD | Acceptable |

Evaluation: accepted. Renaissance target is roughly 1300-1500 AD; one leader arrived about 10 years early, while the broader cluster fit the target range. This run also verified continued-save autorun after fixing saved victory-condition metadata.

### Segment 400-600, Continued Save

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --save autorun-output/latest-save.json --victory domination --timeout-ms 3600000
```

Final checkpoint: turn 601, January 1703 AD.

Observed milestones:

| Era | Nation | Turn | Date | Judgment |
| --- | --- | ---: | --- | --- |
| renaissance | Sweden | 498 | 1637 AD | Late, natural laggard |

Evaluation: accepted. No Industrial era appeared yet, but leading nations were researching Industrial-entry technologies around the historical start of the Industrial target window. No calendar change was made.

### Segment 600-800, Continued Save

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --save autorun-output/latest-save.json --victory domination --timeout-ms 3600000
```

Final checkpoint: turn 801, January 1786 AD.

Observed milestones:

| Era | Nation | Turn | Date | Judgment |
| --- | --- | ---: | --- | --- |
| industrial | Mongolia | 775 | 1777 AD | Acceptable |

Evaluation: accepted. The first observed Industrial transition landed inside the 1700-1850 target.

### Segment 800-1000, Continued Save

Command:

```sh
npm run autorun -- --turns 200 --scenario map_maritime_expansion --save autorun-output/latest-save.json --victory domination --timeout-ms 3600000
```

Final checkpoint: turn 1001, January 1836 AD.

Observed milestones:

| Era | Nation | Turn | Date | Source | Judgment |
| --- | --- | ---: | --- | --- | --- |
| industrial | England | 953 | January 1826 AD | Biology | Acceptable |
| industrial | China | 967 | January 1829 AD | Industrialization | Acceptable |

Evaluation: accepted. The additional Industrial transitions still landed inside the 1700-1850 target. The run ended cleanly after the requested 200-turn segment.

## Stop Condition

The calibration process stopped after the accepted 800-1000 segment because completion criterion 4 was reached: the culture tree was effectively exhausted by multiple AI nations.

At turn 1001:

| Nation | Era | Techs | Culture nodes | Current culture |
| --- | --- | ---: | ---: | --- |
| Mongolia | industrial | 46 | 38 | none |
| England | industrial | 49 | 38 | none |
| China | industrial | 42 | 38 | none |
| India | renaissance | 39 | 38 | none |

No domination victory had occurred, and the technology tree was not exhausted. Modern and Future technology eras were therefore not observed before the culture-tree completion endpoint.

## Final Judgment

The accepted calendar tuning produces believable displayed years for all observed natural era transitions:

- Classical: main cluster around 753-523 BC.
- Medieval: main cluster around 463-664 AD.
- Renaissance: main cluster around 1290-1499 AD.
- Industrial: observed leaders around 1777-1829 AD.

The year/era relationship now feels credible through the observed end condition. Later Modern/Future transitions remain an open calibration concern because the domination-only game hit culture exhaustion before those eras appeared in normal play.

## Validation Notes

- Domination-only autoruns functioned correctly; summaries and metadata reported domination enabled with science and cultural victories disabled.
- Accepted saves were continued through 200-turn segments from turn 201 to turn 1001.
- Era milestones appeared in both `latest-summary.md` and `latest-timeline-calibration.json`.
- Autorun exited cleanly at the requested segment endpoint; no domination victory occurred.
- Typecheck was run during implementation after the diagnostics and calendar changes. A final typecheck was run after the report was written.

## Remaining Concerns

- Browser output still includes unrelated asset-processing failures for some generated image names. These did not prevent autorun completion or timeline diagnostics.
- Covert-action debug logs are very verbose during long autoruns. This did not affect calibration, but it makes run logs harder to inspect.
- Modern/Future timeline calibration should be revisited if future changes let technology continue past culture-tree exhaustion under domination-only play.
