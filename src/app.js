// -----------------------------------------------------------------------------
// The integration: every Gladys handler, registered before connect().
//
//   discovery   the typed addresses, the heat pumps already known, and the
//               Alpha Innotec network search through Gladys (UDP 4444 /
//               47808, a bonus): each address is read once, the serial
//               number identifies the heat pump
//   readings    every heat pump is read on the configured interval (30 s at
//               least), one TCP session at a time; the values of the devices
//               the user created are published, unchanged ones skipped
//   scenes      new error, operating mode change, backup heater on / off,
//               heat pump lost and found -> scene events
//   commands    heating / hot water modes, offset, hot water target, cooling:
//               only when the user allowed changes, within bounds, spaced and
//               counted (src/writes.js)
//   widgets     overview, history, energy, log
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDevices, DEVICE_TYPES, deviceValues, lastErrorText } from './devices.js';
import { createHub } from './hub.js';
import { pick, t, text, truncate, truncateAll } from './i18n.js';
import { errorText } from './luxtronik/codes.js';
import { searchNetwork } from './luxtronik/discovery.js';
import { SCENE_ACTIONS, SCENE_TRIGGERS } from './scenes.js';
import { createStatePublisher } from './states.js';
import { createStorage } from './storage.js';
import {
  buildEnergyWidget,
  buildHistoryWidget,
  buildLogWidget,
  buildOverviewWidget,
  WIDGETS,
} from './widgets.js';
import { createWriteGuard, rawWrite, WriteRefused } from './writes.js';

export const ACTIONS = { TEST: 'test_connection' };

const MINUTE = 60 * 1000;
const OFFLINE_AFTER_MS = 3 * MINUTE;
const WIDGET_REFRESH_SPACING_MS = 11 * 1000;
const FRESH_MS = 10 * 1000;
const MAX_MESSAGE = 1800;
const LANGUAGES = ['en', 'fr', 'de', 'es'];
const TYPES = Object.values(DEVICE_TYPES);

/**
 * @description Wire the integration.
 * @param {object} gladys - SDK client (or the fake one of the tests).
 * @param {object} [deps] - Dependencies.
 * @param {object} [deps.storage] - src/storage.js storage.
 * @param {object} [deps.logger] - Logger.
 * @param {Function} [deps.now] - Clock (ms).
 * @param {object} [deps.timings] - `{ timeoutMs, gapMs, settleMs, searchWaitMs }` (tests: short).
 * @returns {object} `{ start, stop, scan, poll, … }`.
 */
