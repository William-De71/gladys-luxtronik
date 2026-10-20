// -----------------------------------------------------------------------------
// Writing to the controller, carefully.
//
// Every parameter written over port 8889 lands in the controller's EEPROM,
// which wears out, and a wrong value can stop the heat pump until someone
// resets it on site. So:
//
//   - writing is OFF until the user ticks "Allow changes" in the settings;
//   - firmware V1.90.x / V2.90.x is never written to (any write crashes the
//     controller, BenPru/luxtronik #831);
//   - only six parameters can be written, each within fixed bounds and on its
//     step (an out-of-range value is refused, never clamped);
//   - a value equal to the current one is not written (src/hub.js reads it
//     first);
//   - one parameter is written at most once every 2 minutes (a slider or a
//     scene that flaps), and 50 writes a day per heat pump at most, counted
//     in /data/writes.json across restarts.
// -----------------------------------------------------------------------------

import { MODE_CODES, P } from './luxtronik/model.js';

export const PARAMETER_SPACING_MS = 2 * 60 * 1000;
export const DAILY_MAX = 50;

// Feature key -> what may be written. `parameter` may depend on the firmware.
export const WRITABLE = {
  'heating:mode': { parameter: () => P.HEATING_MODE, choices: MODE_CODES },
  'heating:offset': { parameter: () => P.HEATING_OFFSET, min: -5, max: 5, step: 0.5, scale: 10 },
  'dhw:mode': { parameter: () => P.DHW_MODE, choices: MODE_CODES },
  'dhw:target': {
    parameter: (snapshot) => snapshot.settings.dhwTargetParameter,
    min: 30,
    max: 65,
    step: 0.5,
    scale: 10,
  },
  'cooling:enabled': { parameter: () => P.COOLING_MODE, choices: { 0: 0, 1: 1 } },
  'cooling:target': { parameter: () => P.COOLING_TARGET, min: 18, max: 30, step: 0.5, scale: 10 },
};

export class WriteRefused extends Error {
  /**
   * @param {string} reason - `disabled`, `firmware`, `range`, `spacing`, `quota`, `read_only`.
   * @param {object} [vars] - Details for the message.
   */
  constructor(reason, vars = {}) {
    super(reason);
    this.name = 'WriteRefused';
    this.reason = reason;
    this.vars = vars;
  }
}

/**
 * @description The raw value of a feature value, or a refusal.
 * @param {string} key - `heating:offset`...
 * @param {number|string} value - Gladys value.
 * @param {object} snapshot - Last reading (firmware).
 * @returns {{ parameter: number, raw: number }} What to write.
 */
export function rawWrite(key, value, snapshot) {
  const spec = WRITABLE[key];
  if (!spec) {
    throw new WriteRefused('read_only');
  }
  const parameter = spec.parameter(snapshot);
  if (spec.choices) {
    const raw = spec.choices[String(value)];
    if (raw === undefined) {
      throw new WriteRefused('range', { value: String(value).slice(0, 40) });
    }
    return { parameter, raw };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < spec.min || number > spec.max) {
    throw new WriteRefused('range', {
      value: String(value).slice(0, 40),
      min: spec.min,
      max: spec.max,
    });
  }
  const stepped = Math.round(number / spec.step) * spec.step;
  return { parameter, raw: Math.round(stepped * spec.scale) };
}

/**
 * @description The guard: switch, firmware, spacing and daily quota.
 * @param {object} deps - `{ storage, now }`.
 * @returns {object} The guard.
 */
export function createWriteGuard({ storage, now }) {
  let counts = {}; // pump id -> { day, count, last: { parameter: ms } }
  const today = () => new Date(now()).toISOString().slice(0, 10);

  const slot = (pumpId) => {
    const day = today();
    if (counts[pumpId]?.day !== day) {
      counts[pumpId] = { day, count: 0, last: counts[pumpId]?.last ?? {} };
    }
    return counts[pumpId];
  };

  return {
    async load() {
      counts = (await storage.read('writes.json')) ?? {};
    },

    /**
     * @description Refuse (throw) when a write may not happen now.
     * @param {object} input - `{ enabled, snapshot, pumpId, parameter }`.
     */
    check({ enabled, snapshot, pumpId, parameter }) {
      if (!enabled) {
        throw new WriteRefused('disabled');
      }
      if (snapshot?.writesUnsafe) {
        throw new WriteRefused('firmware', { firmware: snapshot.firmware.text });
      }
      const current = slot(pumpId);
      if (current.count >= DAILY_MAX) {
        throw new WriteRefused('quota', { max: DAILY_MAX });
      }
      const wait = (current.last[parameter] ?? -Infinity) + PARAMETER_SPACING_MS - now();
      if (wait > 0) {
        throw new WriteRefused('spacing', { seconds: Math.ceil(wait / 1000) });
      }
    },

    /** @description Count a write that reached the controller. */
    async record(pumpId, parameter) {
      const current = slot(pumpId);
      current.count += 1;
      current.last[parameter] = now();
      await storage.write('writes.json', counts);
    },

    /** @returns {number} Writes left today for a heat pump. */
    left: (pumpId) => DAILY_MAX - slot(pumpId).count,
  };
}
