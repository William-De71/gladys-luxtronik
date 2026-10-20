// -----------------------------------------------------------------------------
// Runtime texts, in the four languages of the Gladys UI.
//
// `t(key, vars)` returns a multi-language object `{ en, fr, de, es }`
// (configuration button, widgets, connection status); `text(key, language,
// vars)` returns one string (feature and device names, text states, scene
// action errors: Gladys does not send the language of the user with a scan,
// a command or a scene action, see `language` in config.js). `number(value,
// digits)` formats a number the way each language writes it.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

const m = (en, fr, de, es) => ({ en, fr, de, es });

const MESSAGES = {
  // --- Devices ---------------------------------------------------------------------------------
  device_heatpump: m('Heat pump', 'Pompe à chaleur', 'Wärmepumpe', 'Bomba de calor'),
  device_heating: m('heating', 'chauffage', 'Heizung', 'calefacción'),
  device_dhw: m('hot water', 'eau chaude', 'Warmwasser', 'agua caliente'),
  device_cooling: m('cooling', 'rafraîchissement', 'Kühlung', 'refrigeración'),

  // --- Features --------------------------------------------------------------------------------
  feature_heatpump_outdoor: m(
    'Outdoor temperature',
    'Température extérieure',
    'Außentemperatur',
    'Temperatura exterior',
  ),
  feature_heatpump_outdoor_average: m(
    'Average outdoor temperature',
    'Température extérieure moyenne',
    'Mittlere Außentemperatur',
    'Temperatura exterior media',
  ),
  feature_heatpump_flow: m(
    'Flow temperature',
    'Température de départ',
    'Vorlauftemperatur',
    'Temperatura de impulsión',
  ),
  feature_heatpump_return: m(
    'Return temperature',
    'Température de retour',
    'Rücklauftemperatur',
    'Temperatura de retorno',
  ),
  feature_heatpump_return_target: m(
    'Return target',
    'Consigne de retour',
    'Rücklauf-Soll',
    'Consigna de retorno',
  ),
  feature_heatpump_hot_gas: m(
    'Hot gas temperature',
    'Température gaz chauds',
    'Heißgastemperatur',
    'Temperatura del gas caliente',
  ),
  feature_heatpump_source_in: m(
    'Heat source inlet',
    'Entrée source de chaleur',
    'Wärmequelle Eintritt',
    'Entrada de la fuente de calor',
  ),
  feature_heatpump_source_out: m(
    'Heat source outlet',
    'Sortie source de chaleur',
    'Wärmequelle Austritt',
    'Salida de la fuente de calor',
  ),
  feature_heatpump_room: m(
    'Room temperature',
    'Température ambiante',
    'Raumtemperatur',
    'Temperatura ambiente',
  ),
  feature_heatpump_operating_mode: m(
    'Operating mode',
    'Mode de fonctionnement',
    'Betriebszustand',
    'Modo de funcionamiento',
  ),
  feature_heatpump_status: m('Status', 'État', 'Status', 'Estado'),
  feature_heatpump_last_error: m('Last error', 'Dernière erreur', 'Letzter Fehler', 'Último error'),
  feature_heatpump_compressor: m('Compressor', 'Compresseur', 'Verdichter', 'Compresor'),
  feature_heatpump_backup_heater: m(
    'Backup heater',
    'Appoint électrique',
    'Zusatzheizung',
    'Resistencia de apoyo',
  ),
  feature_heatpump_power_input: m(
    'Electrical power',
    'Puissance électrique',
    'Elektrische Leistung',
    'Potencia eléctrica',
  ),
  feature_heatpump_energy_input: m(
    'Electricity used',
    'Électricité consommée',
    'Verbrauchter Strom',
    'Electricidad consumida',
  ),
  feature_heatpump_heat_output: m(
    'Heat output',
    'Puissance thermique',
    'Heizleistung',
    'Potencia térmica',
  ),
  feature_heatpump_heat_produced: m(
    'Heat produced',
    'Chaleur produite',
    'Erzeugte Wärme',
    'Calor producido',
  ),
  feature_heatpump_compressor_hours: m(
    'Compressor hours',
    'Heures du compresseur',
    'Betriebsstunden Verdichter',
    'Horas del compresor',
  ),
  feature_heatpump_compressor_starts: m(
    'Compressor starts',
    'Démarrages du compresseur',
    'Verdichterstarts',
    'Arranques del compresor',
  ),
  feature_heatpump_backup_hours: m(
    'Backup heater hours',
    'Heures de l’appoint',
    'Betriebsstunden Zusatzheizung',
    'Horas de la resistencia',
  ),
  feature_heating_mode: m(
    'Heating mode',
    'Mode chauffage',
    'Betriebsart Heizung',
    'Modo calefacción',
  ),
  feature_heating_offset: m(
    'Temperature +/-',
    'Température +/-',
    'Temperatur +/-',
    'Temperatura +/-',
  ),
  feature_dhw_temperature: m(
    'Hot water temperature',
    'Température eau chaude',
    'Warmwassertemperatur',
    'Temperatura del agua caliente',
  ),
  feature_dhw_target: m(
    'Hot water target',
    'Consigne eau chaude',
    'Warmwasser-Soll',
    'Consigna de agua caliente',
  ),
  feature_dhw_mode: m(
    'Hot water mode',
    'Mode eau chaude',
    'Betriebsart Warmwasser',
    'Modo agua caliente',
  ),
  feature_dhw_heating: m(
    'Heating hot water',
    'Production d’eau chaude',
    'Warmwasserbereitung',
    'Calentando agua',
  ),
  feature_cooling_enabled: m(
    'Cooling (automatic)',
    'Rafraîchissement (automatique)',
    'Kühlung (Automatik)',
    'Refrigeración (automática)',
  ),
  feature_cooling_target: m(
    'Cooling target',
    'Consigne de rafraîchissement',
    'Kühlung Soll',
    'Consigna de refrigeración',
  ),

  // --- Heating / hot water modes (P3, P4) ---------------------------------------------------------
  mode_automatic: m('Automatic', 'Automatique', 'Automatik', 'Automático'),
  mode_second_heat_source: m(
    'Second heat source',
    '2e générateur',
    'Zweiter Wärmeerzeuger',
    '2.º generador',
  ),
  mode_party: m('Party', 'Party (sans abaissement)', 'Party', 'Fiesta'),
  mode_holidays: m('Holidays', 'Vacances', 'Ferien', 'Vacaciones'),
  mode_off: m('Off', 'Arrêt', 'Aus', 'Apagado'),

  // --- Operating mode (C80) -----------------------------------------------------------------------
  opmode_heating: m('Heating', 'Chauffage', 'Heizen', 'Calefacción'),
  opmode_hot_water: m('Hot water', 'Eau chaude', 'Warmwasser', 'Agua caliente'),
  opmode_pool: m('Pool / solar', 'Piscine / solaire', 'Schwimmbad / Solar', 'Piscina / solar'),
  opmode_grid_lock: m('Grid lock', 'Coupure fournisseur', 'EVU-Sperre', 'Bloqueo de la compañía'),
  opmode_defrost: m('Defrost', 'Dégivrage', 'Abtauen', 'Desescarche'),
  opmode_idle: m('No demand', 'Pas de demande', 'Keine Anforderung', 'Sin demanda'),
  opmode_external_heating: m(
    'External heating',
    'Chauffage externe',
    'Heizen extern',
    'Calefacción externa',
  ),
  opmode_cooling: m('Cooling', 'Rafraîchissement', 'Kühlen', 'Refrigeración'),

  // --- Status line (C119) -------------------------------------------------------------------------
  status_heating: m('Heating', 'Chauffage', 'Heizbetrieb', 'Calefacción'),
  status_no_request: m('No demand', 'Pas de demande', 'Keine Anforderung', 'Sin demanda'),
  status_grid_switch_on_delay: m(
    'Grid switch-on delay',
    'Délai de remise sous tension',
    'Netzeinschaltverzögerung',
    'Retardo de conexión a la red',
  ),
  status_cycle_lock: m('Cycle lock', 'Anti-court-cycle', 'Schaltspielsperre', 'Bloqueo de ciclos'),
  status_lock_time: m('Lock time', 'Temps de blocage', 'Sperrzeit', 'Tiempo de bloqueo'),
  status_hot_water: m('Hot water', 'Eau chaude', 'Warmwasser', 'Agua caliente'),
  status_screed_program: m(
    'Screed drying',
    'Séchage de chape',
    'Estrichprogramm',
    'Secado de solera',
  ),
  status_defrost: m('Defrost', 'Dégivrage', 'Abtauen', 'Desescarche'),
  status_pump_forerun: m(
    'Pump pre-run',
    'Prébalayage pompe',
    'Pumpenvorlauf',
    'Prebarrido de bomba',
  ),
  status_disinfection: m(
    'Thermal disinfection',
    'Désinfection thermique',
    'Thermische Desinfektion',
    'Desinfección térmica',
  ),
  status_cooling: m('Cooling', 'Rafraîchissement', 'Kühlbetrieb', 'Refrigeración'),
  status_pool: m('Pool / solar', 'Piscine / solaire', 'Schwimmbad / Solar', 'Piscina / solar'),
  status_external_heating: m(
    'External heating',
    'Chauffage externe',
    'Heizen extern',
    'Calefacción externa',
  ),
  status_external_hot_water: m(
    'External hot water',
    'Eau chaude externe',
    'Warmwasser extern',
    'Agua caliente externa',
  ),
  status_flow_monitoring: m(
    'Flow monitoring',
    'Contrôle du débit',
    'Durchflussüberwachung',
    'Control de caudal',
  ),
  status_backup_heater: m(
    'Backup heater on',
    'Appoint en marche',
    'Zusatzheizung aktiv',
    'Resistencia de apoyo activa',
  ),
  noError: m('None', 'Aucune', 'Keiner', 'Ninguno'),

  // --- Connection status --------------------------------------------------------------------------
  statusNone: m(
    'No heat pump yet: type its IP address in the settings, then run the search.',
    'Aucune pompe à chaleur pour l’instant : saisissez son adresse IP dans les réglages, puis lancez la recherche.',
    'Noch keine Wärmepumpe: Geben Sie ihre IP-Adresse in den Einstellungen ein und starten Sie die Suche.',
    'Aún no hay bomba de calor: escriba su dirección IP en los ajustes y lance la búsqueda.',
  ),
  statusNoAnswer: m(
    'No heat pump answers on port 8889 at the addresses typed: check the address and the network cable of the controller.',
    'Aucune pompe à chaleur ne répond sur le port 8889 aux adresses saisies : vérifiez l’adresse et le câble réseau du régulateur.',
    'Unter den eingegebenen Adressen antwortet keine Wärmepumpe auf Port 8889: Prüfen Sie die Adresse und das Netzwerkkabel des Reglers.',
    'Ninguna bomba de calor responde en el puerto 8889 en las direcciones indicadas: compruebe la dirección y el cable de red del regulador.',
  ),
  statusAllOff: m(
    'The heat pump does not answer: controller off or network cable unplugged?',
    'La pompe à chaleur ne répond pas : régulateur éteint ou câble réseau débranché ?',
    'Die Wärmepumpe antwortet nicht: Regler aus oder Netzwerkkabel getrennt?',
    'La bomba de calor no responde: ¿regulador apagado o cable de red desconectado?',
  ),
  statusConnected: m(
    '{count} of {total} heat pump(s) read, changes disabled.',
    '{count} pompe(s) à chaleur sur {total} lue(s), modifications désactivées.',
    '{count} von {total} Wärmepumpe(n) gelesen, Änderungen deaktiviert.',
    '{count} de {total} bomba(s) de calor leída(s), cambios desactivados.',
  ),
  statusConnectedWrites: m(
    '{count} of {total} heat pump(s) read, changes allowed.',
    '{count} pompe(s) à chaleur sur {total} lue(s), modifications autorisées.',
    '{count} von {total} Wärmepumpe(n) gelesen, Änderungen erlaubt.',
    '{count} de {total} bomba(s) de calor leída(s), cambios permitidos.',
  ),
  statusSearchForbidden: m(
    'Gladys refused the network search: reinstall the integration and accept it, or type the address of the heat pump.',
    'Gladys a refusé la recherche réseau : réinstallez l’intégration en l’acceptant, ou saisissez l’adresse de la pompe à chaleur.',
    'Gladys hat die Netzwerksuche abgelehnt: Installieren Sie die Integration neu und erlauben Sie sie, oder geben Sie die Adresse der Wärmepumpe ein.',
    'Gladys rechazó la búsqueda en la red: reinstale la integración aceptándola o escriba la dirección de la bomba de calor.',
  ),

  // --- Command errors -----------------------------------------------------------------------------
  errorUnknownDevice: m(
    'This heat pump is not known (yet): run a search in the integration settings.',
    'Cette pompe à chaleur n’est pas (encore) connue : lancez une recherche dans les réglages de l’intégration.',
    'Diese Wärmepumpe ist (noch) nicht bekannt: Starten Sie eine Suche in den Einstellungen der Integration.',
    'Esta bomba de calor no se conoce (aún): lance una búsqueda en los ajustes de la integración.',
  ),
  errorUnreachable: m(
    '{name} does not answer ({error}).',
    '{name} ne répond pas ({error}).',
    '{name} antwortet nicht ({error}).',
    '{name} no responde ({error}).',
  ),
  errorNotApplied: m(
    'The controller did not take the value ({error}).',
    'Le régulateur n’a pas pris la valeur ({error}).',
    'Der Regler hat den Wert nicht übernommen ({error}).',
    'El regulador no aceptó el valor ({error}).',
  ),
  writeRefused_disabled: m(
    'Changes are disabled: tick “Allow changes” in the integration settings first.',
    'Les modifications sont désactivées : cochez d’abord « Autoriser les modifications » dans les réglages de l’intégration.',
    'Änderungen sind deaktiviert: Aktivieren Sie zuerst „Änderungen erlauben“ in den Einstellungen der Integration.',
    'Los cambios están desactivados: marque primero «Permitir cambios» en los ajustes de la integración.',
  ),
  writeRefused_firmware: m(
    'Firmware {firmware} crashes the controller on any change: update or downgrade it first. Reading still works.',
    'Le firmware {firmware} plante le régulateur à chaque modification : mettez-le à jour (ou revenez en arrière) d’abord. La lecture fonctionne.',
    'Firmware {firmware} lässt den Regler bei jeder Änderung abstürzen: Aktualisieren Sie sie zuerst. Lesen funktioniert weiterhin.',
    'El firmware {firmware} bloquea el regulador con cada cambio: actualícelo primero. La lectura sigue funcionando.',
  ),
  writeRefused_range: m(
    'Value refused: {value} is outside what the integration allows for this setting.',
    'Valeur refusée : {value} est hors de ce que l’intégration autorise pour ce réglage.',
    'Wert abgelehnt: {value} liegt außerhalb dessen, was die Integration für diese Einstellung erlaubt.',
    'Valor rechazado: {value} está fuera de lo que la integración permite para este ajuste.',
  ),
  writeRefused_spacing: m(
    'This setting was changed less than 2 minutes ago: try again in {seconds} s (it protects the controller memory).',
    'Ce réglage a été modifié il y a moins de 2 minutes : réessayez dans {seconds} s (cela protège la mémoire du régulateur).',
    'Diese Einstellung wurde vor weniger als 2 Minuten geändert: In {seconds} s erneut versuchen (schont den Speicher des Reglers).',
    'Este ajuste se cambió hace menos de 2 minutos: vuelva a intentarlo en {seconds} s (protege la memoria del regulador).',
  ),
  writeRefused_quota: m(
    '{max} changes today already: the next ones wait until tomorrow (it protects the controller memory).',
    'Déjà {max} modifications aujourd’hui : les suivantes attendront demain (cela protège la mémoire du régulateur).',
    'Heute bereits {max} Änderungen: Weitere erst morgen (schont den Speicher des Reglers).',
    'Ya {max} cambios hoy: los siguientes esperarán a mañana (protege la memoria del regulador).',
  ),
  writeRefused_read_only: m(
    'This value is read only.',
    'Cette valeur est en lecture seule.',
    'Dieser Wert ist schreibgeschützt.',
    'Este valor es de solo lectura.',
  ),

  // --- Configuration button -----------------------------------------------------------------------
  testOk: m(
    '{count} heat pump(s) found: {list}',
    '{count} pompe(s) à chaleur trouvée(s) : {list}',
    '{count} Wärmepumpe(n) gefunden: {list}',
    '{count} bomba(s) de calor encontrada(s): {list}',
  ),
  testNone: m(
    'No heat pump found. Type the IP address of the controller (shown in its menu Service > Network) in the settings.',
    'Aucune pompe à chaleur trouvée. Saisissez l’adresse IP du régulateur (menu Service > Réseau) dans les réglages.',
    'Keine Wärmepumpe gefunden. Geben Sie die IP-Adresse des Reglers (Menü Service > Netzwerk) in den Einstellungen ein.',
    'No se encontró ninguna bomba de calor. Escriba la dirección IP del regulador (menú Servicio > Red) en los ajustes.',
  ),
  testNoAnswer: m(
    'No heat pump answered: {list}',
    'Aucune pompe à chaleur n’a répondu : {list}',
    'Keine Wärmepumpe hat geantwortet: {list}',
    'Ninguna bomba de calor respondió: {list}',
  ),
  testFirmware: m('firmware', 'firmware', 'Firmware', 'firmware'),
  testSerial: m('serial', 'n° de série', 'Seriennr.', 'n.º de serie'),
  testUnreachable: m('not answering', 'ne répond pas', 'antwortet nicht', 'no responde'),
  testWritesOff: m('read only', 'lecture seule', 'nur Lesen', 'solo lectura'),
  testWritesOn: m(
    'changes allowed',
    'modifications autorisées',
    'Änderungen erlaubt',
    'cambios permitidos',
  ),
  testWritesBlocked: m(
    'changes blocked by the firmware',
    'modifications bloquées par le firmware',
    'Änderungen durch die Firmware gesperrt',
    'cambios bloqueados por el firmware',
  ),

  // --- Widgets ------------------------------------------------------------------------------------
  widgetNoPump: m(
    'No heat pump read yet: check the integration settings.',
    'Aucune pompe à chaleur lue : vérifiez les réglages de l’intégration.',
    'Noch keine Wärmepumpe gelesen: Prüfen Sie die Einstellungen der Integration.',
    'Aún no se ha leído ninguna bomba de calor: revise los ajustes.',
  ),
  widgetAddDevice: m(
    'Add the heat pump in Discover to keep the history of its temperatures.',
    'Ajoutez la pompe à chaleur depuis Découverte pour garder l’historique.',
    'Fügen Sie die Wärmepumpe unter Erkennung hinzu, um den Verlauf zu speichern.',
    'Añada la bomba de calor en Descubrir para guardar el historial.',
  ),
  widgetHeatPump: m('Heat pump', 'Pompe à chaleur', 'Wärmepumpe', 'Bomba de calor'),
  widgetOffline: m('Not answering', 'Ne répond pas', 'Antwortet nicht', 'No responde'),
  widgetOutdoor: m('Outdoor', 'Extérieur', 'Außen', 'Exterior'),
  widgetFlow: m('Flow', 'Départ', 'Vorlauf', 'Impulsión'),
  widgetReturn: m('Return', 'Retour', 'Rücklauf', 'Retorno'),
  widgetHotWater: m('Hot water', 'Eau chaude', 'Warmwasser', 'Agua caliente'),
  widgetRoom: m('Room', 'Ambiance', 'Raum', 'Ambiente'),
  widgetPowerInput: m('Power drawn', 'Puissance', 'Leistung', 'Potencia'),
  widgetHeatOutput: m('Heat output', 'Puissance thermique', 'Heizleistung', 'Potencia térmica'),
  widgetMode: m('Mode', 'Mode', 'Betriebszustand', 'Modo'),
  widgetStatus: m('Status', 'État', 'Status', 'Estado'),
  widgetCompressor: m('Compressor', 'Compresseur', 'Verdichter', 'Compresor'),
  widgetRunning: m('Running', 'En marche', 'In Betrieb', 'En marcha'),
  widgetStopped: m('Stopped', 'À l’arrêt', 'Aus', 'Parado'),
  widgetBackupHeater: m(
    'Backup heater',
    'Appoint électrique',
    'Zusatzheizung',
    'Resistencia de apoyo',
  ),
  widgetHotWaterTarget: m(
    'Hot water target',
    'Consigne eau chaude',
    'Warmwasser-Soll',
    'Consigna agua caliente',
  ),
  widgetTemperatures: m('Temperatures', 'Températures', 'Temperaturen', 'Temperaturas'),
  widgetHeatProduced: m('Heat', 'Chaleur', 'Wärme', 'Calor'),
  widgetElectricity: m('Electricity used', 'Électricité', 'Strom', 'Electricidad'),
  widgetPerformance: m('Efficiency', 'Rendement', 'Arbeitszahl', 'Rendimiento'),
  widgetCompressorHours: m('Compressor', 'Compresseur', 'Verdichter', 'Compresor'),
  widgetCompressorStarts: m('Starts', 'Démarrages', 'Starts', 'Arranques'),
  widgetBackupHours: m('Backup heater', 'Appoint', 'Zusatzheizung', 'Apoyo'),
  widgetEnergyNote: m(
    'Totals since commissioning',
    'Totaux depuis la mise en service',
    'Summen seit Inbetriebnahme',
    'Totales desde la puesta en marcha',
  ),
  widgetEnergyNoMeter: m(
    'Since commissioning, no energy meter',
    'Depuis la mise en service, sans compteur',
    'Seit Inbetriebnahme, ohne Zähler',
    'Desde la puesta en marcha, sin contador',
  ),
  widgetError: m('Error', 'Erreur', 'Fehler', 'Error'),
  widgetSwitchOff: m('Stop', 'Arrêt', 'Abschaltung', 'Parada'),
  widgetErrors: m('Errors', 'Erreurs', 'Fehler', 'Errores'),
  widgetErrorToday: m(
    'Error in the last 24 h',
    'Erreur ces dernières 24 h',
    'Fehler in den letzten 24 h',
    'Error en las últimas 24 h',
  ),
  widgetNoRecentError: m(
    'None in the last 24 h',
    'Aucune ces dernières 24 h',
    'Keiner in den letzten 24 h',
    'Ninguno en las últimas 24 h',
  ),
};
/**
 * @description A number written the way each language writes it.
 * @param {number} value - The number.
 * @param {number} digits - Decimals.
 * @param {string} [unit] - Appended after a non-breaking space.
 * @returns {{en: string, fr: string, de: string, es: string}} The texts.
 */
