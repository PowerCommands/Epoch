# Renewable energy and environmental Happiness

Renewables use completed tile improvements, the existing city Population Capacity calculation, national Gold accounting, and national Happiness. They do not multiply production. No derived capacity, maintenance, or environmental totals are saved.

| Improvement | Technology | Terrain | Capacity | Gold/turn |
| --- | --- | --- | ---: | ---: |
| Wind Turbine | Electricity | Plains, Meadow, Beach | +1 | 1 |
| Solar Panels | Electronics | Plains, Meadow, Beach | +1 | 1 |
| Offshore Wind Farm | Ecology | Coast, Ocean | +3 | 2 |
| CSP – Concentrated Solar Power | Lasers | Desert | +3 | 2 |

Select **Choose Improvement** in the Worker toolbox to cycle suitable installations, then use the named **Build** action. Locked choices explain their required technology. Offshore construction requires a Worker aboard a Transport Ship; select the ship over an owned, city-associated water tile. Installations require an empty tile without another building, improvement, or natural resource. Construction uses the normal multi-turn Worker system.

Capacity stacks across the city's owned tiles and does not require citizens to work them. Invalid terrain, removal, ownership changes, or a conflicting building/resource remove the contribution. Upkeep follows the canonical improvement economic owner, including legacy ownership fallback, and is charged even when the tile is unworked. It is a fixed cost outside the Happiness Gold multiplier.

Active Coal/Oil/Gas plants cause -5/-3/-1 national Happiness each. Inactive plants, Nuclear, Hydro, and renewables have no pollution penalty. Each currently owned Nuclear Waste tile causes -5 Happiness until cleaned, irrespective of its source. Neutral contamination has no national penalty. Values are centralized in `src/data/environment.ts`; renewable values are in `src/data/improvements.ts`.

AI considers city capacity pressure, pending renewable capacity and upkeep, treasury reserves, positive income, distance, and economic strategy preference. It preserves natural resources and reuses nearby available Workers and Transport Ships for offshore installations. Plant planning weighs fossil pollution more heavily when national Happiness is negative, while retaining existing reasons for plant replacement.

The legacy `solar_plant` definition, sprite, and existing save effects remain resolvable. It is removed from normal production lists and technology unlocks. Climate Accord and Nuclear Plant lifecycle rules remain independent.

Run `npm run test:renewables` for focused runtime coverage. Additional regression suites cover city energy, plants, nuclear maintenance/weapons, Worker construction, underwater archaeology, exploitation ownership, and World Council policy resolutions.

## Artwork provenance

Four distinct transparent PNG assets were generated with the built-in imagegen tool and saved under `public/assets/sprites/improvements/`: `wind_turbine.png`, `solar_panels.png`, `offshore_wind_farm.png`, and `csp.png`. Their alpha channels were verified and their artwork visually inspected. BootScene loads them through the existing improvement sprite pipeline.

Each image used this prompt, substituting the subject and filename below:

> Use case: stylized-concept. Asset: Epoch isometric strategy-game map sprite. Subject: [subject]. Detailed realistic miniature pixel-art-like painted 3D render matching classic Civilization map improvements, crisp metallic details, elevated isometric view, entire structure centered and uncropped with margin. Transparent background with actual alpha, no text, no border, no ground tile except tiny foundations. Recognizable silhouette at small map zoom. Save as [filename].png.

- `wind_turbine`: One land wind turbine, three long white blades on a tall steel tower with small service foundation
- `solar_panels`: Three low tilted rows of dark blue photovoltaic solar panels on metal frames
- `offshore_wind_farm`: Three offshore wind turbines on yellow marine jacket foundations connected by service catwalks, visible submerged support legs, small teal water ripples around foundations
- `csp`: Concentrated solar power installation, tall central solar receiver tower with glowing amber receiver surrounded by a radial field of many silver tilted heliostat mirrors, sandy foundation
