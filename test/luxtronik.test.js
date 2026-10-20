// The Luxtronik protocol: the socket client against the fake controller, the
// decoding of the registers, the discovery helpers and the write guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { COMMANDS, LuxtronikError, withSession } from '../src/luxtronik/client.js';
import { ERROR_CODES, errorText, SWITCH_OFF_CODES, switchOffText } from '../src/luxtronik/codes.js';
import {
  parseHosts,
  parseSearchReply,
  SEARCH_PAYLOAD,
  SEARCH_PORTS,
  searchNetwork,
} from '../src/luxtronik/discovery.js';
import {
  dhwTargetParameter,
  firmwareOf,
  readSnapshot,
  serialOf,
  writesUnsafe,
} from '../src/luxtronik/model.js';
import { memoryStorage } from '../src/storage.js';
import { createWriteGuard, DAILY_MAX, rawWrite, WriteRefused } from '../src/writes.js';
import { defaultRegisters, fakeClock, startFake, TIMINGS } from './helpers.js';

const OPTIONS = { timeoutMs: TIMINGS.timeoutMs, gapMs: TIMINGS.gapMs };

test('client: parameters, calculations and visibilities, even in small TCP pieces', async () => {
  const fake = await startFake({ chunk: 5 });
  try {
    const result = await withSession(
      fake.host,
      fake.port,
      async (session) => ({
        parameters: await session.readParameters(),
        calculations: await session.readCalculations(),
        visibilities: await session.readVisibilities(),
      }),
      OPTIONS,
    );
    assert.deepEqual(result.parameters, fake.parameters);
    assert.deepEqual(result.calculations, fake.calculations);
    assert.equal(result.visibilities.length, fake.registers.visibilities.length);
    assert.deepEqual(fake.commands, [
      COMMANDS.READ_PARAMETERS,
      COMMANDS.READ_CALCULATIONS,
      COMMANDS.READ_VISIBILITIES,
    ]);
    assert.equal(fake.open, 0, 'the socket is closed after the session');
  } finally {
    await fake.close();
  }
});

test('client: negative values, a write echoed', async () => {
  const fake = await startFake();
  fake.parameters[1] = -25;
  try {
    const echoed = await withSession(
      fake.host,
      fake.port,
      async (session) => {
        assert.equal((await session.readParameters())[1], -25);
        return session.writeParameter(1, -10);
      },
      OPTIONS,
    );
    assert.equal(echoed, -10);
    assert.deepEqual(fake.writes, [{ index: 1, value: -10 }]);
    assert.equal(fake.parameters[1], -10);
  } finally {
    await fake.close();
  }
});

test('client: one session at a time per controller, even when asked together', async () => {
  const fake = await startFake({ chunk: 64 });
  try {
    const read = () =>
      withSession(fake.host, fake.port, (session) => session.readCalculations(), OPTIONS);
    await Promise.all([read(), read(), read(), read()]);
    assert.equal(fake.connections, 4);
    assert.equal(fake.maxOpen, 1);
  } finally {
    await fake.close();
  }
});

test('client: a silent controller times out, a refused one fails, a wrong answer is caught', async () => {
  const silent = await startFake({ silent: true });
  try {
    await assert.rejects(
      withSession(silent.host, silent.port, (session) => session.readParameters(), {
        ...OPTIONS,
        timeoutMs: 150,
      }),
      (error) => error instanceof LuxtronikError && error.kind === 'network',
    );
  } finally {
    await silent.close();
  }
  const port = silent.port;
  await assert.rejects(
    withSession('127.0.0.1', port, (session) => session.readParameters(), OPTIONS),
    (error) => error instanceof LuxtronikError && error.kind === 'network',
  );
  // A server that answers something else than the command.
  const liar = net.createServer((socket) => {
    socket.on('data', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeInt32BE(42, 0);
      socket.write(buffer);
    });
  });
  await new Promise((resolve) => liar.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(
      withSession('127.0.0.1', liar.address().port, (session) => session.readParameters(), OPTIONS),
      (error) => error instanceof LuxtronikError && error.kind === 'protocol',
    );
  } finally {
    await new Promise((resolve) => liar.close(resolve));
  }
  await assert.rejects(
    withSession('127.0.0.1', port, (session) => session.writeParameter(1, 1.5), OPTIONS),
  );
});

