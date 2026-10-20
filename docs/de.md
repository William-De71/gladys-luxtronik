# Luxtronik

## Überblick

Diese Integration bringt Wärmepumpen mit einem **Luxtronik 2.0 oder 2.1** Regler in Gladys, im lokalen Netzwerk, ganz ohne Cloud: Alpha Innotec, Novelan, Siemens, Buderus, Nibe AP, Roth, Elco, Wolf und weitere Marken, die ihn verwenden.

Gladys liest die Temperaturen, den Betriebszustand und Status, Verdichter und Zusatzheizung, den Fehlerspeicher, die Leistungs- und Energiezähler, sofern der Regler sie liefert, und kann (nur wenn Sie es erlauben) die Betriebsarten Heizung und Warmwasser, „Temperatur +/-“, das Warmwasser-Soll und die Kühlung ändern.

Nicht mit Alpha Innotec oder den genannten Marken verbunden.

![Die Widgets „Wärmepumpe“, „Wärmepumpen-Verlauf“, „Wärmepumpen-Energie“ und „Wärmepumpen-Protokoll“ (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-luxtronik/main/docs/assets/widgets.de.png)

## Voraussetzungen

- Gladys Assistant 5.1.0 oder neuer.
- Der Regler der Wärmepumpe **per Kabel** (Ethernet) mit Ihrem Netzwerk verbunden, im selben Netzwerk wie Gladys.
- Eine feste IP-Adresse für den Regler (DHCP-Reservierung im Router). Sie steht am Regler unter **Service > Information > IP-Adresse**.
- Am Regler ist nichts zu installieren: Gladys nutzt seinen eingebauten Port 8889, den der Alpha-Innotec-Werkzeuge und der Home-Assistant-Integrationen.

## Konfiguration

### Wärmepumpe

Geben Sie die IP-Adresse des Reglers unter **Adresse der Wärmepumpe** ein (mehrere Wärmepumpen: Adressen durch Kommas trennen; `:Port` nur angeben, wenn Ihr Installateur Port 8889 geändert hat) und drücken Sie **Wärmepumpen suchen und testen**.

**Auch im Netzwerk suchen**: Gladys sendet zusätzlich die Alpha-Innotec-Suchnachricht an die UDP-Ports 4444 und 47808. Nicht jede Firmware antwortet: Die eingegebene Adresse ist der zuverlässige Weg.

**Leseintervall**: wie oft der Regler gelesen wird, von 30 Sekunden bis 5 Minuten. Häufige Anfragen verträgt der Regler schlecht: Die Integration öffnet immer nur eine Verbindung und schließt sie nach jeder Lesung.

### Einstellungen ändern

**Änderungen erlauben** ist standardmäßig aus: Gladys liest nur. Sobald Sie es aktivieren, lassen sich die Betriebsarten Heizung und Warmwasser, Temperatur +/-, das Warmwasser-Soll und die Kühlung aus Gladys steuern. Jede Änderung wird in den Speicher des Reglers geschrieben, der sich abnutzt, daher:

- wird ein bereits gesetzter Wert nie erneut geschrieben;
- wird dieselbe Einstellung höchstens alle 2 Minuten geändert, und höchstens 50 Einstellungen pro Tag;
- werden nur Werte in sicheren Grenzen angenommen (Warmwasser 30 bis 65 °C, Temperatur +/- −5 bis +5 °C, Kühlung 18 bis 30 °C), andere abgelehnt;
- wird der Wert nach dem Schreiben zurückgelesen;
- wird nie auf Firmware V1.90.x und V2.90.x geschrieben, die bei jeder Änderung abstürzt (zuerst die Firmware aktualisieren).

**Sprache der Namen und Texte**: die Sprache der Funktionsnamen, der Betriebsarten und der Fehlermeldungen.

## Verwendung

### Geräte

Öffnen Sie den Tab **Erkennung** der Integration und fügen Sie die Geräte der Wärmepumpe hinzu:

- **Wärmepumpe**: Außen- (und mittlere Außen-), Vorlauf-, Rücklauf-, Rücklauf-Soll-, Heißgas-, Wärmequellen-Ein- und Austrittstemperatur, Raumtemperatur mit Raumbedieneinheit, Betriebszustand, Status, letzter Fehler, Verdichter und Zusatzheizung (ein / aus), elektrische Leistung und verbrauchter Strom, Heizleistung und erzeugte Wärme (wenn der Regler sie liefert), Betriebsstunden und Starts des Verdichters, Stunden der Zusatzheizung.
- **Wärmepumpe – Heizung**: Betriebsart Heizung (Automatik, zweiter Wärmeerzeuger, Party, Ferien, aus) und Temperatur +/- (die Verschiebung der Heizkurve, wie am Regler).
- **Wärmepumpe – Warmwasser** (wenn die Wärmepumpe Warmwasser bereitet): Temperatur, Soll, Betriebsart, Bereitung läuft.
- **Wärmepumpe – Kühlung** (wenn sie kühlen kann): Kühlung ein / aus (Automatik) und ihr Soll.

Fügen Sie **Verbrauchter Strom** der Energieüberwachung von Gladys hinzu, um Verbrauch und Kosten der Wärmepumpe zu sehen. **Erzeugte Wärme** ist die abgegebene Wärme (kein Strom): Sie dient dem Verlauf.

### Widgets

- **Wärmepumpe**: was sie gerade tut: Betriebszustand, Status, Verdichter, Zusatzheizung, Außen-, Vorlauf-, Rücklauf- und Warmwassertemperatur, Leistungsaufnahme.
- **Wärmepumpen-Verlauf**: Außen-, Vorlauf-, Rücklauf- und Warmwassertemperatur über 24 Stunden, 3 oder 7 Tage (die Geräte müssen hinzugefügt sein).
- **Wärmepumpen-Energie**: erzeugte Wärme, verbrauchter Strom, Arbeitszahl (Wärme ÷ Strom seit Inbetriebnahme), Stunden und Starts des Verdichters, Stunden der Zusatzheizung.
- **Wärmepumpen-Protokoll**: die letzten Fehler und Verdichter-Abschaltungen des Reglers mit Datum.

### Szenen

Auslöser: **Die Wärmepumpe meldet einen Fehler** (ein neuer Eintrag im Fehlerspeicher, mit Code und Bedeutung), **Die Wärmepumpe wechselt den Betriebszustand** (Filter auf den neuen oder vorherigen Zustand: Heizen, Warmwasser, Abtauen, EVU-Sperre, Kühlen, keine Anforderung…), **Die Zusatzheizung schaltet ein**, **Die Zusatzheizung schaltet aus** (mit Laufzeit), **Die Wärmepumpe antwortet nicht mehr** (3 Minuten), **Die Wärmepumpe antwortet wieder**.

Aktion: **Wärmepumpe auslesen** (Betriebszustand, Status, Temperaturen, Warmwasser-Soll, Leistung, letzter Fehler), für eine Nachricht oder eine Bedingung.

Beispiele:

- Die Wärmepumpe meldet einen Fehler → eine Benachrichtigung mit `{{triggerEvent.data.error_text}}` senden.
- Die Zusatzheizung schaltet ein → eine Nachricht senden: Strom ist teuer, Wärmepumpe prüfen.
- Die Wärmepumpe wechselt ins Abtauen → den Badlüfter jetzt nicht starten.

## Fehlerbehebung

- **„Unter den eingegebenen Adressen antwortet keine Wärmepumpe auf Port 8889“**: Prüfen Sie die IP-Adresse am Regler, das Netzwerkkabel und dass nichts anderes (ein altes Werkzeug, ein anderes Smart-Home-System) eine Verbindung offen hält: Der Regler akzeptiert nur wenige Clients.
- **Die Netzwerksuche findet nichts**: bei manchen Firmwares normal; geben Sie die Adresse ein.
- **„Änderungen sind deaktiviert“**: Aktivieren Sie **Änderungen erlauben** in den Einstellungen.
- **„Firmware … lässt den Regler abstürzen“**: Firmware V1.90 und V2.90 nimmt keine Änderungen über das Netzwerk an; Lesen funktioniert.
- **Ein Wert fehlt** (Raumtemperatur, Leistung, Energie): Ihr Regler liefert ihn nicht; ein Firmware-Update fügt ihn manchmal hinzu.
- Die Schaltfläche **Wärmepumpen suchen und testen** zeigt, was die Integration sieht; der Tab Logs der Integration sagt mehr.

Melden Sie Probleme auf [GitHub](https://github.com/William-De71/gladys-luxtronik/issues) mit Ihrer Gladys-Version, der Version der Integration, dem Wärmepumpenmodell, der Firmware des Reglers und den Logs.
