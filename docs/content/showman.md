# Showman and Boris Johnson

`LeaderDefinition.showman` is an optional boolean. Missing values mean false; scenario overrides and the Leader Editor preserve explicit true and false. It is independent of Opportunism and Impulsive Bully. No save migration is required: selection and configuration use the existing save fields, and speech cooldowns/recent content use `leaderStatements`.

Boris Johnson is a non-default English alternative with Opportunism + Showman, the economic agenda, Prestige Projection doctrine and opportunist covert profile. Existing national defaults are unchanged.

The existing `LeaderStatementSystem` supplies the public behavior:

- AI turns attempt a general Showman statement every four rounds with 30% probability.
- Supported timeline events attempt a relevant statement with 35% probability per involved Showman nation. There is no delayed queue of stale achievements.
- Every source shares the existing eight-round speaker cooldown and six-line repetition memory. Even a burst of achievements cannot bypass this bound.
- Ordinary leaders receive no new periodic statements and cannot select the Showman pool.
- The 44 original reusable statements use the `theatrical` tone, which has no diplomatic memory effects and does not trigger bully endorsement behavior. The trait never participates in strategic scoring.
- Newspaper priority remains the existing statement priority (45). The existing visibility and newspaper selection rules apply.

Contexts cover general speeches, economic success/difficulty, diplomatic achievements, alliances, peace, founding cities, wonders, Games gold, capturing/losing cities, and recovery. Economic difficulty/recovery require explicit crisis started/ended metadata. City capture roles use structured aggressor/target metadata. No Leadership Events framework is introduced.

## Validation

`npm run test:showman` covers traits, overrides, editor configuration, leader selection, scenario/save compatibility, content, shared cooldowns, restore, event contexts, and existing bully/opportunism/newspaper behavior. The modern alternative tests also validate canonical culture/sports/profile IDs and asset dimensions. Browser workflows in `tools/leaderEditor.browser.mjs` and `tools/modernAlternativeLeaders.browser.mjs` cover editing, export/reopen, selection and PNG/WebP decoding.

Production build and the above tests passed. The broader `aiWarDeclarationDialogue.test.ts` catalog-completeness assertion fails because the original 14 modern alternatives lack leader-specific entries; Boris has two original lines for each of the five reasons. That unrelated catalog gap remains unchanged.

## Generated art

Created with the built-in image generation tool, inspected visually, and exported to existing asset conventions:

- `public/assets/sprites/leaders/boris-johnson.png`: 416 × 416 opaque PNG portrait.
- `public/assets/sprites/leaders/boris-johnson-room.webp`: 2048 × 872 WebP audience backdrop.

Portrait prompt:

> Use case: stylized-concept. Create a square strategy game leader portrait of Boris Johnson, recognizable tousled pale blond hair, confident lively expression, navy suit white shirt blue tie. Classical realistic oil-painted bust portrait, head and shoulders fill square frame, three quarter torso facing right, face toward viewer, warm dark olive brown textured painted background, soft warm directional light, detailed painterly skin and cloth, dignified national leader rather than caricature. Match the Epoch portrait convention: full opaque background, no frame, no text, no symbols, no watermark. Square PNG.

Audience backdrop prompt:

> Use case: stylized-concept. Epoch strategy game diplomacy room background. Wide landscape 2048x872 composition. Boris Johnson with recognizable tousled pale blond hair and confident lively expression, navy suit white shirt blue tie, seated full body in brown leather armchair on right third of image in a dignified British prime minister's wood panelled office. Warm fireplace, books, understated British flag and Westminster through window on far right. Left half dark quiet room with open visual space for dialogue UI. Realistic classical oil-painted style, cinematic warm subdued light, detailed skin wood and fabric. No text, no UI, no watermark, opaque background.
