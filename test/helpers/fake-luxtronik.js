// -----------------------------------------------------------------------------
// A fake Luxtronik 2.x controller: a real TCP server speaking the binary
// protocol of port 8889 (3002 write, 3003 parameters, 3004 calculations, 3005
// visibilities), on 127.0.0.1.
//
// Its format was checked against python-luxtronik 0.3.14, the library of the
// Home Assistant integrations (see CLAUDE.md, "Simulator"): the Python client
// reads the same values from it and writes to it.
//
// It records what a real controller would suffer from: the connections open
// at the same time (the controller copes badly with several clients) and every
// write (each one lands in its EEPROM). Answers can be cut in small pieces, as
// TCP may deliver them.
//
// `node scripts/fake-controller.mjs [port]` runs one on its own.
// -----------------------------------------------------------------------------

import net from 'node:net';

const PARAMETER_COUNT = 1180;
const CALCULATION_COUNT = 270;
const VISIBILITY_COUNT = 400;

/** The registers of an air / water heat pump with hot water, firmware V3.90.1. */
export function defaultRegisters({
  firmware = 'V3.90.1',
  now = Date.parse('2026-10-20T06:00:00Z'),
} = {}) {
  const parameters = new Array(PARAMETER_COUNT).fill(0);
  const calculations = new Array(CALCULATION_COUNT).fill(0);
  const at = (hoursAgo) => Math.round(now / 1000 - hoursAgo * 3600);

  Object.assign(parameters, {
    1: 10, // temperature +/- : +1.0 °C
    2: 480, // hot water target, old register: 48.0 °C
    3: 0, // heating: automatic
    4: 0, // hot water: automatic
    42: 0, // mixing circuit 1: off
    105: 480, // hot water target: 48.0 °C
    108: 0, // cooling: off
    130: 0,
    132: 200, // cooling target: 20.0 °C
    780: 0,
    874: 2203, // serial number, date part
    875: 3738, // serial number, model part (0xe9a)
    1136: 345678, // electricity for heating: 3 456.78 kWh
    1137: 98765, // electricity for hot water: 987.65 kWh
    1138: 0,
    1139: 0,
  });

  Object.assign(calculations, {
    10: 352, // flow 35.2 °C
    11: 308, // return 30.8 °C
    12: 310, // return target 31.0 °C
    13: 50, // external return: unwired (5.0)
    14: 685, // hot gas 68.5 °C
    15: 42, // outdoor 4.2 °C
    16: 38, // outdoor average 3.8 °C
    17: 478, // hot water 47.8 °C
    18: 480, // hot water target (mirror)
    19: 41, // heat source in 4.2 °C (air)
    20: 12, // heat source out
    44: 1, // compressor running
    48: 0, // backup heater off
    56: 12345678, // compressor: 3 429 h
    57: 8642, // compressor starts
    60: 360000, // backup heater: 100 h
    63: 12345678,
    64: 10000000,
    65: 2345678, // hot water hours: the pump makes hot water
    66: 0, // never cooled
    78: 41, // heat pump type
    80: 0, // operating mode: heating
    95: at(400), // error log, times
    96: at(2000),
    100: 717, // error log: flow rate
    101: 715,
    106: 9, // switch-offs: no demand, defrost, grid lock
    107: 5,
    108: 3,
    111: at(1),
    112: at(5),
    113: at(26),
    117: 0, // heat pump running
    118: 0,
    119: 0, // heating
    120: 754,
    151: 123456, // heat for heating 12 345.6 kWh
    152: 34567, // heat for hot water 3 456.7 kWh
    154: 158023, // heat in total 15 802.3 kWh
    227: 0, // no room unit
    257: 5400, // heat output 5 400 W
    268: 1350, // electrical power 1 350 W
  });
  [...firmware.padEnd(10, '\0')].slice(0, 10).forEach((character, index) => {
    calculations[81 + index] = character.charCodeAt(0);
  });
  return { parameters, calculations, visibilities: new Array(VISIBILITY_COUNT).fill(1) };
}

export class FakeLuxtronik {
  /**
   * @param {object} [options] - Options.
   * @param {object} [options.registers] - `{ parameters, calculations, visibilities }`.
   * @param {number} [options.chunk] - Send the answers in pieces of this many bytes.
   * @param {boolean} [options.silent] - Accept connections, never answer.
   */
  constructor({ registers = defaultRegisters(), chunk = 0, silent = false } = {}) {
    this.registers = registers;
    this.chunk = chunk;
    this.silent = silent;
    this.writes = [];
    this.connections = 0;
    this.open = 0;
    this.maxOpen = 0;
    this.commands = [];
    this.sockets = new Set();
    this.server = net.createServer((socket) => this.serve(socket));
  }

  get parameters() {
    return this.registers.parameters;
  }

  get calculations() {
    return this.registers.calculations;
  }

  async listen(port = 0, host = '127.0.0.1') {
    await new Promise((resolve) => this.server.listen(port, host, resolve));
    this.host = host;
    this.port = this.server.address().port;
    return this;
  }

  async close() {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => this.server.close(() => resolve()));
  }

  send(socket, buffer) {
    if (!this.chunk) {
      socket.write(buffer);
      return;
    }
    for (let offset = 0; offset < buffer.length; offset += this.chunk) {
      socket.write(buffer.subarray(offset, offset + this.chunk));
    }
  }

  serve(socket) {
    this.connections += 1;
    this.open += 1;
    this.maxOpen = Math.max(this.maxOpen, this.open);
    this.sockets.add(socket);
    let buffer = Buffer.alloc(0);
    socket.on('close', () => {
      this.open -= 1;
      this.sockets.delete(socket);
    });
    socket.on('error', () => {});
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 8 && !this.silent) {
        const command = buffer.readInt32BE(0);
        const size = command === 3002 ? 12 : 8;
        if (buffer.length < size) {
          return;
        }
        const request = buffer.subarray(0, size);
        buffer = buffer.subarray(size);
        this.commands.push(command);
        this.answer(socket, command, request);
      }
    });
  }

  answer(socket, command, request) {
    const ints = (...values) => {
      const out = Buffer.alloc(values.length * 4);
      values.forEach((value, index) => out.writeInt32BE(value | 0, index * 4));
      return out;
    };
    switch (command) {
      case 3003:
        this.send(socket, ints(3003, this.parameters.length, ...this.parameters));
        break;
      case 3004:
        this.send(socket, ints(3004, 0, this.calculations.length, ...this.calculations));
        break;
      case 3005: {
        const bytes = Buffer.alloc(this.registers.visibilities.length);
        this.registers.visibilities.forEach((value, index) => bytes.writeInt8(value, index));
        this.send(socket, Buffer.concat([ints(3005, bytes.length), bytes]));
        break;
      }
      case 3002: {
        const index = request.readInt32BE(4);
        const value = request.readInt32BE(8);
        this.writes.push({ index, value });
        if (index >= 0 && index < this.parameters.length) {
          this.parameters[index] = value;
        }
        this.send(socket, ints(3002, value));
        break;
      }
      default:
        // A real controller ignores what it does not know; closing is clearer.
        socket.destroy();
    }
  }
}
