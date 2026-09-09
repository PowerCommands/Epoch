# Middle Eastern nations

Six nations and seven leaders use the existing registries, editor, configuration and save selection systems. Egypt defaults to Cleopatra VII; el-Sisi is an alternative. Leader titles describe the requested game identities, not a live officeholder roster. Dialogue is original game writing, not attributed quotations.

All six audio aliases resolve to both original files in `nations_middle_east`. The optional `audioPlaylistId` accepts any existing playlist key; `audioPlaylistNationId` remains supported for older definitions. Missing aliases fail manifest generation. No tracks are copied.

Khomeini uses Traditionalism, Homeland Defense, Religious Militia and Fanatic with high endurance and low aggression. Saddam uses Militarism, Military Power, Military Mobilization and Paranoid, with military opportunism and Impulsive Bully. Cleopatra combines Globalism, Culture, Cultural Defense and Schemer; opportunism provides a conditional military opening despite low normal aggression. El-Sisi combines Conservatism, Homeland Defense and Imperial Combined Arms. Netanyahu uses Conservatism, Homeland Defense, Elite Army and Schemer, with a four-city voluntary cap and military opportunism disabled to avoid indiscriminate attacks on weak neighbors. Threat-driven declarations remain available. Erdoğan combines Nationalism, Economic, Prestige Projection and Opportunist. Mohammed bin Salman combines Conservatism, Economic, Prestige Projection and Merchant, with low war endurance and maximum exploitation interest.

Existing era profiles carry forward from ancient onward: Defensive Builder for Khomeini, el-Sisi and Netanyahu; Military Preparation for Saddam; Cultural Dominance for Cleopatra; Balanced Growth for Erdoğan and Mohammed bin Salman. These are weights, not promises of behavior. Defensive Builder itself favors embassies; Khomeini’s negative diplomacy and Traditionalism temper that openness. Science and modernization for Israel come from existing research, economy, doctrine and infrastructure behavior. No new profile or country-specific AI logic is introduced.

Games preferences are authored game flavor, not claims about personal sporting interests. City lists provide 20 unique names per nation. Nation identity visuals follow the existing two-color and portrait conventions; the engine has no required separate nation flag assets.

## Historical and visual references

- [Khomeini, Encyclopaedia Iranica](https://www.iranicaonline.org/articles/khomeini/)
- [Saddam Hussein](https://en.wikipedia.org/wiki/Saddam_Hussein)
- [Abdel Fattah el-Sisi](https://en.wikipedia.org/wiki/Abdel_Fattah_el-Sisi)
- [Cleopatra VII coin portrait, British Museum](https://www.britishmuseum.org/collection/object/C_1844-0425-99)
- [Regional diplomacy and economic agreements in 2022](https://www.axios.com/2022/06/22/mbs-erdogan-turkey-egypt-jordan-visit-khashoggi)

Portraits are generated painted interpretations of recognizable public likenesses. Cleopatra is an explicitly historical reconstruction inspired by ancient coin portrait features, never an authentic photograph. Assets use the built-in imagegen tool; prompts are recorded in the accompanying JSON. Final portraits and rooms reside in `public/assets/sprites/leaders/`, using each leader’s hyphenated name, `.png` and `-room.webp` respectively.

## Validation

- `npm run typecheck`: passed.
- `npm run test:leader-editor`: 77 passed, including the nine new Middle Eastern content tests.
- Focused nation, modern alternative, multiple leader, leader configuration and opportunism suites: 74 passed.
- `node --import tsx tools/middleEasternNations.browser.mjs` against local Vite: passed. Exercises all six editor nations, start placement/export, all seven Leader Editor entries, Egypt’s explicit alternative export/import, setup dropdown selection, portrait/room decoding and both actual audio tracks plus playlist looping for every nation.
- `npm run build`: passed; Vite retains the existing large-bundle warning.
- `EPOCH_VERIFY_BUILD=1 node --import tsx tools/middleEasternNations.test.ts`: nine passed, including byte-for-byte production asset checks.
- Broader checks found two existing failures, reproduced with unchanged HEAD source in a temporary copy: `aiWarDeclarationDialogue.test.ts` expects custom catalog entries for the fourteen existing modern alternatives, which currently use fallback dialogue; `sovietUnion.test.ts` expects Russia’s roster to contain only Ivan IV despite the existing Putin alternative. Neither failure concerns the new leaders; all seven have explicit contextual declarations. Existing tests and unrelated content were left unchanged.

The seven portraits and seven audience rooms were visually reviewed after generation. PNGs are 416×416; WebP rooms are 2048×872. The existing Middle Eastern audio files were already present as untracked user assets and remain in their original folder, with no copies or modifications.
