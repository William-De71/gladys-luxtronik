// -----------------------------------------------------------------------------
// Scene triggers and actions (manifest `scene_triggers`, `scene_actions`).
//
// Triggers: one event per transition seen between two readings, never a
// snapshot, never fired by a scene action or a command.
//
//   error_occurred          a new entry in the controller's error log
//   mode_changed            the operating mode changed (heating, hot water,
//                           defrost, grid lock, cooling...), with the mode and
//                           the previous one as filters
//   backup_heater_started   the electric backup heater (second heat
//                           generator 1) switched on
//   backup_heater_stopped   ...and off again, with how long it ran
//   heat_pump_offline       no answer for 3 minutes
//   heat_pump_online        it answers again (after an offline event only)
//
// Action:
//
//   read_values             a fresh reading of a heat pump, for a message or
//                           a condition: temperatures, mode, power, last error
// -----------------------------------------------------------------------------

import { OPERATING_MODE_VALUES } from './luxtronik/model.js';

export const SCENE_TRIGGERS = {
  ERROR_OCCURRED: 'error_occurred',
  MODE_CHANGED: 'mode_changed',
  BACKUP_HEATER_STARTED: 'backup_heater_started',
  BACKUP_HEATER_STOPPED: 'backup_heater_stopped',
  HEAT_PUMP_OFFLINE: 'heat_pump_offline',
  HEAT_PUMP_ONLINE: 'heat_pump_online',
};

// The data keys of each event, as declared in the manifest (fields and variables).
export const SCENE_TRIGGER_DATA = {
  [SCENE_TRIGGERS.ERROR_OCCURRED]: ['device', 'device_name', 'error_code', 'error_text'],
  [SCENE_TRIGGERS.MODE_CHANGED]: ['device', 'device_name', 'mode', 'previous_mode', 'mode_text'],
  [SCENE_TRIGGERS.BACKUP_HEATER_STARTED]: ['device', 'device_name', 'outdoor_temperature'],
  [SCENE_TRIGGERS.BACKUP_HEATER_STOPPED]: ['device', 'device_name', 'run_minutes'],
  [SCENE_TRIGGERS.HEAT_PUMP_OFFLINE]: ['device', 'device_name', 'address'],
  [SCENE_TRIGGERS.HEAT_PUMP_ONLINE]: ['device', 'device_name', 'address'],
};

// Filter values: stored by the scenes, permanent.
export const MODE_FILTER_VALUES = OPERATING_MODE_VALUES;

export const SCENE_ACTIONS = { READ_VALUES: 'read_values' };

// The outputs each action returns, as declared in the manifest.
export const SCENE_ACTION_OUTPUTS = {
  [SCENE_ACTIONS.READ_VALUES]: [
    'operating_mode',
    'status',
    'outdoor_temperature',
    'flow_temperature',
    'return_temperature',
    'hot_water_temperature',
    'hot_water_target',
    'power_input_w',
    'heat_output_w',
    'last_error_code',
    'last_error_text',
  ],
};
