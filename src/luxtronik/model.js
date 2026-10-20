// -----------------------------------------------------------------------------
// The registers of a Luxtronik controller -> a snapshot in plain units.
//
// Indexes, scales and codes come from the public documentation of the
// protocol (python-luxtronik, BenPru/luxtronik, both MIT; see NOTICE). Only
// what this integration uses is described here.
//
//   temperatures   0.1 °C, signed
//   C151-C154      heat quantities, 0.1 kWh
//   P1136-P1139    electrical energy input, 0.01 kWh (firmware V3.x and some
//                  V1/V2; measured by BenPru/luxtronik #734 / #752)
//   C56, C60...    operating hours, in seconds
//   C81-C90        firmware version, one character per register
//
// Since firmware 3.92 an unavailable field reads 0x7FFF or 0x7FFFFFFF, and an
// unwired temperature sensor reads 0.0, 5.0 or 75.0 °C on most units: these
// values mean "no sensor", never a measurement.
// -----------------------------------------------------------------------------

export const P = {
  HEATING_OFFSET: 1,
  DHW_TARGET_OLD: 2,
  HEATING_MODE: 3,
  DHW_MODE: 4,
  MK1_TYPE: 42,
  DHW_TARGET: 105,
  COOLING_MODE: 108,
  MK2_TYPE: 130,
  COOLING_TARGET: 132,
  MK3_TYPE: 780,
  SERIAL_DATE: 874,
  SERIAL_HEX: 875,
  ENERGY_INPUT_HEATING: 1136,
  ENERGY_INPUT_DHW: 1137,
  ENERGY_INPUT_POOL: 1138,
  ENERGY_INPUT_COOLING: 1139,
};

export const C = {
  FLOW: 10,
  RETURN: 11,
  RETURN_TARGET: 12,
  HOT_GAS: 14,
  OUTDOOR: 15,
  OUTDOOR_AVERAGE: 16,
  DHW: 17,
  SOURCE_IN: 19,
  SOURCE_OUT: 20,
  COMPRESSOR: 44,
  BACKUP_HEATER: 48,
  COMPRESSOR_SECONDS: 56,
  COMPRESSOR_STARTS: 57,
  BACKUP_SECONDS: 60,
  DHW_SECONDS: 65,
  COOLING_SECONDS: 66,
  HEAT_PUMP_TYPE: 78,
  OPERATING_MODE: 80,
  FIRMWARE: 81,
  ERROR_TIME: 95,
  ERROR_CODE: 100,
  SWITCH_OFF_CODE: 106,
  SWITCH_OFF_TIME: 111,
  STATUS_LINE_1: 117,
  STATUS_LINE_2: 118,
  STATUS_LINE_3: 119,
  STATUS_SECONDS: 120,
  HEAT_HEATING: 151,
  HEAT_DHW: 152,
  HEAT_TOTAL: 154,
  ROOM: 227,
  ROOM_TARGET: 228,
  HEAT_OUTPUT: 257,
  POWER_INPUT: 268,
};

const UNAVAILABLE = new Set([0x7fff, 0x7fffffff]);
const UNWIRED = new Set([0, 50, 750]); // 0.0, 5.0, 75.0 °C in 0.1 °C

// Operating modes (C80): stored by scene filters, permanent.
export const OPERATING_MODES = {
  0: 'heating',
  1: 'hot_water',
  2: 'pool',
  3: 'grid_lock',
  4: 'defrost',
  5: 'idle',
  6: 'external_heating',
  7: 'cooling',
};
export const OPERATING_MODE_VALUES = Object.values(OPERATING_MODES);

// Status line 3 (C119): what the controller shows under the main menu.
export const STATUS_CODES = {
  0: 'heating',
  1: 'no_request',
  2: 'grid_switch_on_delay',
  3: 'cycle_lock',
  4: 'lock_time',
  5: 'hot_water',
  6: 'screed_program',
  7: 'defrost',
  8: 'pump_forerun',
  9: 'disinfection',
  10: 'cooling',
  12: 'pool',
  13: 'external_heating',
  14: 'external_hot_water',
  16: 'flow_monitoring',
  17: 'backup_heater',
};

// Heating (P3) and hot water (P4) modes: the values of the selects, permanent.
export const MODES = {
  0: 'automatic',
  1: 'second_heat_source',
  2: 'party',
  3: 'holidays',
  4: 'off',
};
export const MODE_VALUES = Object.values(MODES);
export const MODE_CODES = Object.fromEntries(
  Object.entries(MODES).map(([code, value]) => [value, Number(code)]),
);

/**
 * @description A raw register, null when missing or "not available".
 * @param {number[]} list - Registers.
 * @param {number} index - Register number.
 * @returns {number|null} The raw value.
 */
