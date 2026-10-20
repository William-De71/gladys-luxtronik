// -----------------------------------------------------------------------------
// A heat pump -> up to four Gladys devices, like the controller's own menus:
//
//   heatpump   temperatures, operating mode and status, compressor, backup
//              heater, last error, power and energy, counters (read only)
//   heating    heating mode and the "temperature +/-" offset of the curve
//   dhw        hot water: temperature, target, mode, heating now
//              (only when the pump makes hot water)
//   cooling    cooling on / off and its target (only when it can cool)
//
// External ids: `ext:{selector}:{type}:{pump id}` and `…:{feature key}`,
// pump id = serial number (src/hub.js). They are forever: never rename a
// type or a feature key. Features that depend on the hardware (room sensor,
// power and energy counters) appear when the controller reports them.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

import { MODE_VALUES } from './luxtronik/model.js';
import { errorText } from './luxtronik/codes.js';
import { pick, text } from './i18n.js';

export const DEVICE_TYPES = {
  HEATPUMP: 'heatpump',
  HEATING: 'heating',
  DHW: 'dhw',
  COOLING: 'cooling',
};

const sensor = (category, type, unit, min, max, extra = {}) => ({
  category,
  type,
  unit,
  min,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...extra,
});

const textFeature = () => ({
  category: CAT.TEXT,
  type: TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  read_only: true,
  has_feedback: false,
  keep_history: false,
});

const command = (category, type, unit, min, max, step) => ({
  category,
  type,
  ...(unit ? { unit } : {}),
  min,
  max,
  ...(step ? { step } : {}),
  read_only: false,
  has_feedback: true,
  keep_history: true,
});

const temperature = (min, max, type = TYPES.SENSOR.DECIMAL) =>
  sensor(CAT.TEMPERATURE_SENSOR, type, UNITS.CELSIUS, min, max);

const modeSelect = (language) => ({
  category: CAT.TEXT,
  type: TYPES.TEXT.SELECT,
  min: 0,
  max: 0,
  read_only: false,
  has_feedback: true,
  keep_history: false,
  supported_options: MODE_VALUES.map((value) => ({
    value,
    label: text(`mode_${value}`, language),
  })),
});

/**
 * @description The features of each device, from what the controller reports.
 * @param {object} snapshot - src/luxtronik/model.js snapshot.
 * @param {string} language - Feature names language.
 * @returns {object} `{ heatpump: [[key, feature]], heating, dhw?, cooling? }`.
 */
