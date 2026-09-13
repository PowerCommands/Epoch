# Spy and offshore platform animation

Spy fires once every 2.6 seconds: a brief muzzle flame, 0.8 seconds of dissipating smoke and a small synchronized recoil of the connected firing stance. Offshore platforms run a 16-second cycle with counterclockwise crane slew, cable payout and recovery, plus a helicopter approach, touchdown, pause and departure. All animation uses the existing visual clock and honors animation disabling and visibility.

The existing helicopter sprite is reused. The spy rest sprite at `public/assets/sprites/units/spy.png` was generated with built-in image_gen, preserving transparent alpha, using this final prompt:

> A game sprite cutout on transparent background: this same spy aiming a silenced pistol directly toward the player. Black suit, white shirt, black tie, gloved hand extended toward camera, serious face, waist-up view. Keep reference pose and framing. Pistol is at rest with a dark muzzle opening, no muzzle flash and no smoke. Transparent background.

Validation: `node --import tsx tools/offshorePlatformMotion.test.ts` and `EPOCH_URL=http://127.0.0.1:5178 node scripts/visualSpyOffshore.mjs`. The browser check writes cycle snapshots to `/tmp/epoch-spy-offshore` and checks rendered muzzle-flash pixels, platform movement, loop closure, and disabled animation.
