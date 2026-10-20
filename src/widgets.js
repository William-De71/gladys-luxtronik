// -----------------------------------------------------------------------------
// Dashboard widgets (setting `device`: which heat pump, the first one when
// empty).
//
//   overview   what the heat pump does now: operating mode, compressor,
//              backup heater, the main temperatures, the power it draws
//   history    the curves of the outdoor, flow, return and hot water
//              temperatures (a day, three days or a week)
//   energy     heat produced, electricity used, seasonal performance, hours
//              and starts of the compressor, hours of the backup heater
//   log        the error log and the last compressor switch-offs, with dates
//
// Pure: the build functions turn a view into a content, so the tests and
// docs/illustrations/gen.mjs use the exact code Gladys gets. Every text is
// multi-language: Gladys caches the content per language.
// -----------------------------------------------------------------------------

import { errorText, switchOffText } from './luxtronik/codes.js';
import { number, t, truncate } from './i18n.js';

export const WIDGETS = { OVERVIEW: 'overview', HISTORY: 'history', ENERGY: 'energy', LOG: 'log' };
export const HISTORY_PERIODS = ['last-day', 'last-three-days', 'last-week'];
const TTL = { overview: 60, history: 300, energy: 600, log: 300 };
const MAX_LOG_ITEMS = 8;

const MODE_COLORS = {
  heating: 'primary',
  hot_water: 'info',
  pool: 'info',
  grid_lock: 'warning',
  defrost: 'warning',
  idle: 'neutral',
  external_heating: 'primary',
  cooling: 'info',
};

/**
 * @typedef {object} PumpView
 * @property {string} name - Name of the heat pump.
 * @property {string} host - Its address.
 * @property {boolean} reachable - It answered the last reading.
 * @property {object|null} snapshot - Last reading (src/luxtronik/model.js).
 * @property {object} features - Feature external ids of created devices: `{ outdoor, flow, return, dhw }`.
 * @property {number} [now] - Clock (ms), for "today".
 */

const empty = (key, message) => ({
  version: 1,
  ttl_seconds: TTL[key],
  components: [{ type: 'text', text: t(message), variant: 'caption' }],
});

const heading = (view) => ({ type: 'text', text: truncate(view.name, 40), variant: 'heading' });

const tile = (label, value, unit, digits = 1, color = undefined) =>
  value === null || value === undefined
    ? null
    : {
        type: 'value',
        label: t(label),
        value: Math.round(value * 10 ** digits) / 10 ** digits,
        ...(unit ? { unit } : {}),
        ...(color ? { color } : {}),
      };

const offline = () => ({
  type: 'status',
  items: [{ label: t('widgetHeatPump'), value: t('widgetOffline'), color: 'danger' }],
});

/**
 * @description The `overview` widget.
 * @param {PumpView|null} view - Heat pump, null when none.
 * @returns {object} The widget content.
 */
export function buildOverviewWidget(view) {
  if (!view?.snapshot) {
    return empty(WIDGETS.OVERVIEW, 'widgetNoPump');
  }
  const { snapshot } = view;
  const temps = snapshot.temperatures;
  const components = [heading(view)];
  const tiles = [
    tile('widgetOutdoor', temps.outdoor, '°C'),
    tile('widgetFlow', temps.flow, '°C'),
    tile('widgetReturn', temps.return, '°C'),
    snapshot.capabilities.dhw ? tile('widgetHotWater', temps.dhw, '°C', 1, 'info') : null,
    snapshot.capabilities.room ? tile('widgetRoom', temps.room, '°C') : null,
    snapshot.powerInput !== null
      ? tile('widgetPowerInput', snapshot.powerInput, 'W', 0, 'primary')
      : tile('widgetHeatOutput', snapshot.heatOutput, 'W', 0, 'primary'),
  ].filter(Boolean);
  components.push(...tiles.slice(0, 6));

  if (!view.reachable) {
    components.push(offline());
    return { version: 1, ttl_seconds: TTL.overview, components };
  }
  const items = [];
  if (snapshot.mode) {
    items.push({
      label: t('widgetMode'),
      value: t(`opmode_${snapshot.mode}`),
      color: MODE_COLORS[snapshot.mode] ?? 'neutral',
    });
  }
  if (snapshot.status && snapshot.status !== snapshot.mode) {
    items.push({
      label: t('widgetStatus'),
      value: t(`status_${snapshot.status}`),
      color: 'neutral',
    });
  }
  if (snapshot.compressor !== null) {
    items.push({
      label: t('widgetCompressor'),
      value: t(snapshot.compressor ? 'widgetRunning' : 'widgetStopped'),
      color: snapshot.compressor ? 'success' : 'neutral',
    });
  }
  if (snapshot.backupHeater) {
    items.push({ label: t('widgetBackupHeater'), value: t('widgetRunning'), color: 'warning' });
  }
  if (snapshot.capabilities.dhw && snapshot.settings.dhwTarget !== null) {
    items.push({
      label: t('widgetHotWaterTarget'),
      value: number(snapshot.settings.dhwTarget, 1, '°C'),
      color: 'info',
    });
  }
  components.push({ type: 'status', items });
  return { version: 1, ttl_seconds: TTL.overview, components };
}

