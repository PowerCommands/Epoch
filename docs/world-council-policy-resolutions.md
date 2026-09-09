# UN policy resolutions

The Nuclear Non-Proliferation Treaty, Climate Accord and UN Peacekeeping Mission retain their UN-only definitions, Influence voting and canonical enacted-resolution persistence.

- The nuclear treaty prohibits only new Atomic Bombs and Nuclear Missiles. Existing weapons and nuclear energy are unaffected.
- The Climate Accord prohibits new Coal and Oil Power Plants. Existing plants keep their normal operation and lifespan. Each covered member receives exactly +5 national Happiness while it has no operational Coal/Oil plants. The benefit is derived from current plant allocation, including fuel availability and damage, and never stored as a permanent reward.
- Peacekeeping protects the proposing member against a named threat for 30 turns. AI nations separately evaluate participation and may pledge up to two eligible land combat units outside city garrisons. Human players explicitly select units in the session result or the active-resolution card; declining has no effect on their vote. Human units are moved using normal commands. AI contingents use normal pathfinding to deploy near protected cities and engage incursions. Units retain national ownership, upkeep and ordinary combat statistics.

Only pledged units receive mission access. Their offensive actions are restricted to the named threat inside the protected member's territory, during legally active host–threat combat; a ceasefire blocks intervention. They cannot capture cities or pursue unrelated wars. Mission access and assignments are derived from the active mandate and stop on expiry or repeal, without modifying independent open-border agreements or declaring national wars. Units are not teleported at expiry; ordinary national movement and foreign-troop rules resume.

Production prohibitions are enforced at enqueue, replacement, purchase/completion and turn processing. Activation cancels only prohibited queue entries using normal removal notifications. Inherited/restored queues are checked again before progress. Other entries keep their accumulated production and placement. Repeal restores eligibility immediately, subject to ordinary requirements.

Save data adds optional `peacekeepingContributions` (nation IDs and unit IDs) to enacted resolutions. Targets, participation, expiration and repeal continue using existing fields. Missing contributions in older saves do not authorize entire armies. No additional climate or nuclear save state is needed.

Focused verification: `node --import tsx tools/worldCouncilPolicyResolutions.test.ts`.
