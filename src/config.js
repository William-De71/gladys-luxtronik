// -----------------------------------------------------------------------------
// Integration configuration: the `config_schema` values of the manifest,
// normalized so the rest of the code never deals with strings from a form or
// `undefined`.
// -----------------------------------------------------------------------------

import { parseHosts } from './luxtronik/discovery.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
// 30 s at least: the controller is slow and does not like being asked often.
export const POLL_INTERVALS = [30, 60, 120, 300];

// Defaults: they MUST stay consistent with the `default` values of the
// manifest `config_schema` (test/manifest.test.js checks it).
export const DEFAULTS = {
  hosts: '',
  network_search: true,
  poll_interval: '60',
  allow_writes: false,
  language: 'en',
};

const bool = (value, fallback) => {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return fallback;
};

/**
 * @description Normalize the raw configuration.
 * @param {object} raw - `gladys.config` or the `onConfigUpdated` payload.
 * @returns {{ hosts: object[], networkSearch: boolean, pollMs: number, allowWrites: boolean, language: string }} The configuration.
 */
export function normalizeConfig(raw = {}) {
  const interval = Number(raw.poll_interval ?? DEFAULTS.poll_interval);
  return {
    hosts: parseHosts(raw.hosts ?? DEFAULTS.hosts),
    networkSearch: bool(raw.network_search, DEFAULTS.network_search),
    pollMs: (POLL_INTERVALS.includes(interval) ? interval : Number(DEFAULTS.poll_interval)) * 1000,
    allowWrites: bool(raw.allow_writes, DEFAULTS.allow_writes),
    language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULTS.language,
  };
}