export function number(value, digits, unit = '') {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const formatted = new Intl.NumberFormat(LOCALES[language], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        // Spanish skips the separator below 10 000: keep it everywhere.
        useGrouping: 'always',
      }).format(value);
      return [language, unit ? `${formatted}\u00a0${unit}` : formatted];
    }),
  );
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
  );
}

/**
 * @description A runtime text in the four languages.
 * @param {string} key - Message key.
 * @param {object} [vars] - Placeholder values, a value may itself be multi-language.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function t(key, vars = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, text(key, language, vars)]));
}

/**
 * @description A runtime text in one language (English when unknown).
 * @param {string} key - Message key.
 * @param {string} language - Language code.
 * @param {object} [vars] - Placeholder values, a value may itself be multi-language.
 * @returns {string} The text.
 */
export function text(key, language, vars = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message ${key}`);
  }
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const resolved = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [name, pick(value, lang)]),
  );
  return fill(message[lang], resolved);
}

/**
 * @description One language of a value that may be multi-language.
 * @param {*} value - A string, a number or `{ en, fr, ... }`.
 * @param {string} language - Language code.
 * @returns {*} The value in that language.
 */
export function pick(value, language) {
  if (value && typeof value === 'object') {
    return value[language] ?? value.en;
  }
  return value;
}

/**
 * @description Cut a text to a maximum length, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - Maximum length.
 * @returns {string} The text, at most `max` characters.
 */
export function truncate(value, max) {
  const string = String(value ?? '');
  return string.length <= max ? string : `${string.slice(0, max - 1).trimEnd()}…`;
}

/**
 * @description Cut every language of a multi-language text.
 * @param {object} message - `{ en, fr, ... }`.
 * @param {number} max - Maximum length.
 * @returns {object} The message.
 */
export function truncateAll(message, max) {
  return Object.fromEntries(
    Object.entries(message).map(([language, value]) => [language, truncate(value, max)]),
  );
}

export const MESSAGE_KEYS = Object.keys(MESSAGES);
export const MESSAGES_FOR_TESTS = MESSAGES;
