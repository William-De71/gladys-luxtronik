// -----------------------------------------------------------------------------
// Luxtronik 2.0 / 2.1 binary socket client (TCP port 8889).
//
// The controller speaks big-endian 32-bit signed integers:
//
//   read parameters    send [3003, 0]   <- 3003, length, length x int32
//   read calculations  send [3004, 0]   <- 3004, status, length, length x int32
//   read visibilities  send [3005, 0]   <- 3005, length, length x int8
//   write a parameter  send [3002, index, value]   <- 3002, value
//
// The controller copes badly with several clients: every exchange goes
// through `withSession`, which opens ONE connection per heat pump at a time
// (a queue per address), does its reads / writes and closes the socket
// cleanly, with a short pause before the next session.
//
// Written for this project from the understanding of the protocol (see
// NOTICE): no code was copied from the Python and JavaScript libraries.
// -----------------------------------------------------------------------------

import net from 'node:net';

export const DEFAULT_PORT = 8889;
export const COMMANDS = {
  WRITE_PARAMETER: 3002,
  READ_PARAMETERS: 3003,
  READ_CALCULATIONS: 3004,
  READ_VISIBILITIES: 3005,
};

// A controller sends about 1 200 parameters and 270 calculations; anything far
// bigger is not a Luxtronik answer.
const MAX_LENGTH = 10000;
const TIMEOUT_MS = 10000;
const GAP_MS = 300;

export class LuxtronikError extends Error {
  /**
   * @param {string} message - What went wrong.
   * @param {'network'|'protocol'} kind - A connection problem or an unexpected answer.
   */
  constructor(message, kind) {
    super(message);
    this.name = 'LuxtronikError';
    this.kind = kind;
  }
}

/**
 * @description A reader of exact byte counts on a socket.
 * @param {net.Socket} socket - Connected socket.
 * @returns {{ bytes: Function, int: Function, close: Function }} The reader.
 */
function createReader(socket) {
  let buffer = Buffer.alloc(0);
  let waiting = null;
  let failure = null;

  const wake = () => {
    if (!waiting) {
      return;
    }
    if (failure) {
      const { reject } = waiting;
      waiting = null;
      reject(failure);
    } else if (buffer.length >= waiting.count) {
      const { resolve, count } = waiting;
      waiting = null;
      const chunk = buffer.subarray(0, count);
      buffer = buffer.subarray(count);
      resolve(chunk);
    }
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    wake();
  });
  const fail = (error) => {
    failure = failure ?? error;
    wake();
  };
  socket.on('error', (error) => fail(new LuxtronikError(error.message, 'network')));
  socket.on('close', () =>
    fail(new LuxtronikError('connection closed by the heat pump', 'network')),
  );
  socket.on('timeout', () => {
    fail(new LuxtronikError('the heat pump stopped answering', 'network'));
    socket.destroy();
  });

  const bytes = (count) =>
    new Promise((resolve, reject) => {
      waiting = { count, resolve, reject };
      wake();
    });

  return {
    bytes,
    async int() {
      return (await bytes(4)).readInt32BE(0);
    },
  };
}

const encode = (...ints) => {
  const buffer = Buffer.alloc(ints.length * 4);
  ints.forEach((value, index) => buffer.writeInt32BE(value, index * 4));
  return buffer;
};

/**
 * @description One open connection: the four commands.
 * @param {net.Socket} socket - Connected socket.
 * @returns {object} The session.
 */
function createSession(socket) {
  const reader = createReader(socket);

  const expect = async (command) => {
    const echoed = await reader.int();
    if (echoed !== command) {
      throw new LuxtronikError(`unexpected answer ${echoed} to command ${command}`, 'protocol');
    }
  };
  const lengthOf = async () => {
    const length = await reader.int();
    if (length < 0 || length > MAX_LENGTH) {
      throw new LuxtronikError(`unexpected length ${length}`, 'protocol');
    }
    return length;
  };
  const ints = async (length) => {
    const raw = await reader.bytes(length * 4);
    return Array.from({ length }, (_, index) => raw.readInt32BE(index * 4));
  };

  return {
    /** @returns {Promise<number[]>} The parameters, index = parameter number. */
    async readParameters() {
      socket.write(encode(COMMANDS.READ_PARAMETERS, 0));
      await expect(COMMANDS.READ_PARAMETERS);
      return ints(await lengthOf());
    },

    /** @returns {Promise<number[]>} The calculations, index = calculation number. */
    async readCalculations() {
      socket.write(encode(COMMANDS.READ_CALCULATIONS, 0));
      await expect(COMMANDS.READ_CALCULATIONS);
      await reader.int(); // status word, unused
      return ints(await lengthOf());
    },

    /** @returns {Promise<number[]>} The visibilities (signed bytes). */
    async readVisibilities() {
      socket.write(encode(COMMANDS.READ_VISIBILITIES, 0));
      await expect(COMMANDS.READ_VISIBILITIES);
      const length = await lengthOf();
      const raw = await reader.bytes(length);
      return Array.from({ length }, (_, index) => raw.readInt8(index));
    },

    /**
     * @param {number} index - Parameter number.
     * @param {number} value - Raw value (integer, controller units).
     * @returns {Promise<number>} The value the controller echoed.
     */
    async writeParameter(index, value) {
      if (!Number.isInteger(index) || index < 0 || !Number.isInteger(value)) {
        throw new LuxtronikError(`invalid write ${index}=${value}`, 'protocol');
      }
      socket.write(encode(COMMANDS.WRITE_PARAMETER, index, value));
      await expect(COMMANDS.WRITE_PARAMETER);
      return reader.int();
    },
  };
}

const queues = new Map();

/**
 * @description Open a connection, run `task(session)`, close the connection.
 * One session at a time per address, a short pause between two of them.
 * @param {string} host - Address of the heat pump.
 * @param {number} port - TCP port (8889).
 * @param {Function} task - `async (session) => result`.
 * @param {object} [options] - `{ timeoutMs, gapMs }`.
 * @returns {Promise<*>} What the task returned.
 */
export function withSession(host, port, task, { timeoutMs = TIMEOUT_MS, gapMs = GAP_MS } = {}) {
  const key = `${host}:${port}`;
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(() => runSession(host, port, task, timeoutMs));
  const next = run.catch(() => {}).then(() => new Promise((resolve) => setTimeout(resolve, gapMs)));
  queues.set(key, next);
  next.then(() => {
    if (queues.get(key) === next) {
      queues.delete(key);
    }
  });
  return run;
}

async function runSession(host, port, task, timeoutMs) {
  const socket = new net.Socket();
  socket.setNoDelay(true);
  socket.setTimeout(timeoutMs);
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(new LuxtronikError(error.message, 'network'));
      socket.once('error', onError);
      socket.once('timeout', () => {
        socket.destroy();
        reject(new LuxtronikError(`no answer from ${host}:${port}`, 'network'));
      });
      socket.connect(port, host, () => {
        socket.off('error', onError);
        resolve();
      });
    });
    return await task(createSession(socket));
  } finally {
    // A clean close (FIN), then the socket is freed whatever happens.
    await new Promise((resolve) => {
      if (socket.destroyed) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        socket.destroy();
        resolve();
      }, 1000);
      timer.unref?.();
      socket.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.end();
    });
  }
}
