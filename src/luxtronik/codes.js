// -----------------------------------------------------------------------------
// Error codes (error log, C100-C104) and switch-off reasons (C106-C110) of the
// controller, in the four languages of Gladys. The codes and their meaning
// come from the public lists of python-luxtronik (MIT, see NOTICE); the
// wording is ours. An unknown code reads "error 7xx": the manual of the heat
// pump lists them all.
// -----------------------------------------------------------------------------

const e = (en, fr, de, es) => ({ en, fr, de, es });

export const ERROR_CODES = {
  701: e(
    'Low pressure fault',
    'Défaut basse pression',
    'Niederdruckstörung',
    'Fallo de baja presión',
  ),
  702: e(
    'Low pressure lock',
    'Blocage basse pression',
    'Niederdrucksperre',
    'Bloqueo de baja presión',
  ),
  703: e('Frost protection', 'Protection antigel', 'Frostschutz', 'Protección antihielo'),
  704: e('Hot gas fault', 'Défaut gaz chauds', 'Heißgasstörung', 'Fallo de gas caliente'),
  705: e(
    'Compressor motor protection',
    'Protection moteur du compresseur',
    'Motorschutz Verdichter',
    'Protección del motor del compresor',
  ),
  706: e(
    'Brine pump motor protection',
    'Protection moteur de la pompe',
    'Motorschutz Pumpe',
    'Protección del motor de la bomba',
  ),
  708: e('Return sensor', 'Sonde de retour', 'Fühler Rücklauf', 'Sonda de retorno'),
  709: e('Flow sensor', 'Sonde de départ', 'Fühler Vorlauf', 'Sonda de impulsión'),
  710: e('Hot gas sensor', 'Sonde gaz chauds', 'Fühler Heißgas', 'Sonda de gas caliente'),
  711: e('Outdoor sensor', 'Sonde extérieure', 'Fühler Außentemperatur', 'Sonda exterior'),
  712: e('Hot water sensor', 'Sonde d’eau chaude', 'Fühler Warmwasser', 'Sonda de agua caliente'),
  713: e(
    'Heat source inlet sensor',
    'Sonde entrée source',
    'Fühler Wärmequelle Eintritt',
    'Sonda de entrada de la fuente',
  ),
  714: e(
    'Hot gas during hot water',
    'Gaz chauds en eau chaude',
    'Heißgas Warmwasser',
    'Gas caliente en agua caliente',
  ),
  715: e(
    'High pressure switch-off',
    'Coupure haute pression',
    'Hochdruckabschaltung',
    'Corte por alta presión',
  ),
  716: e(
    'High pressure fault',
    'Défaut haute pression',
    'Hochdruckstörung',
    'Fallo de alta presión',
  ),
  717: e('Flow rate', 'Débit', 'Durchfluss', 'Caudal'),
  718: e(
    'Outdoor temperature too high',
    'Température extérieure trop haute',
    'Außentemperatur zu hoch',
    'Temperatura exterior demasiado alta',
  ),
  719: e(
    'Outdoor temperature too low',
    'Température extérieure trop basse',
    'Außentemperatur zu niedrig',
    'Temperatura exterior demasiado baja',
  ),
  720: e(
    'Heat source too cold',
    'Source de chaleur trop froide',
    'Wärmequelle zu kalt',
    'Fuente de calor demasiado fría',
  ),
  721: e(
    'Low pressure switch-off',
    'Coupure basse pression',
    'Niederdruckabschaltung',
    'Corte por baja presión',
  ),
  722: e(
    'Heating temperature difference',
    'Écart de température chauffage',
    'Temperaturdifferenz Heizung',
    'Diferencia de temperatura calefacción',
  ),
  723: e(
    'Hot water temperature difference',
    'Écart de température eau chaude',
    'Temperaturdifferenz Warmwasser',
    'Diferencia de temperatura agua caliente',
  ),
  724: e(
    'Defrost temperature difference',
    'Écart de température dégivrage',
    'Temperaturdifferenz Abtauen',
    'Diferencia de temperatura desescarche',
  ),
  725: e('Hot water fault', 'Défaut eau chaude', 'Störung Warmwasser', 'Fallo de agua caliente'),
  726: e(
    'Mixing circuit 1 sensor',
    'Sonde circuit mélangé 1',
    'Fühler Mischkreis 1',
    'Sonda del circuito mezclado 1',
  ),
  728: e(
    'Heat source outlet sensor',
    'Sonde sortie source',
    'Fühler Wärmequelle Austritt',
    'Sonda de salida de la fuente',
  ),
  729: e('Phase sequence', 'Ordre des phases', 'Drehfeld', 'Secuencia de fases'),
  732: e('Cooling fault', 'Défaut rafraîchissement', 'Störung Kühlung', 'Fallo de refrigeración'),
  750: e(
    'External return sensor',
    'Sonde de retour externe',
    'Fühler Rücklauf extern',
    'Sonda de retorno externa',
  ),
  751: e('Phase monitoring', 'Surveillance des phases', 'Phasenüberwachung', 'Control de fases'),
  752: e(
    'Power supply or flow rate',
    'Alimentation ou débit',
    'Spannungsversorgung oder Durchfluss',
    'Alimentación o caudal',
  ),
  755: e(
    'Connection to slave lost',
    'Liaison esclave perdue',
    'Verbindung zum Slave verloren',
    'Conexión con el esclavo perdida',
  ),
  756: e(
    'Connection to master lost',
    'Liaison maître perdue',
    'Verbindung zum Master verloren',
    'Conexión con el maestro perdida',
  ),
  758: e('Defrost fault', 'Défaut de dégivrage', 'Störung Abtauung', 'Fallo de desescarche'),
  759: e('TDI fault', 'Défaut TDI', 'Störung TDI', 'Fallo TDI'),
  760: e('Defrost fault', 'Défaut de dégivrage', 'Störung Abtauung', 'Fallo de desescarche'),
  761: e(
    'LIN connection lost',
    'Liaison LIN perdue',
    'LIN-Verbindung verloren',
    'Conexión LIN perdida',
  ),
  770: e(
    'Superheat too low',
    'Surchauffe trop faible',
    'Überhitzung zu niedrig',
    'Recalentamiento demasiado bajo',
  ),
  771: e(
    'Superheat too high',
    'Surchauffe trop forte',
    'Überhitzung zu hoch',
    'Recalentamiento demasiado alto',
  ),
  776: e(
    'Compressor operating limits',
    'Limites de fonctionnement du compresseur',
    'Einsatzgrenzen Verdichter',
    'Límites de funcionamiento del compresor',
  ),
  777: e('Expansion valve', 'Détendeur', 'Expansionsventil', 'Válvula de expansión'),
  783: e(
    'Inverter communication',
    'Communication avec l’onduleur',
    'Kommunikation Inverter',
    'Comunicación con el inversor',
  ),
  784: e('Inverter locked', 'Onduleur bloqué', 'Inverter gesperrt', 'Inversor bloqueado'),
  788: e(
    'Serious inverter fault',
    'Défaut grave de l’onduleur',
    'Schwerer Inverterfehler',
    'Fallo grave del inversor',
  ),
  790: e(
    'Serious inverter fault',
    'Défaut grave de l’onduleur',
    'Schwerer Inverterfehler',
    'Fallo grave del inversor',
  ),
  793: e(
    'Serious inverter fault',
    'Défaut grave de l’onduleur',
    'Schwerer Inverterfehler',
    'Fallo grave del inversor',
  ),
  794: e('Overvoltage', 'Surtension', 'Überspannung', 'Sobretensión'),
  795: e('Undervoltage', 'Sous-tension', 'Unterspannung', 'Subtensión'),
  796: e('Safety shutdown', 'Arrêt de sécurité', 'Sicherheitsabschaltung', 'Parada de seguridad'),
};