test('model: the snapshot of the default controller', () => {
  const { parameters, calculations } = defaultRegisters();
  const snapshot = readSnapshot(parameters, calculations);
  assert.deepEqual(snapshot.firmware, { text: 'V3.90.1', series: 3, minor: [90, 1] });
  assert.equal(snapshot.serial, '2203-e9a');
  assert.deepEqual(snapshot.capabilities, {
    dhw: true,
    cooling: false,
    room: false,
    powerInput: true,
    heatOutput: true,
    energyInput: true,
    heatMeter: true,
  });
  assert.equal(snapshot.temperatures.outdoor, 4.2);
  assert.equal(snapshot.temperatures.room, null, 'an unwired sensor is not a measurement');
  assert.equal(snapshot.mode, 'heating');
  assert.equal(snapshot.status, 'heating');
  assert.equal(snapshot.energyInput, 4444.43, 'P1136-P1139 count 0.01 kWh');
  assert.equal(snapshot.heatProduced, 15802.3, 'C154 counts 0.1 kWh');
  assert.equal(snapshot.compressorHours, 3429.36);
  assert.equal(snapshot.settings.dhwTarget, 48);
  assert.equal(snapshot.settings.heatingOffset, 1);
  assert.deepEqual(
    snapshot.errors.map((error) => error.code),
    [717, 715],
  );
  assert.deepEqual(
    snapshot.switchOffs.map((entry) => entry.code),
    [9, 5, 3],
  );
});

test('model: "not available" values, negative temperatures, cooling, room unit', () => {
  const { parameters, calculations } = defaultRegisters();
  calculations[15] = -123;
  calculations[268] = 0x7fffffff;
  calculations[10] = 0x7fff;
  calculations[227] = 214;
  parameters[42] = 4; // mixing circuit 1: heating and cooling
  const snapshot = readSnapshot(parameters, calculations);
  assert.equal(snapshot.temperatures.outdoor, -12.3);
  assert.equal(snapshot.temperatures.flow, null);
  assert.equal(snapshot.capabilities.powerInput, false);
  assert.equal(snapshot.powerInput, null);
  assert.equal(snapshot.capabilities.cooling, true);
  assert.equal(snapshot.capabilities.room, true);
  assert.equal(snapshot.temperatures.room, 21.4);
  // A short controller (old firmware): no counters past its end.
  const short = readSnapshot(parameters.slice(0, 800), calculations.slice(0, 200));
  assert.equal(short.capabilities.energyInput, false);
  assert.equal(short.capabilities.heatOutput, false);
  assert.equal(short.serial, null);
});

test('model: firmware rules (hot water register, unsafe writes), serial number', () => {
  const firmware = (text) => {
    const calculations = new Array(100).fill(0);
    [...text].forEach((character, index) => {
      calculations[81 + index] = character.charCodeAt(0);
    });
    return firmwareOf(calculations);
  };
  assert.equal(dhwTargetParameter(firmware('V3.88.3')), 105);
  assert.equal(dhwTargetParameter(firmware('V3.90.1')), 105);
  assert.equal(dhwTargetParameter(firmware('V3.88.2')), 2);
  assert.equal(dhwTargetParameter(firmware('V1.79')), 2);
  assert.equal(dhwTargetParameter(firmware('')), 2);
  assert.equal(writesUnsafe(firmware('V1.90.0')), true);
  assert.equal(writesUnsafe(firmware('V2.90.3')), true);
  assert.equal(writesUnsafe(firmware('V3.90.1')), false);
  assert.equal(writesUnsafe(firmware('V2.88.3')), false);
  const parameters = new Array(900).fill(0);
  assert.equal(serialOf(parameters), null);
  parameters[874] = 2103;
  parameters[875] = 255;
  assert.equal(serialOf(parameters), '2103-ff');
});

test('codes: four languages, a fallback for unknown codes', () => {
  for (const message of [...Object.values(ERROR_CODES), ...Object.values(SWITCH_OFF_CODES)]) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      assert.ok(message[language]?.length > 0);
      assert.ok(message[language].length <= 54, message[language]);
    }
  }
  assert.equal(errorText(717).fr, 'Débit');
  assert.equal(errorText(999).de, 'Fehler 999');
  assert.equal(switchOffText(3).en, 'Grid operator lock');
  assert.equal(switchOffText(99).es, 'Motivo 99');
});

