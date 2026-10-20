// Run the fake Luxtronik controller of the tests on its own, to try the
// integration (or python-luxtronik, scripts/check-simulator.sh) without a
// heat pump: `node scripts/fake-controller.mjs [port] [address]`.
import { FakeLuxtronik } from '../test/helpers/fake-luxtronik.js';

const port = Number(process.argv[2] ?? 8889);
const fake = await new FakeLuxtronik().listen(port, process.argv[3] ?? '127.0.0.1');
console.log(`Fake Luxtronik controller on ${fake.host}:${fake.port} (Ctrl+C to stop)`);