export const SWITCH_OFF_CODES = {
  0: e(
    'Heat pump fault',
    'Défaut pompe à chaleur',
    'Wärmepumpenstörung',
    'Fallo de la bomba de calor',
  ),
  1: e('System fault', 'Défaut installation', 'Anlagenstörung', 'Fallo de la instalación'),
  2: e(
    'Second heat generator mode',
    'Mode 2e générateur',
    'Betriebsart Zweiter Wärmeerzeuger',
    'Modo 2.º generador',
  ),
  3: e('Grid operator lock', 'Coupure fournisseur (EVU)', 'EVU-Sperre', 'Bloqueo de la compañía'),
  5: e('Air defrost', 'Dégivrage par l’air', 'Luftabtauung', 'Desescarche por aire'),
  6: e(
    'Maximum use temperature',
    'Température maximale d’utilisation',
    'Maximale Einsatztemperatur',
    'Temperatura máxima de uso',
  ),
  7: e(
    'Minimum use temperature',
    'Température minimale d’utilisation',
    'Minimale Einsatztemperatur',
    'Temperatura mínima de uso',
  ),
  8: e(
    'Lower use limit',
    'Limite basse d’utilisation',
    'Untere Einsatzgrenze',
    'Límite inferior de uso',
  ),
  9: e('No demand', 'Pas de demande', 'Keine Anforderung', 'Sin demanda'),
  10: e(
    'External energy source',
    'Source d’énergie externe',
    'Externe Energiequelle',
    'Fuente de energía externa',
  ),
  11: e('Flow rate', 'Débit', 'Durchfluss', 'Caudal'),
  12: e('Low pressure pause', 'Pause basse pression', 'Niederdruckpause', 'Pausa de baja presión'),
  13: e('Superheat pause', 'Pause surchauffe', 'Überhitzungspause', 'Pausa de recalentamiento'),
  14: e('Inverter pause', 'Pause onduleur', 'Inverterpause', 'Pausa del inversor'),
  15: e(
    'Desuperheater pause',
    'Pause désurchauffeur',
    'Enthitzerpause',
    'Pausa del desrecalentador',
  ),
  16: e('Changeover', 'Changement de mode', 'Umschaltung', 'Cambio de modo'),
  17: e('Other shutdown', 'Autre arrêt', 'Sonstige Abschaltung', 'Otra parada'),
  18: e(
    'Minimum cooling flow',
    'Départ minimal rafraîchissement',
    'Minimaler Vorlauf Kühlung',
    'Impulsión mínima refrigeración',
  ),
  19: e('Solar surplus maximum', 'Maximum photovoltaïque', 'PV-Maximum', 'Máximo fotovoltaico'),
  20: e('Hot gas pause', 'Pause gaz chauds', 'Heißgaspause', 'Pausa de gas caliente'),
  21: e(
    'Hot gas overheating pause',
    'Pause surchauffe gaz chauds',
    'Heißgas-Überhitzungspause',
    'Pausa por sobrecalentamiento del gas',
  ),
  22: e('No demand', 'Pas de demande', 'Keine Anforderung', 'Sin demanda'),
  23: e(
    'Heat source too cold for cooling',
    'Source trop froide en rafraîchissement',
    'Wärmequelle zu kalt für Kühlung',
    'Fuente demasiado fría para refrigerar',
  ),
  24: e(
    'Power limitation (LPC)',
    'Limitation de puissance (LPC)',
    'Leistungsbegrenzung (LPC)',
    'Limitación de potencia (LPC)',
  ),
  25: e('Restart', 'Redémarrage', 'Neustart', 'Reinicio'),
};

const unknownError = (code) =>
  e(`Error ${code}`, `Erreur ${code}`, `Fehler ${code}`, `Error ${code}`);
const unknownSwitchOff = (code) =>
  e(`Reason ${code}`, `Motif ${code}`, `Grund ${code}`, `Motivo ${code}`);

/**
 * @param {number} code - Error code (7xx).
 * @returns {{en: string, fr: string, de: string, es: string}} Its meaning.
 */
export const errorText = (code) => ERROR_CODES[code] ?? unknownError(code);

/**
 * @param {number} code - Switch-off reason.
 * @returns {{en: string, fr: string, de: string, es: string}} Its meaning.
 */
export const switchOffText = (code) => SWITCH_OFF_CODES[code] ?? unknownSwitchOff(code);
