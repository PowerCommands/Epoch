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
