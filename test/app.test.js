// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`) and fake Luxtronik controllers
// on real local sockets: discovery, readings, states, writes and their
// guards, scene triggers and actions, widgets, lost heat pumps, restarts.
// Nothing leaves 127.0.0.1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { SEARCH_PAYLOAD } from '../src/luxtronik/discovery.js';
import { SCENE_ACTION_OUTPUTS, SCENE_TRIGGER_DATA } from '../src/scenes.js';
import { memoryStorage } from '../src/storage.js';
import { DAILY_MAX } from '../src/writes.js';
import {
  defaultRegisters,
  fakeClock,
  SERIAL,
  silentLogger,
  startFake,
  TIMINGS,
} from './helpers.js';

const id = (type, key) => `ext:test-integration:${type}:${SERIAL}${key ? `:${key}` : ''}`;
const HEATPUMP = id('heatpump');
const HEATING = id('heating');
const DHW = id('dhw');

/**
 * @description An integration wired to the fake Gladys and a fake controller.
 * @param {object} [options] - `{ config, create, storage, fake, gladysDevices, scanResults }`.
 * @returns {Promise<object>} `{ gladys, fake, controller, app, logs, clock, stop }`.
 */
async function setup({
  config = {},
  create = true,
  storage = memoryStorage(),
  controller,
  gladysDevices,
  scanResults,
} = {}) {
  const pump = controller ?? (await startFake());
  const gladys = createFakeGladys({
    config: {
      language: 'fr',
      hosts: `${pump.host}:${pump.port}`,
      network_search: false,
      ...config,
    },
    devices: gladysDevices,
    scanResults,
  });
  const logs = [];
  const log = (line) => logs.push(String(line));
  const clock = fakeClock();
  const app = createApp(gladys, {
    storage,
    now: clock.now,
    logger: { debug: log, info: log, warn: log, error: log },
    timings: TIMINGS,
  });
  await gladys.connect();
  await app.start();
  if (create) {
    for (const device of gladys.fake.discoveredDevices) {
      await gladys.fake.deviceCreated(structuredClone(device));
    }
    await settle(app);
  }
  const stop = async () => {
    await app.stop();
    await pump.close();
  };
  return { gladys, fake: gladys.fake, controller: pump, app, logs, clock, storage, stop };
}

const deviceOf = (fake, externalId) =>
  structuredClone(fake.discoveredDevices.find((device) => device.external_id === externalId));
