// Heat pump -> Gladys devices. The Discover tab pitfalls of the Gladys core
// are checked here: a single invalid feature makes the whole discovery list
// refused, a missing min / max / read_only / has_feedback only fails when the
// user clicks "Add", and a category/type pair the front does not label shows
// "Device (undefined)".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { buildDevices, deviceValues } from '../src/devices.js';
import { readSnapshot } from '../src/luxtronik/model.js';
import { WRITABLE } from '../src/writes.js';
import { defaultRegisters } from './helpers.js';

// Pairs labeled by the Gladys front (deviceFeatureCategory in
// front/src/config/i18n/en.json, checked on v5.1.0 and master 2026-10-20).
const LABELED = {
  'temperature-sensor': new Set(['decimal', 'average']),
  text: new Set(['text', 'select']),
  switch: new Set(['binary']),
  'energy-sensor': new Set(['power', 'index']),
  'energy-production-sensor': new Set(['power', 'index']),
  duration: new Set(['decimal']),
  'counter-sensor': new Set(['integer']),
  thermostat: new Set(['target-temperature']),
  'water-heater': new Set(['target-temperature', 'heating']),
};

/** Every variant: the default pump, plus one that cools and has a room unit. */
function entries() {
  const plain = defaultRegisters();
  const full = defaultRegisters();
  full.parameters[42] = 3; // mixing circuit 1 cools
  full.calculations[227] = 215; // room unit
  return [plain, full].map((registers, index) => ({
    id: index === 0 ? '2203-e9a' : '2203-e9b',
    host: `192.168.1.${20 + index}`,
    port: 8889,
    snapshot: readSnapshot(registers.parameters, registers.calculations),
  }));
}

const allDevices = (gladys, language) =>
  entries().flatMap((entry) => buildDevices(gladys, entry, language, true));

test('every feature: labeled pair, bounds, read_only, has_feedback; no Gladys polling', () => {
  const gladys = createFakeGladys();
  const devices = allDevices(gladys, 'en');
  assert.equal(devices.length, 7, '3 + 4 with cooling');
  for (const device of devices) {
    assert.equal(device.should_poll, false, 'read on the integration timer');
    assert.equal(device.poll_frequency, undefined);
    for (const feature of device.features) {
      const where = feature.external_id;
      assert.ok(
        LABELED[feature.category]?.has(feature.type),
        `${where} ${feature.category}/${feature.type}`,
      );
      for (const field of ['min', 'max', 'read_only', 'has_feedback', 'keep_history']) {
        assert.notEqual(feature[field], undefined, `${where} ${field}`);
      }
      assert.ok(feature.min <= feature.max, where);
      assert.ok(feature.name.length > 0, where);
      // Writable exactly when the write guard knows it.
      const key = `${device.external_id.split(':')[2]}:${where.split(':').pop()}`;
      assert.equal(!feature.read_only, Boolean(WRITABLE[key]), key);
    }
  }
});

test('the whole discovery list is accepted by the fake Gladys, in every language', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const devices = allDevices(gladys, language);
    const result = await gladys.publishDiscoveredDevices(devices);
    assert.equal(result.count, devices.length);
  }
});

test('values: within the bounds of their feature, texts for the text features', () => {
  const gladys = createFakeGladys();
  for (const entry of entries()) {
    const devices = buildDevices(gladys, entry, 'en');
    const values = deviceValues(entry.snapshot, 'en');
    for (const device of devices) {
      const type = device.external_id.split(':')[2];
      const features = Object.fromEntries(
        device.features.map((feature) => [feature.external_id.split(':').pop(), feature]),
      );
      for (const [key, value] of values[type]) {
        const feature = features[key];
        if (!feature) {
          assert.ok(['room'].includes(key), `${type}:${key} has no feature`);
          continue;
        }
        if (feature.category === 'text') {
          assert.equal(typeof value.text, 'string', key);
          if (feature.type === 'select') {
            assert.ok(feature.supported_options.some((option) => option.value === value.text));
          }
        } else {
          assert.ok(value >= feature.min && value <= feature.max, `${key}=${value}`);
        }
      }
    }
  }
});

test('discovery baseline (0.1.0): external ids and compared fields never change', () => {
  // Changing a feature key, category, type, unit, min, max or step forces
  // users to delete and recreate their devices: update the baseline only on
  // purpose (UPDATE_BASELINE=1 npm test), with a migration note in the docs.
  const file = new URL('./fixtures/discovery.baseline.json', import.meta.url);
  const gladys = createFakeGladys();
  const describe = (device) => ({
    external_id: device.external_id,
    should_poll: device.should_poll,
    features: device.features.map((feature) => ({
      external_id: feature.external_id,
      category: feature.category,
      type: feature.type,
      unit: feature.unit ?? null,
      min: feature.min,
      max: feature.max,
      step: feature.step ?? null,
      read_only: feature.read_only,
    })),
  });
  const current = allDevices(gladys, 'en').map(describe);
  if (process.env.UPDATE_BASELINE) {
    mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
  }
  assert.deepEqual(current, JSON.parse(readFileSync(file, 'utf8')));
});
