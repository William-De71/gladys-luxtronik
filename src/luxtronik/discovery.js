// -----------------------------------------------------------------------------
// Finding the heat pumps.
//
//   typed addresses   `192.168.1.20` or `192.168.1.20:8889`, separated by
//                     commas: always tried, the reliable way
//   network search    the Alpha Innotec search datagram `2000;111;1;\0`,
//                     broadcast on UDP 4444 and 47808 by Gladys
//                     (`udp-active-broadcast`: a broadcast from the container
//                     never reaches the LAN). A controller answers
//                     `2500;111;<port>;…`. The reference tools send it from
//                     the same port they broadcast to; whether every firmware
//                     answers the random port Gladys uses is not known, so
//                     the search is a bonus, never a requirement.
// -----------------------------------------------------------------------------

import { DEFAULT_PORT } from './client.js';

export const SEARCH_PORTS = [4444, 47808];
export const SEARCH_PAYLOAD = Buffer.from('2000;111;1;\u0000', 'latin1');
const REPLY_PREFIX = '2500;111;';
const SCAN_SECONDS = 3;
// Gladys allows one active scan per 10 s.
const BETWEEN_SCANS_MS = 10500;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export const isIpv4 = (value) => IPV4.test(String(value ?? ''));

/**
 * @description The typed addresses of the configuration.
 * @param {string} value - `192.168.1.20, wp-novelan:8889`.
 * @returns {{ host: string, port: number }[]} Valid, deduplicated targets.
 */
export function parseHosts(value) {
  const seen = new Set();
  const targets = [];
  for (const item of String(value ?? '').split(/[\s,;]+/)) {
    const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(item.trim());
    if (!match) {
      continue;
    }
    const host = match[1].toLowerCase();
    const port = match[2] ? Number(match[2]) : DEFAULT_PORT;
    const numeric = /^[\d.]+$/.test(host);
    if (!(isIpv4(host) || (!numeric && HOSTNAME.test(host))) || port < 1 || port > 65535) {
      continue;
    }
    const key = `${host}:${port}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push({ host, port });
    }
  }
  return targets;
}

/**
 * @description Read one answer to the search datagram.
 * @param {Buffer} payload - Datagram.
 * @param {string} sourceIp - Sender.
 * @returns {{ host: string, port: number }|null} The controller, null when it is not one.
 */
export function parseSearchReply(payload, sourceIp) {
  const text = payload.toString('latin1');
  if (!text.startsWith(REPLY_PREFIX) || !isIpv4(sourceIp)) {
    return null;
  }
  const port = Number(text.split(';')[2]);
  // Old firmware sends no port: the default one.
  return {
    host: sourceIp,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT,
  };
}

/**
 * @description Search the network through Gladys, on both ports.
 * @param {object} gladys - SDK client.
 * @param {object} [options] - `{ logger, wait }` (tests: no wait).
 * @returns {Promise<{ found: { host: string, port: number }[], error: string|null }>} What answered.
 */
export async function searchNetwork(gladys, { logger, wait = BETWEEN_SCANS_MS } = {}) {
  const found = new Map();
  let error = null;
  for (const [index, port] of SEARCH_PORTS.entries()) {
    if (index > 0 && wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    let replies;
    try {
      replies = await gladys.scanNetwork('udp-active-broadcast', {
        port,
        payload: SEARCH_PAYLOAD,
        timeoutSeconds: SCAN_SECONDS,
      });
    } catch (failure) {
      if (failure?.status === 403) {
        logger?.warn(
          'Luxtronik: Gladys refused the network search (reinstall the integration to accept it)',
        );
        return { found: [...found.values()], error: 'forbidden' };
      }
      error = failure?.status === 429 || failure?.status === 409 ? 'busy' : 'failed';
      logger?.info(`Luxtronik: network search on ${port} failed: ${failure?.message ?? failure}`);
      continue;
    }
    for (const reply of replies ?? []) {
      const controller = parseSearchReply(
        Buffer.from(String(reply?.payload_base64 ?? ''), 'base64'),
        reply?.source_ip,
      );
      if (controller) {
        found.set(`${controller.host}:${controller.port}`, controller);
      }
    }
  }
  return { found: [...found.values()], error };
}