const featureOf = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`));
const setValue = (fake, externalId, key, value) => {
  const device = deviceOf(fake, externalId);
  return fake.setValue(device, featureOf(device, key), value);
};
async function settle(app) {
  await new Promise((resolve) => setTimeout(resolve, 30));
  await app.flushStates();
  await app.flushStates();
}
const keys = (device) => device.features.map((feature) => feature.external_id.split(':').pop());
const eventsOf = (fake, key) => fake.sceneEvents.filter((event) => event.key === key);

test('discovery: the typed address, the serial number as identity, three devices', async () => {
  const { fake, controller, stop } = await setup({ create: false });
  try {
    const ids = fake.discoveredDevices.map((device) => device.external_id);
    assert.deepEqual(ids, [HEATPUMP, HEATING, DHW], 'no cooling device: this pump never cools');
    const main = deviceOf(fake, HEATPUMP);
    assert.equal(main.name, 'Pompe à chaleur');
    assert.equal(main.model, 'Luxtronik V3.90.1');
    assert.deepEqual(main.params, [
      { name: 'LUXTRONIK_HOST', value: controller.host },
      { name: 'LUXTRONIK_PORT', value: String(controller.port) },
      { name: 'LUXTRONIK_SERIAL', value: SERIAL },
      { name: 'LUXTRONIK_FIRMWARE', value: 'V3.90.1' },
    ]);
    assert.ok(keys(main).includes('power_input'));
    assert.ok(keys(main).includes('energy_input'));
    assert.ok(!keys(main).includes('room'), 'no room unit');
    assert.equal(deviceOf(fake, DHW).name, 'Pompe à chaleur – eau chaude');
    assert.equal(fake.connectionStatus.connected, true);
    assert.match(fake.connectionStatus.message.fr, /modifications désactivées/);
    // One connection at a time, closed every time.
    assert.equal(controller.maxOpen, 1);
    assert.equal(controller.open, 0);
    assert.deepEqual(controller.writes, []);
    assert.ok(!controller.commands.includes(3002));
  } finally {
    await stop();
  }
});

test('states: every feature of the created devices, texts in the configured language', async () => {
  const { fake, stop } = await setup();
  try {
    assert.equal(fake.lastState(`${HEATPUMP}:outdoor`), 4.2);
    assert.equal(fake.lastState(`${HEATPUMP}:flow`), 35.2);
    assert.equal(fake.lastState(`${HEATPUMP}:operating_mode`), 'Chauffage');
    assert.equal(fake.lastState(`${HEATPUMP}:compressor`), 1);
    assert.equal(fake.lastState(`${HEATPUMP}:backup_heater`), 0);
    assert.equal(fake.lastState(`${HEATPUMP}:power_input`), 1350);
    assert.equal(fake.lastState(`${HEATPUMP}:energy_input`), 4444.43);
    assert.equal(fake.lastState(`${HEATPUMP}:heat_produced`), 15802.3);
    assert.equal(fake.lastState(`${HEATPUMP}:compressor_starts`), 8642);
    assert.match(fake.lastState(`${HEATPUMP}:last_error`), /^717 Débit/);
    assert.equal(fake.lastState(`${HEATING}:mode`), 'automatic');
    assert.equal(fake.lastState(`${HEATING}:offset`), 1);
    assert.equal(fake.lastState(`${DHW}:target`), 48);
    assert.equal(fake.lastState(`${DHW}:heating`), 0);
    // Every published state belongs to a declared feature.
    const declared = new Set(
      fake.discoveredDevices.flatMap((device) => device.features.map((item) => item.external_id)),
    );
    for (const state of fake.states) {
      assert.ok(declared.has(state.device_feature_external_id), state.device_feature_external_id);
    }
    assert.deepEqual(
      fake.transports.map((item) => item.transport),
      ['local', 'local', 'local'],
    );
  } finally {
    await stop();
  }
});

test('nothing is published for devices not created', async () => {
  const { fake, app, stop } = await setup({ create: false });
  try {
    await app.poll();
    await settle(app);
    assert.equal(fake.states.length, 0);
  } finally {
    await stop();
  }
});

test('writes: refused while changes are not allowed, nothing written', async () => {
  const { fake, controller, stop } = await setup();
  try {
    const ack = await setValue(fake, DHW, 'target', 52);
    assert.equal(ack.success, false);
    assert.match(ack.error, /Autoriser les modifications/);
    assert.deepEqual(controller.writes, []);
  } finally {
    await stop();
  }
});

test('writes: allowed, within bounds, the right register, read back', async () => {
  const { fake, controller, app, stop } = await setup({ config: { allow_writes: true } });
  try {
    let ack = await setValue(fake, DHW, 'target', 52.3);
    assert.equal(ack.success, true, ack.error);
    // Firmware 3.90 follows P105, the value snapped to 0.5 °C, in tenths.
    assert.deepEqual(controller.writes, [{ index: 105, value: 525 }]);
    await settle(app);
    assert.equal(fake.lastState(`${DHW}:target`), 52.5);

    ack = await setValue(fake, HEATING, 'mode', 'holidays');
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(controller.writes.at(-1), { index: 3, value: 3 });

    ack = await setValue(fake, HEATING, 'offset', -1.5);
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(controller.writes.at(-1), { index: 1, value: -15 });

    // Out of bounds: refused, not clamped.
    ack = await setValue(fake, DHW, 'target', 75);
    assert.equal(ack.success, false);
    assert.match(ack.error, /75/);
    ack = await setValue(fake, HEATING, 'mode', 'turbo');
    assert.equal(ack.success, false);
    // A read-only feature.
    ack = await setValue(fake, HEATPUMP, 'outdoor', 10);
    assert.equal(ack.success, false);
    assert.equal(controller.writes.length, 3);
    assert.equal(controller.maxOpen, 1);
  } finally {
    await stop();
  }
});

test('writes: the same value is never written, one parameter at most every 2 minutes', async () => {
  const { fake, controller, clock, stop } = await setup({ config: { allow_writes: true } });
  try {
    let ack = await setValue(fake, DHW, 'target', 48);
    assert.equal(ack.success, true);
    assert.deepEqual(controller.writes, [], 'already 48 °C');

    ack = await setValue(fake, DHW, 'mode', 'off');
    assert.equal(ack.success, true);
    ack = await setValue(fake, DHW, 'mode', 'automatic');
    assert.equal(ack.success, false);
    assert.match(ack.error, /2 minutes/);
    assert.equal(controller.writes.length, 1);
    clock.advance(2 * 60 * 1000);
    ack = await setValue(fake, DHW, 'mode', 'automatic');
    assert.equal(ack.success, true, ack.error);
    assert.equal(controller.writes.length, 2);
  } finally {
    await stop();
  }
});

test('writes: the daily quota survives a restart', async () => {
  const storage = memoryStorage({
    'writes.json': {
      [SERIAL]: { day: '2026-10-20', count: DAILY_MAX, last: {} },
    },
  });
  const { fake, controller, stop } = await setup({ storage, config: { allow_writes: true } });
  try {
    const ack = await setValue(fake, HEATING, 'offset', 2);
    assert.equal(ack.success, false);
    assert.match(ack.error, /50 modifications/);
    assert.deepEqual(controller.writes, []);
  } finally {
    await stop();
  }
});

test('writes: never on firmware V2.90 (the controller crashes), reading still works', async () => {
  const controller = await startFake({ registers: defaultRegisters({ firmware: 'V2.90.0' }) });
  const { fake, stop } = await setup({ controller, config: { allow_writes: true } });
  try {
    assert.equal(fake.lastState(`${HEATPUMP}:outdoor`), 4.2);
    const ack = await setValue(fake, HEATING, 'offset', 2);
    assert.equal(ack.success, false);
    assert.match(ack.error, /V2\.90\.0/);
    assert.deepEqual(controller.writes, []);
  } finally {
    await stop();
  }
});

test('writes: firmware before 88.3 sets the hot water target in P2', async () => {
  const controller = await startFake({ registers: defaultRegisters({ firmware: 'V1.86.2' }) });
  const { fake, stop } = await setup({ controller, config: { allow_writes: true } });
  try {
    const ack = await setValue(fake, DHW, 'target', 50);
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(controller.writes, [{ index: 2, value: 500 }]);
  } finally {
    await stop();
  }
});

test('scene triggers: mode change, backup heater, new error, once per transition', async () => {
  const { fake, controller, app, clock, stop } = await setup();
  try {
    controller.calculations[80] = 4; // defrost
    controller.calculations[48] = 1; // backup heater on
    await app.poll();
    await app.poll(); // no change: no new event
    const mode = eventsOf(fake, 'mode_changed');
    assert.equal(mode.length, 1);
    assert.equal(mode[0].data.mode, 'defrost');
    assert.equal(mode[0].data.previous_mode, 'heating');
    assert.equal(mode[0].data.mode_text, 'Dégivrage');
    assert.equal(mode[0].data.device, HEATPUMP);
    assert.equal(eventsOf(fake, 'backup_heater_started').length, 1);
    assert.equal(eventsOf(fake, 'backup_heater_started')[0].data.outdoor_temperature, 4.2);

    clock.advance(25 * 60 * 1000);
    controller.calculations[48] = 0;
    controller.calculations[100] = 752; // a new error, newest slot
    controller.calculations[95] = Math.round(clock.now() / 1000);
    await app.poll();
    const stopped = eventsOf(fake, 'backup_heater_stopped');
    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].data.run_minutes, 25);
    const errors = eventsOf(fake, 'error_occurred');
    assert.equal(errors.length, 1, 'the old errors of the log are history');
    assert.equal(errors[0].data.error_code, 752);
    assert.equal(errors[0].data.error_text, 'Alimentation ou débit');

    for (const event of fake.sceneEvents) {
      const allowed = new Set(SCENE_TRIGGER_DATA[event.key]);
      for (const [key, value] of Object.entries(event.data)) {
        assert.ok(allowed.has(key), `${event.key}.${key}`);
        assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
      }
    }
  } finally {
    await stop();
  }
});

test('lost and found: offline after 3 minutes without answer, online once back', async () => {
  const { fake, controller, app, clock, stop } = await setup();
  const { port } = controller;
  try {
    await controller.close();
    await app.poll();
    assert.equal(eventsOf(fake, 'heat_pump_offline').length, 0, 'not after one failure');
    clock.advance(3 * 60 * 1000);
    await app.poll();
    await app.poll();
    assert.equal(eventsOf(fake, 'heat_pump_offline').length, 1);
    assert.equal(fake.connectionStatus.connected, false);
    assert.equal(fake.transports.at(-1).transport, 'unreachable');

    await controller.listen(port);
    await app.poll();
    assert.equal(eventsOf(fake, 'heat_pump_online').length, 1);
    assert.equal(fake.connectionStatus.connected, true);
  } finally {
    await stop();
  }
});

test('scene action: a fresh reading, only the declared outputs', async () => {
  const { fake, controller, clock, stop } = await setup();
  try {
    controller.calculations[15] = -35;
    clock.advance(11 * 1000); // the last reading is not fresh any more
    const ack = await fake.sceneAction('read_values', { device: HEATPUMP });
    assert.equal(ack.success, true, ack.error);
    ack.data = ack.data.outputs;
    assert.deepEqual(Object.keys(ack.data).sort(), [...SCENE_ACTION_OUTPUTS.read_values].sort());
    assert.equal(ack.data.outdoor_temperature, -3.5);
    assert.equal(ack.data.operating_mode, 'Chauffage');
    assert.equal(ack.data.hot_water_target, 48);
    assert.equal(ack.data.last_error_code, 717);
    const unknown = await fake.sceneAction('read_values', {
      device: 'ext:test-integration:heatpump:nope',
    });
    assert.equal(unknown.success, false);
  } finally {
    await stop();
  }
});

test('widgets: valid content, every language, the history needs created devices', async () => {
  const { fake, stop } = await setup();
  try {
    for (const key of ['overview', 'history', 'energy', 'log']) {
      for (const language of ['en', 'fr', 'de', 'es']) {
        const ack = await fake.widgetGet(key, { settings: { device: HEATPUMP }, language });
        assert.equal(ack.success, true, ack.error);
        assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
      }
    }
    const history = (await fake.widgetGet('history', { settings: { period: 'last-week' } })).data
      .content;
    const chart = history.components.find((component) => component.type === 'chart');
    assert.equal(chart.interval, 'last-week');
    assert.deepEqual(chart.device_features, [
      `${HEATPUMP}:outdoor`,
      `${HEATPUMP}:flow`,
      `${HEATPUMP}:return`,
      `${DHW}:temperature`,
    ]);
  } finally {
    await stop();
  }
  const empty = await setup({ create: false });
  try {
    const history = (await empty.fake.widgetGet('history')).data.content;
    assert.ok(!history.components.some((component) => component.type === 'chart'));
  } finally {
    await empty.stop();
  }
});

test('configuration button: what was found, firmware, serial, changes', async () => {
  const { fake, controller, stop } = await setup();
  try {
    const ack = await fake.action('test_connection');
    assert.equal(ack.success, true, ack.error);
    ack.data = ack.data.message;
    assert.match(ack.data.fr, /1 pompe\(s\) à chaleur trouvée\(s\)/);
    assert.match(ack.data.fr, /V3\.90\.1/);
    assert.match(ack.data.fr, /2203-e9a/);
    assert.match(ack.data.en, /read only/);
    assert.ok(ack.data.en.includes(`${controller.host}:${controller.port}`));
  } finally {
    await stop();
  }
});

test('nothing answers: a clear status and button message', async () => {
  const controller = await startFake({ silent: true });
  const { fake, stop } = await setup({ controller, create: false });
  try {
    assert.equal(fake.discoveredDevices.length, 0);
    assert.equal(fake.connectionStatus.connected, false);
    const ack = await fake.action('test_connection');
    assert.match(ack.data.message.en, /No heat pump answered/);
  } finally {
    await stop();
  }
});

test('network search: through Gladys, the answering controller is read', async () => {
  const controller = await startFake();
  const reply = Buffer.from(`2500;111;${controller.port};0;`, 'latin1').toString('base64');
  const { fake, stop } = await setup({
    controller,
    create: false,
    config: { hosts: '', network_search: true },
    scanResults: {
      'udp-active-broadcast': [
        { source_ip: '127.0.0.1', source_port: 4444, payload_base64: reply },
      ],
    },
  });
  try {
    // The search runs in the background after start.
    const deadline = Date.now() + 3000;
    while (fake.discoveredDevices.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(fake.discoveredDevices.length, 3);
    assert.deepEqual(
      fake.scans.map((scan) => [scan.type, scan.port, scan.payload_base64]),
      [
        ['udp-active-broadcast', 4444, SEARCH_PAYLOAD.toString('base64')],
        ['udp-active-broadcast', 47808, SEARCH_PAYLOAD.toString('base64')],
      ],
    );
  } finally {
    await stop();
  }
});

test('restart: the heat pump is known again from /data and from the created devices', async () => {
  const storage = memoryStorage();
  const first = await setup({ storage });
  const created = first.fake.discoveredDevices.map((device) => structuredClone(device));
  await first.app.stop();
  // No address in the configuration: only /data and the devices know it.
  const gladys = createFakeGladys({
    config: { language: 'en', network_search: false },
    devices: created,
  });
  const app = createApp(gladys, { storage, timings: TIMINGS, logger: silentLogger });
  try {
    await gladys.connect();
    await app.start();
    await settle(app);
    assert.equal(gladys.fake.lastState(`${HEATPUMP}:outdoor`), 4.2);
    assert.equal(gladys.fake.lastState(`${HEATPUMP}:operating_mode`), 'Heating');
    assert.equal(gladys.fake.discoveredDevices.length, 3);
  } finally {
    await app.stop();
    await first.controller.close();
  }
});

test('language change: names and texts again in the new language', async () => {
  const { fake, controller, app, stop } = await setup();
  try {
    const { host, port } = controller;
    await fake.configUpdated({ language: 'de', hosts: `${host}:${port}`, network_search: false });
    await settle(app);
    assert.equal(deviceOf(fake, HEATPUMP).name, 'Wärmepumpe');
    assert.equal(fake.lastState(`${HEATPUMP}:operating_mode`), 'Heizen');
  } finally {
    await stop();
  }
});
