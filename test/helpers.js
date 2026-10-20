// Test helpers: a clock, a silent logger, waiting, and fake Luxtronik
// controllers on real local sockets (test/helpers/fake-luxtronik.js) that the
// integration reaches through its real code. Nothing leaves 127.0.0.1.

import { defaultRegisters, FakeLuxtronik } from './helpers/fake-luxtronik.js';

export { defaultRegisters, FakeLuxtronik };

export const SERIAL = '2203-e9a';

export function fakeClock(start = Date.parse('2026-10-20T06:00:00Z')) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
  };
}

export const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/**
 * @description Wait until a condition holds (real sockets take a few ms).
 * @param {Function} condition - `() => boolean`.
 * @param {number} [timeoutMs] - Give up after.
 * @returns {Promise<void>} Resolves when true, rejects on timeout.
 */
export async function until(condition, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > end) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * @description A started fake controller.
 * @param {object} [options] - FakeLuxtronik options, `host`.
 * @returns {Promise<FakeLuxtronik>} Listening.
 */
export const startFake = ({ host = '127.0.0.1', ...options } = {}) =>
  new FakeLuxtronik(options).listen(0, host);

/** Short timings: the tests do not wait for real controller delays. */
export const TIMINGS = { timeoutMs: 1000, gapMs: 5, settleMs: 5, searchWaitMs: 0 };
