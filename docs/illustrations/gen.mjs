// Widget contents for the generated illustrations, built by the real code of
// the integration: the app itself (src/app.js) wired to the fake Gladys of the
// SDK and the fake Luxtronik controller of the tests (a real local socket), on
// a made-up autumn morning: the heat pump heats, the outdoor air is at 4 °C.
// What the core fills in from the features is filled in here the same way: a
// chart bound to features shows their history (a made-up day, seeded, the
// same every run).
// Written as JSON for render.js: node gen.mjs <repo> <out.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(join(repo, file)).href);
const { createApp } = await load('src/app.js');
const { LANGUAGES } = await load('src/i18n.js');
const { memoryStorage } = await load('src/storage.js');
const { createFakeGladys } = await import(
  pathToFileURL(join(repo, 'node_modules/@gladysassistant/integration-sdk/lib/testing.js')).href
);
const { defaultRegisters, FakeLuxtronik } = await load('test/helpers/fake-luxtronik.js');

const manifest = JSON.parse(readFileSync(join(repo, 'gladys-assistant-integration.json'), 'utf8'));
const silent = { debug() {}, info() {}, warn() {}, error() {}, child: () => silent };
// The "now" of the illustrations: 20 October 2026, 8 am in Paris.
const NOW = Date.parse('2026-10-20T06:00:00Z');
const WIDGET_KEYS = ['overview', 'history', 'energy', 'log'];

/** A seeded pseudo-random generator (mulberry32): the same curves every run. */
function random(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 24 hours of temperatures: outdoor, flow, return, hot water. */
function day() {
  const next = random(20261020);
  const series = { outdoor: [], flow: [], return: [], dhw: [] };
  let dhw = 49;
  for (let minutes = 24 * 60; minutes >= 0; minutes -= 20) {
    const t = NOW - minutes * 60 * 1000;
    const hour = (new Date(t).getUTCHours() + 2) % 24;
    const outdoor = 9 - 5 * Math.cos(((hour - 15) / 24) * 2 * Math.PI) + next() * 0.6;
    const flow = 38 - outdoor * 0.6 + next() * 1.5;
    // Hot water: drawn in the evening, reheated at night.
    dhw += hour === 20 ? -6 : hour === 2 ? 4 : -0.05;
    const at = new Date(t).toISOString();
    series.outdoor.push({ t: at, v: Math.round(outdoor * 10) / 10 });
    series.flow.push({ t: at, v: Math.round(flow * 10) / 10 });
    series.return.push({ t: at, v: Math.round((flow - 4.2 - next()) * 10) / 10 });
    series.dhw.push({ t: at, v: Math.round(Math.min(52, Math.max(40, dhw)) * 10) / 10 });
  }
  return series;
}

/**
 * @description One language: the four widgets of one heat pump.
 * @param {string} language - Language.
 * @returns {Promise<object>} The widget contents.
 */
async function contents(language) {
  const controller = await new FakeLuxtronik({
    registers: defaultRegisters({ now: NOW }),
  }).listen();
  const gladys = createFakeGladys({
    config: { language, hosts: `${controller.host}:${controller.port}`, network_search: false },
  });
  const app = createApp(gladys, { storage: memoryStorage(), logger: silent, now: () => NOW });
  await gladys.connect();
  await app.start();
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(structuredClone(device));
  }
  const get = async (key) => (await gladys.fake.widgetGet(key, { language })).data.content;
  const result = {};
  for (const key of WIDGET_KEYS) {
    result[key] = await get(key);
  }
  const curves = day();
  const names = {
    outdoor: { en: 'Outdoor', fr: 'Extérieur', de: 'Außen', es: 'Exterior' },
    flow: { en: 'Flow', fr: 'Départ', de: 'Vorlauf', es: 'Impulsión' },
    return: { en: 'Return', fr: 'Retour', de: 'Rücklauf', es: 'Retorno' },
    dhw: { en: 'Hot water', fr: 'Eau chaude', de: 'Warmwasser', es: 'Agua caliente' },
  };
  for (const component of result.history.components) {
    if (component.type === 'chart' && component.device_features) {
      component.series = ['outdoor', 'flow', 'return', 'dhw'].map((key) => ({
        name: names[key],
        points: curves[key],
      }));
      component.unit = '°C';
    }
  }
  await app.stop();
  await controller.close();
  return result;
}

const all = {};
for (const language of LANGUAGES) {
  all[language] = await contents(language);
}

const card = (key) => {
  const widget = manifest.widgets.find((item) => item.key === key);
  return { icon: widget.icon, label: widget.label };
};
writeFileSync(
  out,
  JSON.stringify({
    contents: all,
    images: {},
    cards: Object.fromEntries(WIDGET_KEYS.map((key) => [key, card(key)])),
  }),
);
