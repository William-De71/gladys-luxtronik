// -----------------------------------------------------------------------------
// The heat pumps: reading on a timer, writing a parameter.
//
// One reading = one TCP session: parameters (3003) then calculations (3004),
// then the socket is closed. Sessions to one controller never overlap
// (src/luxtronik/client.js). A heat pump is known by its serial number (P874
// + P875), so a new address (DHCP) is followed; a controller without a serial
// is known by its address.
//
// A write is a session of its own: read the parameter, write it only if it
// differs, wait one second, read it back. The guard of src/writes.js decides
// beforehand whether it may happen at all.
// -----------------------------------------------------------------------------

import { withSession } from './luxtronik/client.js';
import { readSnapshot } from './luxtronik/model.js';

const WRITE_SETTLE_MS = 1000;

/**
 * @description The id of a heat pump: its serial, or its address.
 * @param {string|null} serial - Serial number.
 * @param {string} host - Address.
 * @returns {string} `2208-e9a` or `addr-192-168-1-20`.
 */
export function pumpIdOf(serial, host) {
  return (
    serial ??
    `addr-${String(host)
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}`
  );
}

/**
 * @description Create the hub.
 * @param {object} deps - Dependencies.
 * @param {object} deps.logger - Logger.
 * @param {Function} deps.now - Clock (ms).
 * @param {Function} deps.onReading - `(entry, previous) => void`, after each successful reading.
 * @param {Function} deps.onFailure - `(entry, error) => void`, after a failed reading.
 * @param {object} [deps.session] - `{ timeoutMs, gapMs, settleMs }` (tests: short).
 * @returns {object} The hub.
 */
export function createHub({ logger, now, onReading, onFailure, session = {} }) {
  const entries = new Map(); // pump id -> entry
  const options = { timeoutMs: session.timeoutMs, gapMs: session.gapMs };
  const settleMs = session.settleMs ?? WRITE_SETTLE_MS;

  const entryOf = (id, fields = {}) => {
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        id,
        host: fields.host,
        port: fields.port,
        serial: null,
        snapshot: null,
        parameters: null,
        reachable: null,
        failingSince: null,
        lastReadingAt: null,
        lastError: null,
        offlineFired: false,
      };
      entries.set(id, entry);
    }
    if (fields.host) {
      entry.host = fields.host;
    }
    if (fields.port) {
      entry.port = fields.port;
    }
    return entry;
  };

  const readOnce = (target) =>
    withSession(
      target.host,
      target.port,
      async (connection) => {
        const parameters = await connection.readParameters();
        const calculations = await connection.readCalculations();
        return { parameters, calculations };
      },
      options,
    );

  const apply = (entry, registers) => {
    const previous = entry.snapshot;
    entry.snapshot = readSnapshot(registers.parameters, registers.calculations);
    entry.parameters = registers.parameters;
    entry.serial = entry.snapshot.serial;
    entry.reachable = true;
    entry.failingSince = null;
    entry.lastError = null;
    entry.lastReadingAt = now();
    onReading(entry, previous);
  };

  const fail = (entry, error) => {
    entry.reachable = false;
    entry.failingSince = entry.failingSince ?? now();
    entry.lastError = error?.message ?? String(error);
    onFailure(entry, error);
  };

  return {
    entries,
    entryOf,

    /**
     * @description Read an address that may hold a heat pump not known yet.
     * @param {{ host: string, port: number }} target - Address.
     * @returns {Promise<object>} The entry of the heat pump that answered.
     */
    async probe(target) {
      const registers = await readOnce(target);
      const snapshot = readSnapshot(registers.parameters, registers.calculations);
      const id = pumpIdOf(snapshot.serial, target.host);
      // A pump known at another address moved (DHCP): its entry follows.
      const entry = entryOf(id, target);
      apply(entry, registers);
      return entry;
    },

    /**
     * @description Read a known heat pump.
     * @param {object} entry - Heat pump.
     * @returns {Promise<boolean>} True when it answered.
     */
    async read(entry) {
      try {
        apply(entry, await readOnce(entry));
        return true;
      } catch (error) {
        logger.debug?.(`Luxtronik: reading ${entry.host}:${entry.port} failed: ${error.message}`);
        fail(entry, error);
        return false;
      }
    },

    /**
     * @description Write one parameter, only if it differs, and check it.
     * @param {object} entry - Heat pump.
     * @param {number} parameter - Parameter number.
     * @param {number} value - Raw value.
     * @returns {Promise<{ written: boolean }>} Whether the controller was written to.
     */
    async write(entry, parameter, value) {
      const outcome = await withSession(
        entry.host,
        entry.port,
        async (connection) => {
          const before = await connection.readParameters();
          if (before[parameter] === value) {
            return { written: false, parameters: before };
          }
          if (parameter >= before.length) {
            throw new RangeError(`parameter ${parameter} does not exist on this controller`);
          }
          await connection.writeParameter(parameter, value);
          // The controller needs a moment to take the value into account.
          await new Promise((resolve) => setTimeout(resolve, settleMs));
          const after = await connection.readParameters();
          const calculations = await connection.readCalculations();
          return { written: true, parameters: after, calculations };
        },
        options,
      );
      if (outcome.calculations) {
        apply(entry, { parameters: outcome.parameters, calculations: outcome.calculations });
      }
      if (outcome.parameters[parameter] !== value) {
        const error = new Error(
          `the controller kept ${outcome.parameters[parameter]} instead of ${value}`,
        );
        error.kind = 'not_applied';
        throw error;
      }
      return { written: outcome.written };
    },
  };
}
