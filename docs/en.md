# Luxtronik

## Overview

This integration brings heat pumps with a **Luxtronik 2.0 or 2.1** controller into Gladys, on your local network, without any cloud: Alpha Innotec, Novelan, Siemens, Buderus, Nibe AP, Roth, Elco, Wolf and other brands built on it.

Gladys reads the temperatures, the operating mode and status, the compressor and the backup heater, the error log, the power and energy counters when the controller has them, and can (only if you allow it) change the heating and hot water modes, the "temperature +/-", the hot water target and cooling.

Not affiliated with Alpha Innotec or the brands above.

![The “Heat pump”, “Heat pump curves”, “Heat pump energy” and “Heat pump log” widgets (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-luxtronik/main/docs/assets/widgets.en.png)

## Requirements

- Gladys Assistant 5.3.0 or later.
- The heat pump controller plugged into your network **with a cable** (Ethernet), on the same network as Gladys.
- A fixed IP address for the controller (a DHCP reservation in your router). It is shown on the controller, in **Service > Information > IP address**.
- Nothing to install on the controller: Gladys uses its built-in port 8889, the one of the Alpha Innotec tools and of the Home Assistant integrations.

## Configuration

### Heat pump

Type the IP address of the controller in **Address of the heat pump** (several heat pumps: separate the addresses with commas; add `:port` only if your installer changed port 8889), then press **Search and test the heat pumps**.

**Also search the network**: Gladys also sends the Alpha Innotec search message on UDP ports 4444 and 47808. Not every firmware answers it: the typed address is the reliable way.

**Reading interval**: how often the controller is read, from 30 seconds to 5 minutes. The controller copes badly with frequent requests: the integration opens one connection at a time and closes it after each reading.

### Changing settings

**Allow changes** is off by default: Gladys only reads. Once you tick it, the heating and hot water modes, the temperature +/-, the hot water target and cooling can be changed from Gladys. Each change is written to the memory of the controller, which wears out, so the integration:

- never writes a value that is already set;
- changes one setting at most every 2 minutes, and 50 settings a day at most;
- only accepts values within safe bounds (hot water 30 to 65 °C, temperature +/- −5 to +5 °C, cooling 18 to 30 °C) and refuses the others;
- reads the value back after writing it;
- never writes to firmware V1.90.x and V2.90.x, which crash on any change (update the firmware first).

**Language of the names and texts**: the language of the feature names, of the modes and of the error messages.

## Usage

### Devices

Open the **Discover** tab of the integration and add the devices of the heat pump:

- **Heat pump**: outdoor (and average outdoor), flow, return, return target, hot gas, heat source in and out temperatures, room temperature with a room unit, operating mode, status, last error, compressor and backup heater (on / off), electrical power and electricity used, heat output and heat produced (when the controller reports them), compressor hours and starts, backup heater hours.
- **Heat pump – heating**: heating mode (automatic, second heat source, party, holidays, off) and temperature +/- (the offset of the heating curve, as on the controller).
- **Heat pump – hot water** (if the heat pump makes hot water): temperature, target, mode, heating now.
- **Heat pump – cooling** (if it can cool): cooling on / off (automatic) and its target.

Add **Electricity used** to the energy monitoring of Gladys to see the consumption and the cost of the heat pump. **Heat produced** is the heat delivered (not electricity): it is kept for the history.

### Widgets

- **Heat pump**: what it does now: mode, status, compressor, backup heater, outdoor, flow, return and hot water temperatures, the power it draws.
- **Heat pump curves**: outdoor, flow, return and hot water temperatures over 24 hours, 3 or 7 days (the devices must be added).
- **Heat pump energy**: heat produced, electricity used, efficiency (heat ÷ electricity since commissioning), compressor hours and starts, backup heater hours.
- **Heat pump log**: the last errors and compressor stops of the controller, with their dates.

### Scenes

Triggers: **The heat pump reports an error** (a new entry in its error log, with the code and its meaning), **The heat pump changes operating mode** (filter on the new mode or the previous one: heating, hot water, defrost, grid lock, cooling, no demand…), **The backup heater switches on**, **The backup heater switches off** (with its run time), **The heat pump stops answering** (3 minutes), **The heat pump answers again**.

Action: **Read the heat pump** (mode, status, temperatures, hot water target, power, last error), for a message or a condition.

Examples:

- The heat pump reports an error → send a notification with `{{triggerEvent.data.error_text}}`.
- The backup heater switches on → send a message: electricity is expensive, check the heat pump.
- The heat pump changes to defrost → do not start the bathroom fan now.

## Troubleshooting

- **"No heat pump answers on port 8889"**: check the IP address on the controller, the network cable, and that nothing else (an old tool, another home automation system) keeps a connection open: the controller accepts few clients.
- **The network search finds nothing**: normal on some firmware; type the address.
- **"Changes are disabled"**: tick **Allow changes** in the settings.
- **"Firmware … crashes the controller"**: firmware V1.90 and V2.90 accept no change over the network; reading still works.
- **A value is missing** (room temperature, power, energy): your controller does not report it; a firmware update sometimes adds it.
- The **Search and test the heat pumps** button lists what the integration sees; the Logs tab of the integration tells more.

Report a problem on [GitHub](https://github.com/William-De71/gladys-luxtronik/issues) with your Gladys version, the integration version, the heat pump model, the firmware of the controller and the logs.