export function createApp(
  gladys,
  { storage = createStorage(), logger = sdkLogger, now = Date.now, timings = {} } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  let stopped = false;
  let scanning = null;
  let polling = null;
  let pollTimer = null;
  let statusKey = '';
  let searchError = null;
  let saved = {}; // pump id -> { host, port, lastErrorAt }
  const failedTargets = new Map(); // `host:port` -> error message
  const created = new Set(); // device external ids
  const gladysNames = new Map(); // device external id -> name in Gladys
  const transports = new Map();
  const widgetRefresh = new Map();
  const backupSince = new Map(); // pump id -> ms

  const states = createStatePublisher(gladys, {
    logger,
    now,
    isCreated: (externalId) => created.has(externalId),
  });
  const guard = createWriteGuard({ storage, now });

  const safely = (task, what) =>
    Promise.resolve()
      .then(task)
      .catch((error) => logger.warn(`Luxtronik: ${what} failed: ${error?.message ?? error}`));

  const hub = createHub({
    logger,
    now,
    session: timings,
    onReading: (entry, previous) => onReading(entry, previous),
    onFailure: (entry) => onFailure(entry),
  });

  // --- Ids -----------------------------------------------------------------------------------------

  const ids = (type, entry) => gladys.externalIds(type, entry.id);
  const mainId = (entry) => ids(DEVICE_TYPES.HEATPUMP, entry).device;

  /** `ext:sel:heating:2208-e9a[:offset]` -> `{ type, pumpId, key }`. */
  const parseId = (externalId) => {
    const prefix = gladys.externalId('');
    const value = String(externalId ?? '');
    if (!value.startsWith(prefix)) {
      return null;
    }
    const [type, pumpId, key] = value.slice(prefix.length).split(':');
    return TYPES.includes(type) && pumpId ? { type, pumpId, key } : null;
  };

  const known = () => [...hub.entries.values()].filter((entry) => entry.snapshot);
  const several = () => known().length > 1;
  const createdOf = (entry) =>
    TYPES.map((type) => ids(type, entry).device).filter((id) => created.has(id));
  const nameOf = (entry) =>
    gladysNames.get(mainId(entry)) ||
    (several()
      ? `${text('device_heatpump', config.language)} ${entry.host}`
      : text('device_heatpump', config.language));

  // --- Widgets, transports, status -----------------------------------------------------------------

  const refreshWidget = (key) => {
    const slot = widgetRefresh.get(key) ?? { at: 0, timer: null };
    widgetRefresh.set(key, slot);
    const wait = slot.at + WIDGET_REFRESH_SPACING_MS - now();
    if (wait <= 0) {
      slot.at = now();
      safely(() => gladys.requestWidgetRefresh(key), 'widget refresh');
    } else if (!slot.timer) {
      slot.timer = setTimeout(() => {
        slot.timer = null;
        refreshWidget(key);
      }, wait);
      slot.timer.unref?.();
    }
  };
  const refreshWidgets = () => Object.values(WIDGETS).forEach(refreshWidget);

  // One channel: the catalog badge says it; the device badge tells local from unreachable.
  const publishTransports = (entry) => {
    if (entry.reachable === null) {
      return;
    }
    const transport = entry.reachable ? 'local' : 'unreachable';
    const list = createdOf(entry)
      .filter((deviceId) => transports.get(deviceId) !== transport)
      .map((deviceId) => {
        transports.set(deviceId, transport);
        return { external_id: deviceId, transport };
      });
    if (list.length > 0) {
      safely(() => gladys.publishTransports(list), 'transport badges');
    }
  };

  function publishStatus() {
    const pumps = known();
    const answering = pumps.filter((entry) => entry.reachable);
    let key;
    let connected = true;
    let message;
    if (pumps.length === 0) {
      key = `none:${failedTargets.size}`;
      message = failedTargets.size > 0 ? t('statusNoAnswer') : t('statusNone');
      connected = failedTargets.size === 0;
    } else if (answering.length === 0) {
      [key, connected, message] = [`off:${pumps.length}`, false, t('statusAllOff')];
    } else {
      key = `ok:${answering.length}:${pumps.length}:${config.allowWrites}`;
      message = t(config.allowWrites ? 'statusConnectedWrites' : 'statusConnected', {
        count: answering.length,
        total: pumps.length,
      });
    }
    if (key !== statusKey) {
      statusKey = key;
      safely(() => gladys.setConnectionStatus(connected, message), 'status');
    }
  }

  // --- States --------------------------------------------------------------------------------------

  const pushAll = (entry) => {
    if (!entry.snapshot) {
      return;
    }
    const values = deviceValues(entry.snapshot, config.language);
    for (const type of TYPES) {
      const typeIds = ids(type, entry);
      if (!created.has(typeIds.device)) {
        continue;
      }
      for (const [key, value] of values[type] ?? []) {
        states.push(typeIds.feature(key), value);
      }
    }
  };

  // --- Persistence ---------------------------------------------------------------------------------

  const persist = () =>
    safely(() => {
      for (const entry of known()) {
        saved[entry.id] = { ...saved[entry.id], host: entry.host, port: entry.port };
      }
      return storage.write('pumps.json', saved);
    }, 'saving the heat pumps');

  // --- Scene events --------------------------------------------------------------------------------

  const fire = (key, data) =>
    safely(() => gladys.publishSceneEvent(key, data), `scene event ${key}`);
  const eventBase = (entry) => ({
    device: mainId(entry),
    device_name: truncate(nameOf(entry), 200),
  });

  const detectErrors = (entry) => {
    const errors = entry.snapshot.errors;
    const newest = errors[0]?.at ?? 0;
    const record = saved[entry.id] ?? {};
    if (record.lastErrorAt === undefined) {
      // First reading ever: the old errors are history, not news.
      saved[entry.id] = { ...record, lastErrorAt: newest };
      persist();
      return;
    }
    const fresh = errors.filter((error) => error.at > record.lastErrorAt).reverse();
    if (fresh.length === 0) {
      return;
    }
    saved[entry.id] = { ...record, lastErrorAt: newest };
    persist();
    if (!created.has(mainId(entry))) {
      return;
    }
    for (const error of fresh) {
      fire(SCENE_TRIGGERS.ERROR_OCCURRED, {
        ...eventBase(entry),
        error_code: error.code,
        error_text: truncate(pick(errorText(error.code), config.language), 200),
      });
    }
  };

  const detectTransitions = (entry, previous) => {
    const current = entry.snapshot;
    if (!previous || !created.has(mainId(entry))) {
      if (current.backupHeater) {
        backupSince.set(entry.id, backupSince.get(entry.id) ?? now());
      }
      return false;
    }
    let changed = false;
    if (current.mode && previous.mode && current.mode !== previous.mode) {
      changed = true;
      fire(SCENE_TRIGGERS.MODE_CHANGED, {
        ...eventBase(entry),
        mode: current.mode,
        previous_mode: previous.mode,
        mode_text: text(`opmode_${current.mode}`, config.language),
      });
    }
    if (current.backupHeater === true && previous.backupHeater === false) {
      changed = true;
      backupSince.set(entry.id, now());
      fire(SCENE_TRIGGERS.BACKUP_HEATER_STARTED, {
        ...eventBase(entry),
        outdoor_temperature: current.temperatures.outdoor,
      });
    } else if (current.backupHeater === false && previous.backupHeater === true) {
      changed = true;
      const since = backupSince.get(entry.id);
      backupSince.delete(entry.id);
      fire(SCENE_TRIGGERS.BACKUP_HEATER_STOPPED, {
        ...eventBase(entry),
        run_minutes: since === undefined ? null : Math.round((now() - since) / MINUTE),
      });
    }
    if (current.compressor !== previous.compressor) {
      changed = true;
    }
    return changed;
  };

  // --- Readings ------------------------------------------------------------------------------------

  const capabilitiesKey = (snapshot) =>
    JSON.stringify([
      snapshot.capabilities,
      snapshot.settings.coolingTarget !== null,
      snapshot.firmware.text,
    ]);

  function onReading(entry, previous) {
    const shapeChanged = !previous || capabilitiesKey(previous) !== capabilitiesKey(entry.snapshot);
    if (entry.offlineFired) {
      entry.offlineFired = false;
      if (created.has(mainId(entry))) {
        fire(SCENE_TRIGGERS.HEAT_PUMP_ONLINE, { ...eventBase(entry), address: entry.host });
      }
    }
    pushAll(entry);
    detectErrors(entry);
    const changed = detectTransitions(entry, previous);
    publishTransports(entry);
    publishStatus();
    if (shapeChanged && !scanning) {
      persist();
      publishDiscovered();
    }
    if (changed || shapeChanged) {
      refreshWidgets();
    }
  }

  function onFailure(entry) {
    publishTransports(entry);
    publishStatus();
    if (
      !entry.offlineFired &&
      entry.snapshot &&
      now() - entry.failingSince >= OFFLINE_AFTER_MS &&
      created.has(mainId(entry))
    ) {
      entry.offlineFired = true;
      fire(SCENE_TRIGGERS.HEAT_PUMP_OFFLINE, { ...eventBase(entry), address: entry.host });
      refreshWidgets();
    }
  }

  /** Read every heat pump, one after the other. */
  const poll = () => {
    if (!polling) {
      polling = (async () => {
        for (const entry of [...hub.entries.values()]) {
          if (stopped) {
            break;
          }
          await hub.read(entry);
        }
      })().finally(() => {
        polling = null;
      });
    }
    return polling;
  };

  const schedulePolling = () => {
    clearInterval(pollTimer);
    pollTimer = null;
    if (!stopped) {
      pollTimer = setInterval(() => safely(() => poll(), 'reading'), config.pollMs);
      pollTimer.unref?.();
    }
  };

  // --- Discovery -----------------------------------------------------------------------------------

  function publishDiscovered() {
    return safely(
      () =>
        gladys.publishDiscoveredDevices(
          known().flatMap((entry) => buildDevices(gladys, entry, config.language, several())),
        ),
      'discovery',
    );
  }

  const probeTargets = async (targets) => {
    const seen = new Set();
    for (const target of targets) {
      const key = `${target.host}:${target.port}`;
      if (seen.has(key) || stopped) {
        continue;
      }
      seen.add(key);
      const fresh = known().find(
        (entry) =>
          entry.host === target.host &&
          entry.port === target.port &&
          entry.reachable &&
          now() - entry.lastReadingAt < FRESH_MS,
      );
      if (fresh) {
        continue;
      }
      try {
        await hub.probe(target);
        failedTargets.delete(key);
      } catch (error) {
        failedTargets.set(key, error.message);
        const entry = known().find(
          (item) => item.host === target.host && item.port === target.port,
        );
        if (entry) {
          entry.reachable = false;
          entry.failingSince = entry.failingSince ?? now();
          onFailure(entry);
        }
        logger.info(`Luxtronik: no heat pump answered at ${key} (${error.message})`);
      }
    }
  };

  const scanOnce = async ({ search }) => {
    failedTargets.clear();
    const targets = [
      ...config.hosts,
      ...[...hub.entries.values()].map((entry) => ({ host: entry.host, port: entry.port })),
    ];
    await probeTargets(targets);
    persist();
    await publishDiscovered();
    publishStatus();
    if (search && config.networkSearch && !stopped) {
      const result = await searchNetwork(gladys, { logger, wait: timings.searchWaitMs });
      searchError = result.error;
      const fresh = result.found.filter(
        (target) =>
          !known().some((entry) => entry.host === target.host && entry.port === target.port),
      );
      if (fresh.length > 0) {
        await probeTargets(fresh);
        persist();
        await publishDiscovered();
        publishStatus();
      }
    }
    refreshWidgets();
    return known();
  };

  /** Run a scan, or join the one running. */
  const scan = ({ search = true } = {}) => {
    if (!scanning) {
      scanning = scanOnce({ search }).finally(() => {
        scanning = null;
      });
    }
    return scanning;
  };

  // --- Commands ------------------------------------------------------------------------------------

  const userError = (key, vars = {}) => new Error(text(key, config.language, vars));

  const targetOf = (externalId) => {
    const parsed = parseId(externalId);
    const entry = parsed && hub.entries.get(parsed.pumpId);
    if (!entry) {
      throw userError('errorUnknownDevice');
    }
    return { entry, parsed };
  };

  const refusal = (error, entry) => {
    if (error instanceof WriteRefused) {
      return userError(`writeRefused_${error.reason}`, error.vars);
    }
    if (error instanceof RangeError) {
      return userError('writeRefused_range', { value: truncate(error.message, 60) });
    }
    if (error?.kind === 'not_applied') {
      return userError('errorNotApplied', { error: truncate(error.message, 120) });
    }
    return userError('errorUnreachable', {
      name: nameOf(entry),
      error: truncate(error?.message ?? error, 160),
    });
  };

  gladys.onSetValue(async (device, feature, value) => {
    const { entry, parsed } = targetOf(device.external_id);
    const key = `${parsed.type}:${String(feature.external_id).split(':').pop()}`;
    if (!entry.snapshot || !entry.parameters) {
      throw userError('errorUnreachable', { name: nameOf(entry), error: entry.host });
    }
    try {
      const { parameter, raw } = rawWrite(key, value, entry.snapshot);
      if (entry.parameters[parameter] === raw) {
        // Already so: no write, the EEPROM is spared.
        states.forget(feature.external_id);
        pushAll(entry);
        return;
      }
      guard.check({
        enabled: config.allowWrites,
        snapshot: entry.snapshot,
        pumpId: entry.id,
        parameter,
      });
      const { written } = await hub.write(entry, parameter, raw);
      if (written) {
        await guard.record(entry.id, parameter);
        logger.info(`Luxtronik: parameter ${parameter} of ${entry.host} set to ${raw}`);
      }
      states.forget(feature.external_id);
      pushAll(entry);
      refreshWidgets();
    } catch (error) {
      // Gladys shows the value asked for: put the real one back.
      states.forget(feature.external_id);
      pushAll(entry);
      throw refusal(error, entry);
    }
  });

  // --- Device events -------------------------------------------------------------------------------

  const trackCreated = (device) => {
    const parsed = parseId(device?.external_id);
    if (!parsed || parsed.key) {
      return null;
    }
    created.add(device.external_id);
    if (parsed.type === DEVICE_TYPES.HEATPUMP) {
      gladysNames.set(device.external_id, device.name ?? '');
    }
    const existing = hub.entries.get(parsed.pumpId);
    if (existing) {
      return existing;
    }
    const param = (name) => device.params?.find?.((item) => item.name === name)?.value;
    const host = param('LUXTRONIK_HOST');
    const port = Number(param('LUXTRONIK_PORT')) || 8889;
    return host ? hub.entryOf(parsed.pumpId, { host, port }) : null;
  };

  gladys.onDeviceCreated(async (device) => {
    const entry = trackCreated(device);
    if (entry) {
      // States published before the creation were thrown away by Gladys.
      states.republish(device.external_id);
      pushAll(entry);
      transports.delete(device.external_id);
      publishTransports(entry);
    }
    publishStatus();
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    const entry = trackCreated(device);
    if (entry) {
      states.republish(device.external_id);
      pushAll(entry);
    }
    refreshWidgets();
  });

  gladys.onDeviceDeleted(async (device) => {
    if (device?.external_id) {
      created.delete(device.external_id);
      transports.delete(device.external_id);
      gladysNames.delete(device.external_id);
      states.forget(device.external_id);
    }
    publishStatus();
    refreshWidgets();
  });

  gladys.onScanRequest(async () => {
    await scan();
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = config;
    config = normalizeConfig(raw ?? {});
    if (previous.language !== config.language) {
      await publishDiscovered();
      for (const entry of known()) {
        createdOf(entry).forEach((deviceId) => states.forget(deviceId));
        pushAll(entry);
      }
    }
    if (previous.pollMs !== config.pollMs) {
      schedulePolling();
    }
    if (previous.allowWrites !== config.allowWrites) {
      logger.info(`Luxtronik: changes ${config.allowWrites ? 'allowed' : 'disabled'}`);
      publishStatus();
    }
    const hostsKey = (list) => list.map((item) => `${item.host}:${item.port}`).join(',');
    if (hostsKey(previous.hosts) !== hostsKey(config.hosts)) {
      await scan({ search: false });
    }
  });

  // --- Configuration button ------------------------------------------------------------------------

  const firmwareNote = (entry, language) => {
    if (entry.snapshot.writesUnsafe) {
      return text('testWritesBlocked', language);
    }
    return text(config.allowWrites ? 'testWritesOn' : 'testWritesOff', language);
  };

  gladys.onAction(ACTIONS.TEST, async () => {
    await scan();
    const pumps = known();
    if (pumps.length === 0) {
      const failures = [...failedTargets.entries()]
        .map(([key, error]) => `${key} (${truncate(error, 80)})`)
        .join(' ; ');
      if (failures) {
        return t('testNoAnswer', { list: failures });
      }
      return searchError === 'forbidden' ? t('statusSearchForbidden') : t('testNone');
    }
    const message = {};
    for (const language of LANGUAGES) {
      const list = pumps
        .map((entry) => {
          const details = [`${entry.host}:${entry.port}`];
          if (entry.snapshot.firmware.text) {
            details.push(`${text('testFirmware', language)} ${entry.snapshot.firmware.text}`);
          }
          if (entry.snapshot.serial) {
            details.push(`${text('testSerial', language)} ${entry.snapshot.serial}`);
          }
          details.push(
            entry.reachable ? firmwareNote(entry, language) : text('testUnreachable', language),
          );
          return `${nameOf(entry)} (${details.join(', ')})`;
        })
        .join(' ; ');
      message[language] = text('testOk', language, { count: pumps.length, list });
    }
    return truncateAll(message, MAX_MESSAGE);
  });

  // --- Scene action --------------------------------------------------------------------------------

  gladys.onSceneAction(SCENE_ACTIONS.READ_VALUES, async (fields = {}) => {
    const { entry } = targetOf(fields.device);
    if (!entry.lastReadingAt || now() - entry.lastReadingAt > FRESH_MS) {
      await hub.read(entry);
    }
    if (!entry.reachable || !entry.snapshot) {
      throw userError('errorUnreachable', {
        name: nameOf(entry),
        error: entry.lastError ?? entry.host,
      });
    }
    const snapshot = entry.snapshot;
    const [lastError] = snapshot.errors;
    const temps = snapshot.temperatures;
    const language = config.language;
    return {
      operating_mode: snapshot.mode ? text(`opmode_${snapshot.mode}`, language) : '',
      status: snapshot.status ? text(`status_${snapshot.status}`, language) : '',
      outdoor_temperature: temps.outdoor,
      flow_temperature: temps.flow,
      return_temperature: temps.return,
      hot_water_temperature: snapshot.capabilities.dhw ? temps.dhw : null,
      hot_water_target: snapshot.capabilities.dhw ? snapshot.settings.dhwTarget : null,
      power_input_w: snapshot.powerInput,
      heat_output_w: snapshot.heatOutput,
      last_error_code: lastError?.code ?? 0,
      last_error_text: lastErrorText(snapshot, language),
    };
  });

  // --- Widgets -------------------------------------------------------------------------------------

  const viewOf = (settings) => {
    const parsed = settings?.device ? parseId(settings.device) : null;
    const entry = parsed ? hub.entries.get(parsed.pumpId) : known()[0];
    if (!entry?.snapshot) {
      return null;
    }
    const featureIf = (type, key) => {
      const typeIds = ids(type, entry);
      return created.has(typeIds.device) ? typeIds.feature(key) : null;
    };
    return {
      name: nameOf(entry),
      host: entry.host,
      reachable: Boolean(entry.reachable),
      snapshot: entry.snapshot,
      now: now(),
      features: {
        outdoor: featureIf(DEVICE_TYPES.HEATPUMP, 'outdoor'),
        flow: featureIf(DEVICE_TYPES.HEATPUMP, 'flow'),
        return: featureIf(DEVICE_TYPES.HEATPUMP, 'return'),
        dhw: entry.snapshot.capabilities.dhw ? featureIf(DEVICE_TYPES.DHW, 'temperature') : null,
      },
    };
  };

  gladys.onWidgetGet(WIDGETS.OVERVIEW, async ({ settings } = {}) =>
    buildOverviewWidget(viewOf(settings)),
  );
  gladys.onWidgetGet(WIDGETS.HISTORY, async ({ settings } = {}) =>
    buildHistoryWidget(viewOf(settings), settings?.period),
  );
  gladys.onWidgetGet(WIDGETS.ENERGY, async ({ settings } = {}) =>
    buildEnergyWidget(viewOf(settings)),
  );
  gladys.onWidgetGet(WIDGETS.LOG, async ({ settings } = {}) => buildLogWidget(viewOf(settings)));

  // --- Lifecycle -----------------------------------------------------------------------------------

  return {
    /** Restore the known heat pumps, read them, then search. */
    async start() {
      stopped = false;
      config = normalizeConfig(gladys.config ?? {});
      created.clear();
      await guard.load();
      saved = (await storage.read('pumps.json')) ?? {};
      for (const [id, info] of Object.entries(saved)) {
        if (typeof info?.host === 'string' && info.host) {
          hub.entryOf(id, { host: info.host, port: Number(info.port) || 8889 });
        }
      }
      (gladys.devices ?? []).forEach((device) => trackCreated(device));
      publishStatus();
      schedulePolling();
      await scan({ search: false });
      // The network search takes about 20 s: in the background.
      if (config.networkSearch) {
        safely(() => scan({ search: true }), 'network search');
      }
    },

    async stop() {
      stopped = true;
      clearInterval(pollTimer);
      widgetRefresh.forEach((slot) => clearTimeout(slot.timer));
      states.stop();
      await Promise.allSettled([scanning, polling]);
    },

    scan,
    poll,
    flushStates: () => states.flush(),
    hub,
  };
}
