# Modern alternative leaders

Fourteen alternatives are appended to `ALL_LEADERS` through
`src/data/modernAlternativeLeaders.ts`. No existing definition or default changes.
The actual French default is Charles VII; this checkout has no Napoleon definition.
Britain's prime ministers use the existing England nation. The United States has
Washington, Roosevelt, and Trump, in that order.

These are authored strategic game interpretations, not psychological assessments,
party classifications, historical simulations, or claims about current officeholders.
Greetings are original game dialogue, not quotations. Games preferences are game
flavor, not biographical assertions.

## Existing model and choices

The complete leader definition offers identity, title, description, portrait,
ideology, agenda, doctrine, covert personality, explicit Opportunism and Impulsive
Bully flags, culture priorities, Games preferences, optional city cap, and optional
diplomacy flavor. The ten personality parameters are aggression, expansion, economy,
culture, diplomacy, war tolerance, peace preference, minimum losses before peace,
casualty tolerance ratio, and interest in foreign resource exploitation rights.

Ideology controls diplomatic/trade/war/open-border preferences and cultural
resistance; its labels are coarse Epoch behavior presets. In particular, Mao's
`nationalism` represents state sovereignty and ideological resistance, **not** an
assertion that nationalism is the same as communism. No communist ideology exists
in this model. His biography identifies his actual political leadership.

Doctrine determines force composition, modernization, quality/quantity, military
budgets, overbuilding under threat, and economic/war-weariness tolerance. Covert
presets independently control usage, suspicion, risk, proxy operations, espionage,
and reactions through war or trade. Era assignments add production, research,
civic and diplomatic weights, military readiness, and settlement resource interests.
No new profiles or mechanics were introduced.

| Leader | Agenda / doctrine | Distinguishing behavior |
| --- | --- | --- |
| Franklin D. Roosevelt | Naval Power / Military Mobilization | Low initial aggression, high diplomacy and economy, war tolerance 78 and casualty tolerance .58; can sustain a war once engaged. |
| Donald J. Trump | Economic / Prestige Projection | Both explicit traits, low diplomatic restraint, very high exploitation interest, Merchant covert reactions favor commercial pressure. |
| Mao Zedong | Expansionist / Cheap Infantry Swarm | Military Preparation, ideological covert orientation, war tolerance 92 and casualty tolerance .78, moderate rather than maximum aggression. |
| Emmanuel Macron | Culture / Imperial Combined Arms | Cultural influence and open international relations with a credible combined-arms force; more willing to sustain conflict than Merkel or Sánchez. |
| Angela Merkel | Economic / Fortified Defense | Strongest economy bias, restrained expansion, high peace preference, trade-preserving covert profile; can overbuild in response to threats. |
| Narendra Modi | Growth / Imperial Combined Arms | Economic ambition, cultural resilience, moderate military assertiveness and diplomacy, greater expansion/security orientation than Gandhi. |
| Vladimir Putin | Homeland Defense / Imperial Combined Arms | Opportunism, Schemer covert profile, Military Preparation and strategic-resource settlement interest; high readiness requirement and war persistence; no Bully. |
| Tony Blair | Balanced / Prestige Projection | High diplomacy combined with positive aggression, war tolerance 72 and peace preference 38; intervention-capable land/naval forces and economic development. |
| Giorgia Meloni | Growth / Disciplined Infantry | Conservative behavior preset, pragmatic covert profile, moderate resolve and aggression, little territorial expansion; no Bully. |
| Jair Bolsonaro | Growth / Disciplined Infantry | Bully, lowest diplomacy bias, higher aggression, national orientation; explicit Opportunism remains false. |
| Pedro Sánchez | Growth / Balanced | Negotiation and adaptable development, more culture than Merkel, less war persistence and military commitment than Macron. |
| Donald Tusk | Poland Shall Endure / Imperial Combined Arms | Defensive Builder, high diplomacy and war persistence, low expansion, prepared combined-arms strength. |
| Mette Frederiksen | Homeland Defense / Naval Power | Defensive Builder, more economy than Tusk, lower war persistence, credible fleet and defensive preparation. |
| Olof Palme | Culture / Fortified Defense | Cultural Dominance, strongest diplomacy and peace preference, original outspoken greeting, international influence and defensive capability. |

Roosevelt’s modest Naval Power agenda bias lets his economic preference lead in
peace, while the existing wartime strategy score tips him toward Aggressive after
war begins. Military Mobilization then gives that shift a substantial army budget.
This is covered by a real strategy-selection test, not a new conditional mechanic.

Only five new leaders need explicit era assignments: Mao and Putin use Military
Preparation; Tusk and Frederiksen use Defensive Builder; Palme uses Cultural
Dominance. Each starts in `ancient` and inherits across eras through the existing
resolution mechanism. Others use its Balanced Growth fallback.

