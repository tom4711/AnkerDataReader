# AnkerDataReader

Kleines lokales Tool, um Messwerte von **Anker Solarbank 2 E1600 Pro** und **Anker Smart Meter Gen 2** häufiger abzufragen als die ~20‑Minuten-Historie in der Anker-App, lokal zu speichern und anzuzeigen.

## Schnellstart

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

App: [http://127.0.0.1:43127](http://127.0.0.1:43127)

Standardmodus ist **Mock/Demo** — die UI läuft ohne Anker-Konto und ohne Heimnetz.

## Datenquellen

| Modus | Env `DATA_SOURCE` | Was passiert |
| --- | --- | --- |
| Mock | `mock` (default) | Realistische Demo-Kurve, SQLite-Historie |
| Cloud | `cloud` | Anker Power Cloud API (`get_site_list` + `get_scen_info`) |
| LAN | `lan` | Modbus TCP zum Smart Meter Gen 2; SB2-IP nur Probe/Inventar |

### Heimnetz-IPs (Defaults)

| Gerät | Default IP | Port |
| --- | --- | --- |
| Solarbank 2 E1600 Pro | `192.168.178.190` | 502 (Probe; kein öffentliches SB2-LAN-API) |
| Smart Meter Gen 2 | `192.168.178.83` | 502 (Modbus TCP) |

Konfigurierbar über `.env.local` (`SOLARBANK_HOST`, `SMART_METER_HOST`, …) oder die Einstellungen in der UI.

**Wichtig:** Eine Cloud-VM erreicht private `192.168.x.x`-Adressen nicht. LAN-Modus auf einem Rechner im Heimnetz (oder per VPN) starten. Modbus TCP am Smart Meter in der Anker-App unter Drittanbieter-/Modbus-Kontrolle aktivieren.

### Cloud-Zugang

```bash
DATA_SOURCE=cloud
ANKER_EMAIL=you@example.com
ANKER_PASSWORD=...
ANKER_COUNTRY=DE
```

Empfehlung: geteiltes Anker-Konto (System freigeben) nutzen — nur ein gleichzeitiger Login ist stabil. SB2 aktualisiert die Cloud typischerweise alle ~5 Minuten; Polling alle 60 s speichert trotzdem dichter und fängt Updates schneller ein als die App-Tagesansicht.

## Poll-Intervall

Default **60 Sekunden** (UI/API, min. 15 s). Klar unter den ~20 Min. der App-Historie.

## Speicher

Lokale SQLite-Datei unter `data/readings.sqlite` (gitignored). Auth-Cache: `data/anker-auth.json`.

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui · Recharts · better-sqlite3 · modbus-serial