/**
 * @description The `history` widget.
 * @param {PumpView|null} view - Heat pump.
 * @param {string} [period] - One of HISTORY_PERIODS.
 * @returns {object} The widget content.
 */
export function buildHistoryWidget(view, period = HISTORY_PERIODS[0]) {
  if (!view?.snapshot) {
    return empty(WIDGETS.HISTORY, 'widgetNoPump');
  }
  const features = [
    view.features.outdoor,
    view.features.flow,
    view.features.return,
    view.features.dhw,
  ].filter(Boolean);
  if (features.length === 0) {
    return {
      version: 1,
      ttl_seconds: TTL.history,
      components: [heading(view), { type: 'text', text: t('widgetAddDevice'), variant: 'caption' }],
    };
  }
  const components = [
    heading(view),
    {
      type: 'chart',
      title: t('widgetTemperatures'),
      chart_type: 'line',
      device_features: features,
      interval: HISTORY_PERIODS.includes(period) ? period : HISTORY_PERIODS[0],
    },
  ];
  if (!view.reachable) {
    components.push(offline());
  }
  return { version: 1, ttl_seconds: TTL.history, components };
}

/**
 * @description The `energy` widget.
 * @param {PumpView|null} view - Heat pump.
 * @returns {object} The widget content.
 */
export function buildEnergyWidget(view) {
  if (!view?.snapshot) {
    return empty(WIDGETS.ENERGY, 'widgetNoPump');
  }
  const { snapshot } = view;
  const heat = snapshot.capabilities.heatMeter ? snapshot.heatProduced : null;
  const electricity = snapshot.capabilities.energyInput ? snapshot.energyInput : null;
  const performance = heat && electricity ? heat / electricity : null;
  const components = [heading(view)];
  components.push(
    ...[
      tile('widgetHeatProduced', heat, 'kWh', 0, 'success'),
      tile('widgetElectricity', electricity, 'kWh', 0, 'primary'),
      performance !== null && performance > 0.5 && performance < 10
        ? tile('widgetPerformance', performance, '', 2, 'success')
        : null,
      tile('widgetCompressorHours', snapshot.compressorHours, 'h', 0),
      tile('widgetCompressorStarts', snapshot.compressorStarts, '', 0),
      tile(
        'widgetBackupHours',
        snapshot.backupHours,
        'h',
        0,
        snapshot.backupHours > 0 ? 'warning' : undefined,
      ),
    ].filter(Boolean),
  );
  components.push({
    type: 'text',
    text: t(performance !== null ? 'widgetEnergyNote' : 'widgetEnergyNoMeter'),
    variant: 'caption',
  });
  if (!view.reachable) {
    components.push(offline());
  }
  return { version: 1, ttl_seconds: TTL.energy, components };
}

/**
 * @description The `log` widget.
 * @param {PumpView|null} view - Heat pump.
 * @returns {object} The widget content.
 */
export function buildLogWidget(view) {
  if (!view?.snapshot) {
    return empty(WIDGETS.LOG, 'widgetNoPump');
  }
  const { snapshot } = view;
  const entries = [
    ...snapshot.errors.map((entry) => ({ ...entry, kind: 'error' })),
    ...snapshot.switchOffs.map((entry) => ({ ...entry, kind: 'switch_off' })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_LOG_ITEMS);
  const components = [heading(view)];
  if (entries.length > 0) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: entries.map((entry) => ({
        title:
          entry.kind === 'error'
            ? truncateAll(prefix(entry.code, errorText(entry.code)), 60)
            : truncateAll(switchOffText(entry.code), 60),
        date: new Date(entry.at * 1000).toISOString(),
        badge:
          entry.kind === 'error'
            ? { text: t('widgetError'), color: 'danger' }
            : { text: t('widgetSwitchOff'), color: 'neutral' },
      })),
    });
  }
  const [lastError] = snapshot.errors;
  const recent = lastError && (view.now ?? Date.now()) / 1000 - lastError.at < 24 * 3600;
  components.push({
    type: 'status',
    items: [
      view.reachable
        ? {
            label: t('widgetErrors'),
            value: t(recent ? 'widgetErrorToday' : 'widgetNoRecentError'),
            color: recent ? 'danger' : 'success',
          }
        : offline().items[0],
    ],
  });
  return { version: 1, ttl_seconds: TTL.log, components };
}

const prefix = (code, message) =>
  Object.fromEntries(
    Object.entries(message).map(([language, value]) => [language, `${code} ${value}`]),
  );
const truncateAll = (message, max) =>
  Object.fromEntries(
    Object.entries(message).map(([language, value]) => [language, truncate(value, max)]),
  );
