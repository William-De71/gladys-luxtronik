# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for heat pumps with a
**Luxtronik 2.0 / 2.1** controller (Alpha Innotec, Novelan, Siemens, Buderus,
Nibe AP, Roth, Elco, Wolf). A Node.js service (Node 22+, ESM, no build step;
only dependency: the SDK) in its own sandboxed Docker container, talking to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and to the controller **on the local network only** (`transports: ["local"]`),
over its binary socket, TCP port 8889.

A **device integration** (`type: "device"`, Gladys 5.1.0+: widgets and
scenes). The client in `src/luxtronik/` was written from the protocol as
documented by [python-luxtronik](https://github.com/Bouni/python-luxtronik)
and [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (MIT): no code
copied (see NOTICE).

## Commands

```bash
npm install
npm test                                  # node --test, never leaves 127.0.0.1
node --test test/app.test.js              # one file
node --test --test-name-pattern "writes"  # tests whose name matches
UPDATE_BASELINE=1 npm test                # rewrite test/fixtures/discovery.baseline.json (on purpose only)
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check
node scripts/fake-controller.mjs 8889     # the fake controller of the tests, on its own
scripts/check-simulator.sh                # the fake controller against python-luxtronik (venv)
docs/illustrations/render.sh              # widget illustrations (Chrome, ImageMagick, Pillow)
scripts/build-cover.sh                    # cover.jpg from cover.svg (Inkscape, ImageMagick)
```

## Architecture

```
index.js                     SDK wiring only: createApp(gladys) + connect + start
src/app.js                   every handler: discovery, readings, commands, scene events and action, widgets, status
src/hub.js                   the heat pumps: one reading = one session (3003 + 3004), writes read back
src/writes.js                what may be written, bounds and steps, the guard (switch, firmware, spacing, daily quota)
src/devices.js               snapshot -> up to 4 Gladys devices (heatpump, heating, dhw, cooling), values
src/states.js                state publication: created devices only, coalesced, 240/min, 429 pause
src/scenes.js                scene trigger / action keys, event data, filter values
src/widgets.js               the overview, history, energy and log widgets (pure, reused by docs/illustrations)
src/i18n.js                  runtime texts in en / fr / de / es, numbers per language
src/storage.js               JSON files in /data (pumps.json, writes.json)
src/config.js                config_schema -> { hosts, networkSearch, pollMs, allowWrites, language }
src/luxtronik/client.js      TCP client of port 8889: one session per controller at a time, closed cleanly
src/luxtronik/model.js       registers -> snapshot (indexes, scales, codes, sentinels, firmware rules)
src/luxtronik/codes.js       error codes and switch-off reasons in four languages
src/luxtronik/discovery.js   typed addresses, the Alpha Innotec search through Gladys
test/helpers/                the fake controller (a real TCP server, checked against python-luxtronik)
.github/scripts/release.mjs  version, changelog, version files, PR title checks
```

## Rules

- **External ids are forever**: `ext:{selector}:{heatpump|heating|dhw|cooling}:{pump id}`
  (pump id = serial `P874-hex(P875)`, else `addr-<address>`), features
  `…:<key>`. Config, action, field, widget, trigger, variable, output keys and
  the select values (`automatic`…, `heating`, `defrost`…) too.
- **Writes are dangerous**: every parameter written lands in the EEPROM of
  the controller, and a wrong value can stop the heat pump. Never bypass
  `src/writes.js`: off unless `allow_writes`, bounds and steps, never the same
  value, 2 minutes per parameter, 50 a day, never on V1.90 / V2.90. A new
  writable feature needs its entry in `WRITABLE`, a test and a doc line.
- **One session at a time per controller**, closed after use: always go
  through `withSession`. Reading every 30 s at least (`POLL_INTERVALS`).
- **Registers**: indexes, scales and codes live in `src/luxtronik/model.js`
  only; everything after it is °C, W, kWh, hours. Unavailable values
  (0x7FFF / 0x7FFFFFFF) and unwired sensors (0, 5, 75 °C) are `null`.
- **Feature fields** compared by the Discover "Update" (category, type, unit,
  min, max, step, features added or removed): the baseline pins them.
- **Scene events**: one per transition seen between two readings; never fired
  by a command or a scene action; the old errors of the log are not news.
- **The container rootfs is read-only**: the only writable folder is /data.
- **Widget content**: after any change, run `docs/illustrations/render.sh` and
  look at the four images. Budget: 2 texts, 1 focal, 6 tiles, 1 status, 4
  buttons. Tile labels fit about 12 characters.
- **User-facing text** exists in en, fr, de and es: manifest, `src/i18n.js`,
  `src/luxtronik/codes.js`, `docs/*.md`, `README*.md`. `test/i18n.test.js`
  checks it.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, `package-lock.json` or the manifest, nor the `docker_image`
  tag.
- **Changelog**: Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.

## Pitfalls

- Luxtronik 2.0 and 2.1 both answer on port 8889 (firmware V1.x, V2.x, V3.x).
  The WebSocket of the web UI (8214, password, XML) and the Modbus smart home
  interface (502, to activate) are not used.
- Calculations answer `3004, status, length, values`; parameters and
  visibilities `command, length, values` (visibilities are bytes).
- The hot water target is P105 from minor 88.3 on, P2 before
  (`dhwTargetParameter`). P1136-P1139 count 0.01 kWh, C151-C154 0.1 kWh.
- Firmware V1.90.x / V2.90.x crash the controller on any write (BenPru/luxtronik
  #831): `writesUnsafe`.
- The search datagram `2000;111;1;\0` is broadcast by Gladys
  (`udp-active-broadcast`, one scan per 10 s, ports 4444 and 47808) from a
  random port: a controller answering only the source port of the reference
  tools stays silent. The typed address is the reliable way.
- `node --test` also runs the files of `test/helpers/`: they must not start
  anything on import.
- A top-level `const SVG` in `docs/illustrations/render.js` shadows the global
  of ApexCharts (charts render empty): it is `SVG_NS`.
- Gladys does not send the user's language with a scan or a command: feature
  names, text states and scene errors use the `language` setting.
- Never tested on a real heat pump: when a user reports a difference, fix the
  fake controller in `test/helpers/` first (and `scripts/check-simulator.sh`),
  then the code.