export function raw(list, index) {
  const value = list?.[index];
  return Number.isInteger(value) && !UNAVAILABLE.has(value) ? value : null;
}

const scaled = (list, index, factor) => {
  const value = raw(list, index);
  return value === null ? null : Math.round(value * factor * 100) / 100;
};

/** A temperature in °C, null when missing. */
export const celsius = (list, index) => scaled(list, index, 0.1);

/** A temperature in °C, null when missing or on an unwired-sensor placeholder. */
export function sensor(list, index) {
  const value = raw(list, index);
  return value === null || UNWIRED.has(value) ? null : Math.round(value) / 10;
}

const unsigned = (value) => (value === null ? null : value >>> 0);

/**
 * @description The firmware version from C81-C90, `V3.90.1` -> `{ text, series, minor }`.
 * @param {number[]} calculations - Calculations.
 * @returns {{ text: string, series: number|null, minor: number[] }} The version.
 */
export function firmwareOf(calculations) {
  const text = Array.from({ length: 10 }, (_, index) => calculations?.[C.FIRMWARE + index])
    .filter((code) => Number.isInteger(code) && code > 0 && code < 128)
    .map((code) => String.fromCharCode(code))
    .join('')
    .trim();
  const numbers = (text.match(/\d+/g) ?? []).map(Number);
  return { text, series: numbers[0] ?? null, minor: numbers.slice(1, 3) };
}

/** `minor >= [a, b]` (88.3, 90.1...). */
export const minorAtLeast = (firmware, major, patch = 0) => {
  const [a = 0, b = 0] = firmware.minor;
  return a > major || (a === major && b >= patch);
};

/**
 * @description Firmware V1.90.x and V2.90.x crash the controller on any write
 * over port 8889 (BenPru/luxtronik #831): writes are blocked there.
 * @param {{ series: number|null, minor: number[] }} firmware - Version.
 * @returns {boolean} True when writing is unsafe.
 */
export function writesUnsafe(firmware) {
  return [1, 2].includes(firmware.series) && firmware.minor[0] === 90;
}

/**
 * @description The register holding the hot water target. Since minor 88.3
 * the controller follows P105 ("desired value"); before, P2. Measured by the
 * BenPru/luxtronik maintainers (DHW_TARGET_REGISTERS.md).
 * @param {{ minor: number[] }} firmware - Version.
 * @returns {number} Parameter number.
 */
export function dhwTargetParameter(firmware) {
  return firmware.minor.length > 0 && minorAtLeast(firmware, 88, 3)
    ? P.DHW_TARGET
    : P.DHW_TARGET_OLD;
}

/**
 * @description The serial number (P874 date + P875 in hexadecimal), the
 * stable identity of the heat pump; null when the controller has none.
 * @param {number[]} parameters - Parameters.
 * @returns {string|null} `2208-e9a`, lower case.
 */
export function serialOf(parameters) {
  const date = raw(parameters, P.SERIAL_DATE);
  if (!date || date <= 0) {
    return null;
  }
  const model = raw(parameters, P.SERIAL_HEX);
  return `${date}-${((model ?? 0) >>> 0).toString(16)}`;
}

const seconds = (list, index) => {
  const value = unsigned(raw(list, index));
  return value === null ? null : value;
};

/**
 * @description The error log (C95-C104): newest first, empty slots dropped.
 * @param {number[]} calculations - Calculations.
 * @returns {{ code: number, at: number }[]} Codes and Unix times (s).
 */
export function errorLog(calculations) {
  return logOf(calculations, C.ERROR_CODE, C.ERROR_TIME).filter((entry) => entry.code > 0);
}

/**
 * @description The switch-off log (C106-C115): why the compressor stopped.
 * @param {number[]} calculations - Calculations.
 * @returns {{ code: number, at: number }[]} Codes and Unix times (s).
 */
export function switchOffLog(calculations) {
  return logOf(calculations, C.SWITCH_OFF_CODE, C.SWITCH_OFF_TIME);
}

