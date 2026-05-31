# Docker

Build and run the playable production version of Epoch as a static web app.

```bash
docker build -t epoch:local .
docker run --rm -p 8080:80 epoch:local
```

Open `http://localhost:8080`.

The image uses a multi-stage build. The builder runs the normal `npm run build`, and the runtime image serves only the generated `dist/` files with nginx. No Vite dev server, Playwright tooling, autorun output, or backend service is included in the runtime image.
