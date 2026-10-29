# Robo Run (Malabar)

A three.js browser game set in Manjeri and Malappuram, Kerala. Run the classic 3-lane track, or walk the town: take parcels on a bike, carry passengers in an auto, play football on the turf, buy lunch, and follow the CHAYA EXPRESS delivery story. It is plain script files and runs on a phone (made for 360x740 touch) or a computer.

## Play

- **On a computer or phone:** serve the folder and open it (see Run below). Everything runs in the browser; progress is kept in the browser's own storage.
- **On GitHub:** the root `index.html` sends visitors to `src/index.html`, so GitHub Pages can host it (Settings, Pages, deploy from branch `main`, folder `/ (root)`). Pages is not switched on yet.

### Controls

| | Computer | Phone |
|---|---|---|
| Walk | WASD or arrow keys | the stick on the left |
| Run | Shift | the runner button, right side (tap to turn running on or off) |
| Look around | Q / E, or drag | drag the screen |
| Use / talk / get in / shoot | F | the big action button (it names what it does) |
| Horn (on a bike or auto) | the bell button | the bell button |
| Leave a room or area | Esc | the back arrow, top left |

### What there is to do

- **Delivery desk (Manjeri highway, south of the junction):** take a parcel on the bike, or a passenger in an auto. The map shows the way and each job pays a fare.
- **The story:** talk to Sreeja at the Chaya Express desk. Four days: parcels, a little shuttle, a bus to Malappuram.
- **Football turf (south end):** walk into the ball to dribble, press SHOOT, first to five goals wins. Goals pay a little money.
- **Shops and food:** Hotel Farsa, Hotel Oottupura, Vanitha Mess, Budget Hyper Market, Hotel Zindagi, Al Rayadhan and more. Some can be entered.
- **Towns:** Manjeri and Malappuram are open. The Wayanad road, the beach, the city and HiLITE are built but switched off for now (`window.ROBO_ACTIVE_AREAS` in `src/index.html`).

## Run

- Local server: `node tools/serve.cjs --port 8080`, then open http://localhost:8080/ (the server serves `src/`). Add `--host 0.0.0.0` to try it on a phone on the same Wi-Fi.
- Tests: `for f in tests/*.test.js; do node $f; done` (26 suites, no dependencies).
- Build a single folder to host: `node tools/build.cjs` (writes `dist/`), then `node tools/serve.cjs --dist` to try it.
- Design notes and decisions: `DESIGN - Malabar World.md`. The parked thriller story is in `parked/`.

## Notes

- All story people and companies are made up. "Zilla Money" is a parody with its own name, logo and colours, not the real brand.
- Real places are used only where a public source (such as Google Maps) confirms them. Political parties are neutral. The 2024 Wayanad landslide, alcohol, drugs and gambling are left out.
- With Quality on Auto, the town lowers its sharpness by itself if it runs slowly (a "Smoother mode" card appears); picking a quality in Settings resets that.
- Malayalam text is partly machine-written and needs a native reader to check.
