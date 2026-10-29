# Robo Run (Malabar)

A three.js browser game set in Manjeri and Malappuram, Kerala: a delivery story, an auto and a bike you drive, and a 3-lane run.

- Play: open `src/index.html` through any web server (or the GitHub Pages link once enabled).
- Local: `node tools/serve.cjs --port 8080`, then open http://localhost:8080/ (the server serves `src/`)
- Tests: `for f in tests/*.test.js; do node $f; done`
- Build a single folder: `node tools/build.cjs` (writes `dist/`)
- Design notes: `DESIGN - Malabar World.md`. The parked thriller story is in `parked/`.