export function featureSpecs(snapshot, language) {
  const caps = snapshot.capabilities;
  const heatpump = [
    ['outdoor', temperature(-50, 60)],
    ['outdoor_average', temperature(-50, 60, TYPES.TEMPERATURE_SENSOR.AVERAGE)],
    ['flow', temperature(0, 100)],
    ['return', temperature(0, 100)],
    ['return_target', temperature(0, 100)],
    ['hot_gas', temperature(0, 150)],
    ['source_in', temperature(-40, 60)],
    ['source_out', temperature(-40, 60)],
  ];
  if (caps.room) {
    heatpump.push(['room', temperature(-20, 60)]);
  }
  heatpump.push(
    ['operating_mode', textFeature()],
    ['status', textFeature()],
    ['last_error', textFeature()],
    [
      'compressor',
      sensor(CAT.SWITCH, TYPES.SWITCH.BINARY, undefined, 0, 1, { keep_history: true }),
    ],
    ['backup_heater', sensor(CAT.SWITCH, TYPES.SWITCH.BINARY, undefined, 0, 1)],
  );
  if (caps.powerInput) {
    heatpump.push([
      'power_input',
      sensor(CAT.ENERGY_SENSOR, TYPES.ENERGY_SENSOR.POWER, UNITS.WATT, 0, 30000),
    ]);
  }
  if (caps.energyInput) {
    heatpump.push([
      'energy_input',
      sensor(CAT.ENERGY_SENSOR, TYPES.ENERGY_SENSOR.INDEX, UNITS.KILOWATT_HOUR, 0, 10000000),
    ]);
  }
  if (caps.heatOutput) {
    heatpump.push([
      'heat_output',
      sensor(
        CAT.ENERGY_PRODUCTION_SENSOR,
        TYPES.ENERGY_PRODUCTION_SENSOR.POWER,
        UNITS.WATT,
        0,
        60000,
      ),
    ]);
  }
  if (caps.heatMeter) {
    heatpump.push([
      'heat_produced',
      sensor(
        CAT.ENERGY_PRODUCTION_SENSOR,
        TYPES.ENERGY_PRODUCTION_SENSOR.INDEX,
        UNITS.KILOWATT_HOUR,
        0,
        10000000,
      ),
    ]);
  }
  heatpump.push(
    ['compressor_hours', sensor(CAT.DURATION, TYPES.DURATION.DECIMAL, UNITS.HOURS, 0, 1000000)],
    [
      'compressor_starts',
      sensor(CAT.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, undefined, 0, 100000000),
    ],
    ['backup_hours', sensor(CAT.DURATION, TYPES.DURATION.DECIMAL, UNITS.HOURS, 0, 1000000)],
  );

  const specs = {
    [DEVICE_TYPES.HEATPUMP]: heatpump,
    [DEVICE_TYPES.HEATING]: [
      ['mode', modeSelect(language)],
      [
        'offset',
        command(CAT.THERMOSTAT, TYPES.THERMOSTAT.TARGET_TEMPERATURE, UNITS.CELSIUS, -5, 5, 0.5),
      ],
    ],
  };
  if (caps.dhw) {
    specs[DEVICE_TYPES.DHW] = [
      ['temperature', temperature(0, 100)],
      [
        'target',
        command(
          CAT.WATER_HEATER,
          TYPES.WATER_HEATER.TARGET_TEMPERATURE,
          UNITS.CELSIUS,
          30,
          65,
          0.5,
        ),
      ],
      ['mode', modeSelect(language)],
      ['heating', sensor(CAT.WATER_HEATER, TYPES.WATER_HEATER.HEATING, undefined, 0, 1)],
    ];
  }
  if (caps.cooling) {
    const cooling = [['enabled', command(CAT.SWITCH, TYPES.SWITCH.BINARY, null, 0, 1)]];
    if (snapshot.settings.coolingTarget !== null) {
      cooling.push([
        'target',
        command(CAT.THERMOSTAT, TYPES.THERMOSTAT.TARGET_TEMPERATURE, UNITS.CELSIUS, 18, 30, 0.5),
      ]);
    }
    specs[DEVICE_TYPES.COOLING] = cooling;
  }
  return specs;
}

/**
 * @description The base name of the heat pump in Gladys.
 * @param {object} entry - Heat pump (src/hub.js).
 * @param {string} language - Language.
 * @param {boolean} several - More than one heat pump: add the address.
 * @returns {string} `Heat pump` or `Heat pump 192.168.1.20`.
 */
export function pumpName(entry, language, several = false) {
  const base = text('device_heatpump', language);
  return several ? `${base} ${entry.host}` : base;
}

/**
 * @description The Gladys devices of a heat pump.
 * @param {object} gladys - SDK client (externalIds).
 * @param {object} entry - Heat pump with a snapshot.
 * @param {string} language - Names language.
 * @param {boolean} [several] - More than one heat pump.
 * @returns {object[]} The devices.
 */
