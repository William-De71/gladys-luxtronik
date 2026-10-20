#!/usr/bin/env bash
# Check the fake controller of the tests against python-luxtronik, the library
# of the Home Assistant integrations: it must read the same values and write
# a parameter. Needs python3 (a throw-away virtualenv is created).
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'kill "${fake_pid:-0}" 2>/dev/null || true; rm -rf "$work"' EXIT
python3 -m venv "$work/venv"
"$work/venv/bin/pip" install --quiet 'luxtronik==0.3.14'
port=18889
node scripts/fake-controller.mjs "$port" > /dev/null &
fake_pid=$!
sleep 1
cat > "$work/check.py" <<'PY'
import sys
from luxtronik import Luxtronik
lux = Luxtronik("127.0.0.1", int(sys.argv[1]), safe=False)
c, p = lux.calculations, lux.parameters
expected = {
    "ID_WEB_Temperatur_TVL": 35.2,
    "ID_WEB_Temperatur_TA": 4.2,
    "ID_WEB_Temperatur_TBW": 47.8,
    "ID_WEB_SoftStand": "V3.90.1",
    "ID_WEB_WP_BZ_akt": "heating",
    "ID_WEB_WMZ_Seit": 15802.3,
    "ID_WEB_ERROR_Nr0": 717,
    "Heat_Output": 5400,
}
for name, value in expected.items():
    assert c.get(name).value == value, (name, c.get(name).value)
assert p.get("ID_Einst_WK_akt").value == 1.0
assert p.get("ID_Ba_Hz_akt").value == "Automatic"
assert p.get("ID_Soll_BWS_akt").value == 48.0
p.set("ID_Soll_BWS_akt", 50.5)
lux.write()
lux.read()
assert lux.parameters.get("ID_Soll_BWS_akt").value == 50.5
print("python-luxtronik reads and writes the fake controller: OK")
PY
(cd "$work" && venv/bin/python -I check.py "$port")
