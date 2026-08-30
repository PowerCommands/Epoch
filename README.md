# Epoch

Webbläsarbaserat turordningsbaserat strategispel byggt med Phaser 3 + TypeScript + Vite.

## Kom igång

```bash
npm install
npm run dev
```

Öppna sedan `http://localhost:5173` i webbläsaren.

### Övriga kommandon

| Kommando | Beskrivning |
|---|---|
| `npm run build` | Bygg produktionsversion till `dist/` |
| `npm run preview` | Förhandsgranska produktionsbygget lokalt |

### Docker

Produktionsbygget kan köras som en statisk nginx-container:

```bash
docker build -t epoch:local .
docker run --rm -p 8080:80 epoch:local
```

Öppna sedan `http://localhost:8080`. Se även [docs/docker.md](docs/docker.md).

## Teknikstack

- **Phaser 3** — spelmotor
- **TypeScript** (strict mode) — typsäker JavaScript
- **Vite** — build-verktyg och dev-server

## Projektstruktur

```
src/
├── main.ts              # Entry point — initierar Phaser-spelet
├── config/
│   └── gameConfig.ts    # Phaser-konfiguration (storlek, scener, skalning)
├── scenes/
│   ├── BootScene.ts     # Första scenen — laddar assets och vidarebefordrar till MainMenu
│   ├── MainMenuScene.ts # Startskärm med titel och "Start Game"-knapp
│   └── GameScene.ts     # Huvudspelscen (platshållare för kommande mekanik)
├── systems/             # Framtida system: turn manager, resource system m.m.
├── entities/            # Framtida entiteter: enheter, byggnader m.m.
└── types/
    └── index.ts         # Delade TypeScript-typer
```

## Publish Docker container with Dockube 

```bash
build https://github.com/PowerCommands/Epoch.git "epoch" --publish --platform=linux/amd64
```

## Autorun test example
```bash
npx tsx tools/autorun-series.ts --scenario map_world --max-turns 1300 --block-size 100 --timeout-ms 10800000 --output autorun-output/naval-improved-test
```