function logOf(calculations, codeIndex, timeIndex) {
  const entries = [];
  for (let slot = 0; slot < 5; slot += 1) {
    const code = raw(calculations, codeIndex + slot);
    const at = unsigned(raw(calculations, timeIndex + slot));
    if (code !== null && at) {
      entries.push({ code, at });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

/**
 * @description Everything the integration needs from one reading.
 * @param {number[]} parameters - Parameters (3003).
 * @param {number[]} calculations - Calculations (3004).
 * @returns {object} The snapshot.
 */
export function readSnapshot(parameters, calculations) {
  const firmware = firmwareOf(calculations);
  const mkTypes = [P.MK1_TYPE, P.MK2_TYPE, P.MK3_TYPE].map((index) => raw(parameters, index));
  const dhwSeconds = seconds(calculations, C.DHW_SECONDS);
  const coolingSeconds = seconds(calculations, C.COOLING_SECONDS);
  const energyInputs = [
    P.ENERGY_INPUT_HEATING,
    P.ENERGY_INPUT_DHW,
    P.ENERGY_INPUT_POOL,
    P.ENERGY_INPUT_COOLING,
  ].map((index) => unsigned(raw(parameters, index)));
  const energyInput = energyInputs.some((value) => value !== null)
    ? Math.round(energyInputs.reduce((sum, value) => sum + (value ?? 0), 0)) / 100
    : null;
  const heatTotal = scaled(calculations, C.HEAT_TOTAL, 0.1);
  const dhwParameter = dhwTargetParameter(firmware);
  const mode = raw(calculations, C.OPERATING_MODE);
  const status = raw(calculations, C.STATUS_LINE_3);
  const room = sensor(calculations, C.ROOM);
  const hasPowerInput = raw(calculations, C.POWER_INPUT) !== null;
  const hasHeatOutput = raw(calculations, C.HEAT_OUTPUT) !== null;

  return {
    firmware,
    serial: serialOf(parameters),
    heatPumpType: raw(calculations, C.HEAT_PUMP_TYPE),
    writesUnsafe: writesUnsafe(firmware),
    capabilities: {
      // DHW hours prove it; a new pump has none until its first run, so a
      // wired DHW sensor counts too (BenPru/luxtronik #820).
      dhw: (dhwSeconds ?? 0) > 0 || sensor(calculations, C.DHW) !== null,
      // Cooling hours, or a mixing circuit set as cooling (3) or both (4).
      cooling: (coolingSeconds ?? 0) > 0 || mkTypes.some((type) => type === 3 || type === 4),
      room: room !== null && room > -30 && room < 60,
      powerInput: hasPowerInput,
      heatOutput: hasHeatOutput,
      energyInput: energyInput !== null && energyInput > 0,
      heatMeter: heatTotal !== null && heatTotal > 0,
    },
    temperatures: {
      outdoor: celsius(calculations, C.OUTDOOR),
      outdoorAverage: celsius(calculations, C.OUTDOOR_AVERAGE),
      flow: celsius(calculations, C.FLOW),
      return: celsius(calculations, C.RETURN),
      returnTarget: celsius(calculations, C.RETURN_TARGET),
      hotGas: celsius(calculations, C.HOT_GAS),
      sourceIn: celsius(calculations, C.SOURCE_IN),
      sourceOut: celsius(calculations, C.SOURCE_OUT),
      dhw: celsius(calculations, C.DHW),
      room,
      roomTarget: sensor(calculations, C.ROOM_TARGET),
    },
    mode: mode === null ? null : (OPERATING_MODES[mode] ?? null),
    modeCode: mode,
    status: status === null ? null : (STATUS_CODES[status] ?? null),
    statusCode: status,
    statusSeconds: seconds(calculations, C.STATUS_SECONDS),
    compressor:
      raw(calculations, C.COMPRESSOR) === null ? null : raw(calculations, C.COMPRESSOR) !== 0,
    backupHeater:
      raw(calculations, C.BACKUP_HEATER) === null ? null : raw(calculations, C.BACKUP_HEATER) !== 0,
    powerInput: hasPowerInput ? unsigned(raw(calculations, C.POWER_INPUT)) : null,
    heatOutput: hasHeatOutput ? unsigned(raw(calculations, C.HEAT_OUTPUT)) : null,
    energyInput,
    heatProduced: heatTotal,
    heatHeating: scaled(calculations, C.HEAT_HEATING, 0.1),
    heatDhw: scaled(calculations, C.HEAT_DHW, 0.1),
    compressorHours: hours(seconds(calculations, C.COMPRESSOR_SECONDS)),
    compressorStarts: unsigned(raw(calculations, C.COMPRESSOR_STARTS)),
    backupHours: hours(seconds(calculations, C.BACKUP_SECONDS)),
    errors: errorLog(calculations),
    switchOffs: switchOffLog(calculations),
    settings: {
      heatingMode: modeOf(raw(parameters, P.HEATING_MODE)),
      dhwMode: modeOf(raw(parameters, P.DHW_MODE)),
      heatingOffset: celsius(parameters, P.HEATING_OFFSET),
      dhwTarget: celsius(parameters, dhwParameter),
      dhwTargetParameter: dhwParameter,
      coolingOn:
        raw(parameters, P.COOLING_MODE) === null ? null : raw(parameters, P.COOLING_MODE) === 1,
      coolingTarget: celsius(parameters, P.COOLING_TARGET),
    },
  };
}

const hours = (value) => (value === null ? null : Math.round(value / 36) / 100);
const modeOf = (code) => (code === null ? null : (MODES[code] ?? null));
