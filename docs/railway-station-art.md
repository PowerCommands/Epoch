# Railway Station artwork

Generated with the built-in imagegen tool using `factory.png` as the style reference. The transparent outputs were resized to 256 × 256 with Canvas, preserving alpha.

Assets: `public/assets/sprites/buildings/railway_station.png` and `railway_station-broken.png`.

## Station prompt

Use case: stylized-concept. Create a transparent PNG building sprite for Epoch strategy game, matching the attached factory reference's clean softly shaded low-poly painted architecture, cream masonry edges, muted palette and elevated game camera. Subject: Industrial-era railway station, red brick and cream trim, dark slate roof, central clock gable, long platform canopy. Square composition with generous transparent margins. Station occupies x .20-.80, y .22-.65. Critical: a single straight railway track runs perfectly HORIZONTALLY left to right across the foreground, from x .04 to .96, with rails at y .74 and .79, sleepers under them; no diagonal tracks. View building front with some roof visible, camera aligned to track. Track and platform completely unobstructed for a separately animated locomotive. No train, no smoke, no people, no text, no background, no ground tile outside narrow station foundation and track ballast. Station itself stable and fully visible. Actual transparent alpha background.

## Damaged variant prompt

Edit this railway station sprite to its damaged/broken state for the game. Preserve exact image dimensions, framing, station position, track positions, transparent alpha background and artwork style. Add a few broken roof patches and darkened damaged brickwork, boarded windows. Keep the station recognizable and the rails unchanged. No fire, smoke, people or trains. Actual transparent background.

## Rendering

The generated foreground rail sits at normalized y=.689; the locomotive wheel contact uses that measured coordinate. The building activity uses the existing ambient Graphics layer. Its 24-second clock includes six seconds of arrival, four seconds stationary, six seconds of departure and eight seconds with no train. The per-building seed offsets arrivals. No animation state enters saves.

Run `node scripts/visualRailwayStation.mjs` with Vite on port 5174 for browser assertions and screenshots in `/tmp/epoch-railway`.
