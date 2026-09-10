# Diplomatic requests and settlement promises

`DiplomaticAffairSystem` owns bilateral requests, cooldowns, responses and promise outcomes. GameScene connects founding, rounds, diplomacy memory, treasury transfers, the timeline and HUD. Human actions are in the leader audience under **Requests & promises**. AI nations use the same request and response paths.

## Settlement complaints

- A newly founded non-capital city within **6 grid tiles** of an existing foreign city creates a potential complaint. Initial scenario cities and loading do not generate incidents.
- Requires living nations, prior contact and peace. Humans can complain about a **known** city founded in the last **10 rounds**. AI observes nearby frontier founding. Ownership is rechecked before sending and resolving a request.
- The complainant offers three responses: promise **20 rounds** without new settlement in the affected area; decline (**trust -2, hostility +4**); or pay **50 gold** to settle that incident (**hostility -2**, no promise).
- The area is frozen around the complainant's affected city coordinates at founding. Later cities do not enlarge it. Existing cities are unaffected. The radius includes its boundary.
- A kept promise awards **trust +5, hostility -3** once. A new city in that area before the deadline breaks it: **trust -15, hostility +12** once. Both outcomes appear in the timeline and a queued human follow-up.
- AI settlement selection and founding respect promises. Temporary exclusions do not erase scout settlement memory. Humans retain the choice to break their promises.
- There is a **20-round directional cooldown** per request type, plus suppression while a promise remains active. A single incident cannot be complained about twice. Unanswered requests expire after **5 rounds**, without a penalty. War or elimination cancels outstanding requests/promises without a reward.
- Existing BorderPressureSystem retains ownership of recurring geographic pressure; simply lodging a complaint adds no extra proximity penalty.

## Money requests

Four humorous lines ask to “borrow” money; the confirmation explicitly describes a permanent transfer with **no repayment obligation**. The amount is **25–100 gold**, based on the requester's treasury. Acceptance gives **trust +3**; refusal has no relationship penalty. Funds are rechecked at response time and duplicate responses cannot transfer twice.

Humans can request money in an audience. An AI donor considers trust, hostility, leader diplomacy bias and its reserves. Unsolicited AI requests require a treasury below **50**, a contacted peaceful partner with at least **150**, and sufficient trust. At most one such request is initiated globally per **10 rounds**; it cannot stack on a pending affair to that recipient. The directional 20-round cooldown also applies.

## Persistence and presentation

Affairs, incident geometry, deadlines, content variants and cooldowns are saved in optional `diplomaticAffairs`. Older saves start empty. Restoring pending human requests rebuilds their dialog queue without replaying money, relationship changes or history. Autoplay resolves pending human-seat requests using the AI response rules. Private affair events are visible to the two participants and do not become global newspaper articles.

The existing proposal dialog gains an optional third response. The affair system owns these requests independently of the legacy DiplomaticProposalSystem and uses `affair_` identifiers. HUD response callbacks allow an affordability failure to keep the dialog open. When resolution itself advances the queue, the callback must not dismiss the next proposal.

## Verification

- `node --import tsx tools/diplomaticAffairs.test.ts`
- `node --import tsx tools/foundCityId.test.ts`
- `node --import tsx tools/aiExpansionCooldown.test.ts`
- `node --import tsx tools/aiManufacturedResourceTrade.test.ts`
- `node --import tsx tools/newspaperSystem.test.ts`
- `npm run build`
- With Vite running: `node tools/diplomaticAffairs.browser.mjs <built-in-map-save.json> <local-url>`. Uses a cloned fixture, real GameScene save restoration, actual Phaser pointer clicks and audience actions. Does not modify the input save.

Potential later request types include temporary military restraint and help against a shared threat. They should have explicit, observable fulfillment rules before being added.