export function buildDevices(gladys, entry, language, several = false) {
  const specs = featureSpecs(entry.snapshot, language);
  const base = pumpName(entry, language, several);
  return Object.entries(specs).map(([type, features]) => {
    const ids = gladys.externalIds(type, entry.id);
    const name =
      type === DEVICE_TYPES.HEATPUMP ? base : `${base} – ${text(`device_${type}`, language)}`;
    return {
      name,
      external_id: ids.device,
      model: entry.snapshot.firmware.text
        ? `Luxtronik ${entry.snapshot.firmware.text}`
        : 'Luxtronik',
      should_poll: false,
      features: features.map(([key, feature]) => ({
        name: text(`feature_${type}_${key}`, language),
        external_id: ids.feature(key),
        ...feature,
      })),
      params: [
        { name: 'LUXTRONIK_HOST', value: entry.host },
        { name: 'LUXTRONIK_PORT', value: String(entry.port) },
        ...(entry.snapshot.serial
          ? [{ name: 'LUXTRONIK_SERIAL', value: entry.snapshot.serial }]
          : []),
        ...(entry.snapshot.firmware.text
          ? [{ name: 'LUXTRONIK_FIRMWARE', value: entry.snapshot.firmware.text }]
          : []),
      ],
    };
  });
}

const bit = (value) => (value === null || value === undefined ? null : value ? 1 : 0);

/**
 * @description The last error, as one line in the user's language.
 * @param {object} snapshot - Snapshot.
 * @param {string} language - Language.
 * @returns {string} `717 Flow rate (20/10/2026 08:12)` or `None`.
 */
export function lastErrorText(snapshot, language) {
  const [last] = snapshot.errors;
  if (!last) {
    return text('noError', language);
  }
  const at = new Date(last.at * 1000).toLocaleString(
    { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[language] ?? 'en-GB',
    { dateStyle: 'short', timeStyle: 'short', timeZone: process.env.TZ || 'UTC' },
  );
  return `${last.code} ${pick(errorText(last.code), language)} (${at})`;
}

/**
 * @description Every value of every device, ready to publish.
 * @param {object} snapshot - Snapshot.
 * @param {string} language - Language of the text features.
 * @returns {object} `{ type: [[key, number|{ text }]] }`, nulls left out.
 */
export function deviceValues(snapshot, language) {
  const temps = snapshot.temperatures;
  const label = (prefix, value) => (value ? { text: text(`${prefix}_${value}`, language) } : null);
  const values = {
    [DEVICE_TYPES.HEATPUMP]: [
      ['outdoor', temps.outdoor],
      ['outdoor_average', temps.outdoorAverage],
      ['flow', temps.flow],
      ['return', temps.return],
      ['return_target', temps.returnTarget],
      ['hot_gas', temps.hotGas],
      ['source_in', temps.sourceIn],
      ['source_out', temps.sourceOut],
      ['room', temps.room],
      ['operating_mode', label('opmode', snapshot.mode)],
      ['status', label('status', snapshot.status)],
      ['last_error', { text: lastErrorText(snapshot, language) }],
      ['compressor', bit(snapshot.compressor)],
      ['backup_heater', bit(snapshot.backupHeater)],
      ['power_input', snapshot.powerInput],
      ['energy_input', snapshot.energyInput],
      ['heat_output', snapshot.heatOutput],
      ['heat_produced', snapshot.heatProduced],
      ['compressor_hours', snapshot.compressorHours],
      ['compressor_starts', snapshot.compressorStarts],
      ['backup_hours', snapshot.backupHours],
    ],
    [DEVICE_TYPES.HEATING]: [
      ['mode', snapshot.settings.heatingMode ? { text: snapshot.settings.heatingMode } : null],
      ['offset', snapshot.settings.heatingOffset],
    ],
    [DEVICE_TYPES.DHW]: [
      ['temperature', temps.dhw],
      ['target', snapshot.settings.dhwTarget],
      ['mode', snapshot.settings.dhwMode ? { text: snapshot.settings.dhwMode } : null],
      ['heating', snapshot.mode === null ? null : bit(snapshot.mode === 'hot_water')],
    ],
    [DEVICE_TYPES.COOLING]: [
      ['enabled', bit(snapshot.settings.coolingOn)],
      ['target', snapshot.settings.coolingTarget],
    ],
  };
  return Object.fromEntries(
    Object.entries(values).map(([type, list]) => [
      type,
      list.filter(([, value]) => value !== null && value !== undefined),
    ]),
  );
}