There is no separate alliance-loyalty, allied-intervention, impulsivity intensity,
insult sensitivity, or tariff-preference slider on a leader. Blair's cooperative
but interventionist combination feeds the existing diplomacy and alliance systems;
allied action remains contextual, not guaranteed. Economic-pressure willingness
uses existing diplomatic reactions. Trump and Bolsonaro receive precisely the
same generic Bully mechanics as existing Bully leaders, including grievances,
Statements, tariff escalation, and affinity. There is no Trump tariff script.
Palme receives no Bully flag or new Statement trigger: outspoken prose and active
cultural diplomacy do not imply that he gains the Bully's absurd Statements.

Explicit Opportunism reacts to sustained, projectable military advantage over a
known rival, taking defensive coalitions, readiness and diplomatic restraint into
account. It loses influence when the opening disappears. This fits Trump and
Putin's requested game identities; it is independent of the covert `opportunist`
preset and of aggression.

## Integration and validation

The canonical roster drives setup choices, nation manifests, Leader Editor,
centralized active-leader lookup, portraits, Audience/Gossip, and identity used by
History/Newspaper. Sparse scenario configuration and saved `leaderSelections`
continue using the existing paths. `ScenarioLoader.parse` returns manager data;
GameScene separately installs the raw scenario's `leaderConfiguration`, as before.
No alternative-selection compatibility fix was necessary.

Tests cover exact USA and expanded existing rosters, unique IDs, valid references,
traits, distinct profiles and defensive strength, every leader's editor
serialization and scenario/save roundtrip, generated catalogs and decoded local
assets. The browser check edits, exports and reopens all fourteen entries in the
real editor. `EPOCH_VERIFY_BUILD=1` enables byte-for-byte production asset checks.

Commands:

```
npm run test:leader-editor
npm run test:impulsive-bully
npm run typecheck
npm run build
EPOCH_VERIFY_BUILD=1 node --import tsx tools/modernAlternativeLeaders.test.ts
EPOCH_EDITOR_URL=http://127.0.0.1:5175 node --import tsx tools/modernAlternativeLeaders.browser.mjs
```

## Identity references

Sources were consulted for names, countries, leadership identities, broad periods,
and visual identity; personality values remain game-design choices.

- Roosevelt: [FDR Presidential Library biography](https://www.fdrlibrary.org/fdr-biography) and [presidency](https://www.fdrlibrary.org/fdr-presidency), 1933–1945.
- Trump: [White House Historical Association](https://www.whitehousehistory.org/bios/donald-j-trump).
- Mao: [Mao Zedong biography](https://en.wikipedia.org/wiki/Mao_Zedong), PRC leadership 1949–1976.
- Macron: [Élysée biography](https://www.elysee.fr/emmanuel-macron).
- Merkel: [Federal Chancellery biography](https://www.bundeskanzler.de/bk-en/federal-chancellery/federal-chancellors-since-1949/angela-merkel-1860738), 2005–2021.
- Modi: [Prime Minister of India biography](https://www.pmindia.gov.in/en/personal-life-story/).
- Putin: [Kremlin presidential biographies](https://kremlin.ru/structure/president/presidents).
- Blair: [UK government history](https://www.gov.uk/government/history/past-prime-ministers/tony-blair), 1997–2007.
- Meloni: [Italian government identity](https://presidenza.governo.it/AmministrazioneTrasparente/Organizzazione/OrganiIndirizzoPolitico/GovernoMeloni/Pres_Meloni.html).
- Bolsonaro: [Brazilian Presidency biography](https://www.biblioteca.presidencia.gov.br/presidencia/ex-presidentes/bolsonaro/biografia/biografia), 2019–2022.
- Sánchez: [La Moncloa biography](https://www.lamoncloa.gob.es/presidente/biografia/Paginas/index.aspx).
- Tusk: [Polish government biography](https://www.gov.pl/web/primeminister/donald-tusk).
- Frederiksen: [Danish Prime Minister's CV](https://stm.dk/statsministeren/cv/).
- Palme: [Palme Foundation biography](https://palmefonden.se/om-olof-palme/), 1969–1976 and 1982–1986.

## Portrait workflow

The built-in image generation tool created original, recognizable painted
illustrations, rather than redistributing source photographs. These are synthetic
illustrations, not documentary photographs. No third-party photograph is bundled,
and no remote runtime image service is used. Historical public-domain photography
was considered; original illustrations were selected to match the existing painted
collection consistently across historical and contemporary subjects.

Portraits ship under `public/assets/sprites/leaders/<hyphenated-name>.png` at
416 × 416, matching the recently added de Gaulle portrait. Audience/Gossip scenes
ship beside them as `<hyphenated-name>-room.webp` at 2048 × 872. Source generations
remain outside the repository; optimized local outputs are the shipped assets.
See `modern-leader-portrait-prompts.json` for the final prompt set and provenance.

[Portrait review sheet](modern-leaders-preview.jpg) shows every portrait at 128px
and in the strip's 77 × 98 oval cover crop. All fourteen were reviewed for likeness,
correct identity, intact heads, legibility, consistent background treatment, and
absence of watermarks/captions. The original portraits have no review-sheet labels.

The 28 shipped images total 6,201,729 bytes (about 5.9 MiB); the largest is
380,804 bytes. Rooms and portraits were checked through browser decoding, and
production assets were compared byte-for-byte with their local source files.