test('discovery: typed addresses, search replies', () => {
  assert.deepEqual(
    parseHosts('192.168.1.20, wp-novelan:8888 ; 192.168.1.20 bad_host 300.1.1.1 :1'),
    [
      { host: '192.168.1.20', port: 8889 },
      { host: 'wp-novelan', port: 8888 },
    ],
  );
  assert.deepEqual(parseHosts(''), []);
  assert.deepEqual(parseSearchReply(Buffer.from('2500;111;8889;0;'), '192.168.1.20'), {
    host: '192.168.1.20',
    port: 8889,
  });
  assert.deepEqual(parseSearchReply(Buffer.from('2500;111;;'), '192.168.1.20'), {
    host: '192.168.1.20',
    port: 8889,
  });
  assert.equal(parseSearchReply(SEARCH_PAYLOAD, '192.168.1.2'), null, 'our own datagram');
  assert.equal(parseSearchReply(Buffer.from('2500;111;8889;'), 'fe80::1'), null);
  assert.equal(SEARCH_PAYLOAD.toString('latin1'), '2000;111;1;\u0000');
});

test('discovery: the search goes through Gladys on both ports; refused is said', async () => {
  const reply = (port) => Buffer.from(`2500;111;${port};`).toString('base64');
  const gladys = createFakeGladys({
    scanResults: {
      'udp-active-broadcast': [
        { source_ip: '192.168.1.20', source_port: 4444, payload_base64: reply(8889) },
        { source_ip: '192.168.1.21', source_port: 4444, payload_base64: 'aGVsbG8=' },
      ],
    },
  });
  const result = await searchNetwork(gladys, { wait: 0 });
  assert.deepEqual(result, { found: [{ host: '192.168.1.20', port: 8889 }], error: null });
  assert.deepEqual(
    gladys.fake.scans.map((scan) => scan.port),
    SEARCH_PORTS,
  );
  const forbidden = {
    scanNetwork: async () => {
      throw Object.assign(new Error('forbidden'), { status: 403 });
    },
  };
  assert.deepEqual(await searchNetwork(forbidden, { wait: 0 }), { found: [], error: 'forbidden' });
});

test('writes: raw values, bounds and steps, choices', () => {
  const { parameters, calculations } = defaultRegisters();
  const snapshot = readSnapshot(parameters, calculations);
  assert.deepEqual(rawWrite('dhw:target', 52.2, snapshot), { parameter: 105, raw: 520 });
  assert.deepEqual(rawWrite('heating:offset', -0.3, snapshot), { parameter: 1, raw: -5 });
  assert.deepEqual(rawWrite('heating:mode', 'off', snapshot), { parameter: 3, raw: 4 });
  assert.deepEqual(rawWrite('dhw:mode', 'party', snapshot), { parameter: 4, raw: 2 });
  assert.deepEqual(rawWrite('cooling:enabled', 1, snapshot), { parameter: 108, raw: 1 });
  assert.deepEqual(rawWrite('cooling:target', 22, snapshot), { parameter: 132, raw: 220 });
  for (const [key, value] of [
    ['dhw:target', 29],
    ['dhw:target', 66],
    ['dhw:target', 'hot'],
    ['heating:offset', 6],
    ['cooling:target', 10],
    ['cooling:enabled', 2],
    ['heating:mode', 'turbo'],
  ]) {
    assert.throws(
      () => rawWrite(key, value, snapshot),
      (error) => error instanceof WriteRefused && error.reason === 'range',
    );
  }
  assert.throws(
    () => rawWrite('heatpump:outdoor', 1, snapshot),
    (error) => error.reason === 'read_only',
  );
});

test('writes: the guard (switch, firmware, spacing, quota per day)', async () => {
  const clock = fakeClock();
  const storage = memoryStorage();
  const guard = createWriteGuard({ storage, now: clock.now });
  await guard.load();
  const safe = readSnapshot(...Object.values(defaultRegisters()).slice(0, 2));
  const unsafe = readSnapshot(
    ...Object.values(defaultRegisters({ firmware: 'V1.90.2' })).slice(0, 2),
  );
  const check = (input) => () =>
    guard.check({ enabled: true, snapshot: safe, pumpId: 'p', parameter: 1, ...input });
  assert.throws(check({ enabled: false }), (error) => error.reason === 'disabled');
  assert.throws(check({ snapshot: unsafe }), (error) => error.reason === 'firmware');
  check({})();
  await guard.record('p', 1);
  assert.throws(check({}), (error) => error.reason === 'spacing' && error.vars.seconds === 120);
  check({ parameter: 3 })();
  clock.advance(2 * 60 * 1000);
  check({})();
  for (let index = 1; index < DAILY_MAX; index += 1) {
    await guard.record('p', 1000 + index);
  }
  assert.equal(guard.left('p'), 0);
  assert.throws(check({ parameter: 4 }), (error) => error.reason === 'quota');
  assert.ok(storage.files['writes.json'].p.count === DAILY_MAX);
  clock.advance(24 * 3600 * 1000);
  check({ parameter: 4 })();
  assert.equal(guard.left('p'), DAILY_MAX);
});
