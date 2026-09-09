# Renewable energy and environmental Happiness

Renewables are map-placed Buildings using the existing city Population Capacity calculation, national Gold accounting, and national Happiness. They do not multiply production. No derived capacity, maintenance, or environmental totals are saved.

| Building | Technology | Terrain | Capacity | Gold/turn |
| --- | --- | --- | ---: | ---: |
| Wind Turbine | Electricity | Plains, Meadow, Beach | +1 | 1 |
| Solar Panels | Electronics | Plains, Meadow, Beach | +1 | 1 |
| Offshore Wind Farm | Ecology | Coast, Ocean | +3 | 2 |
| CSP – Concentrated Solar Power | Lasers | Desert | +3 | 2 |

Choose an installation from city Building production, then select an eligible owned tile. Offshore Wind Farms use the Building system's water placement. Installations require an empty tile without another building, improvement, or natural resource and cannot occupy the city center. Their production cost is 45, matching the former Worker production investment; construction now follows city production speed.

Capacity stacks across the city's owned tiles, including multiple installations of the same type, without requiring citizens to work them. Broken buildings, invalid terrain, removal, ownership changes, or a conflicting resource/improvement remove the contribution. Upkeep follows territorial ownership and is charged even when the tile is unworked. It remains a fixed cost outside the Happiness Gold multiplier. Repair restores a damaged installation's effects independently of other installations.

Active Coal/Oil/Gas plants cause -5/-3/-1 national Happiness each. Inactive plants, Nuclear, Hydro, and renewables have no pollution penalty. Each currently owned Nuclear Waste tile causes -5 Happiness until cleaned, irrespective of its source. Neutral contamination has no national penalty. Values are centralized in `src/data/environment.ts`; renewable values are in `src/data/buildings.ts`.

AI uses existing city capacity Building production planning, shared terrain placement, and renewable upkeep affordability checks. Plant planning weighs fossil pollution more heavily when national Happiness is negative, while retaining existing reasons for plant replacement.

Older saves convert completed renewable Improvements into Buildings on their existing tiles. Partial construction moves into the owning city's production queue with its completed fraction preserved; Workers are released with their remaining charges. New saves store Buildings and their production reservations normally.

The legacy `solar_plant` definition, sprite, and existing save effects remain resolvable. It is removed from normal production lists and technology unlocks. Climate Accord and Nuclear Plant lifecycle rules remain independent.

Run `npm run test:renewables` for focused runtime coverage. Additional regression suites cover city energy, plants, nuclear maintenance/weapons, Worker construction, underwater archaeology, exploitation ownership, and World Council policy resolutions.

## Artwork provenance

Four distinct transparent PNG assets were generated with the built-in imagegen tool and now stored under `public/assets/sprites/buildings/`: `wind_turbine.png`, `solar_panels.png`, `offshore_wind_farm.png`, and `csp.png`. Their alpha channels were verified and their artwork visually inspected. The existing Building sprite pipeline loads them.

Each image used this prompt, substituting the subject and filename below:

> Use case: stylized-concept. Asset: Epoch isometric strategy-game map sprite. Subject: [subject]. Detailed realistic miniature pixel-art-like painted 3D render matching classic Civilization map improvements, crisp metallic details, elevated isometric view, entire structure centered and uncropped with margin. Transparent background with actual alpha, no text, no border, no ground tile except tiny foundations. Recognizable silhouette at small map zoom. Save as [filename].png.

- `wind_turbine`: One land wind turbine, three long white blades on a tall steel tower with small service foundation
- `solar_panels`: Three low tilted rows of dark blue photovoltaic solar panels on metal frames
- `offshore_wind_farm`: Three offshore wind turbines on yellow marine jacket foundations connected by service catwalks, visible submerged support legs, small teal water ripples around foundations
- `csp`: Concentrated solar power installation, tall central solar receiver tower with glowing amber receiver surrounded by a radial field of many silver tilted heliostat mirrors, sandy foundation
