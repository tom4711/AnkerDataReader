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

## Apple Sign-In (wichtig)

Wenn dein Anker-Konto nur über **Sign in with Apple** läuft (kein E‑Mail/Passwort), ist der Cloud-Pfad (`ANKER_EMAIL` / `ANKER_PASSWORD`) **nicht der Primärweg** — die inoffizielle Cloud-API braucht ein Passwort-Login.

| Option | Zweck |
| --- | --- |
| **(a) LAN / Modbus** | Live-Daten: App im Heimnetz, `DATA_SOURCE=lan`, Modbus am Smart Meter Gen 2 aktivieren |
| **(b) Cloud über Zweitkonto** | System in der Anker-App an ein E‑Mail/Passwort-Konto freigeben → dann `DATA_SOURCE=cloud` |
| **(c) Mock** | UI/Demo ohne Geräte |

Praktischer Workaround: zweites Anker-Konto mit E‑Mail+Passwort anlegen, Power-System freigeben, dieses Konto nur für API-Polling nutzen. Apple-Login liefert keinen Token/Passwort für dieses Tool. Solarbank 2 hat kein öffentliches LAN-API; der Smart Meter Gen 2 schon (Modbus TCP).

## Datenquellen

| Modus | Env `DATA_SOURCE` | Was passiert |
| --- | --- | --- |
| Mock | `mock` (default) | Realistische Demo-Kurve, SQLite-Historie |
| LAN | `lan` **(empfohlen bei Apple Sign-In)** | Modbus TCP zum Smart Meter Gen 2; SB2-IP nur Probe/Inventar |
| Cloud | `cloud` | Anker Power Cloud API — nur mit Passwort-Konto / freigegebenem Zweitkonto |

### Heimnetz-IPs (Defaults)

| Gerät | Default IP | Port |
| --- | --- | --- |
| Solarbank 2 E1600 Pro | `192.168.178.190` | 502 (Probe; kein öffentliches SB2-LAN-API) |
| Smart Meter Gen 2 | `192.168.178.83` | 502 (Modbus TCP) |

Konfigurierbar über `.env.local` (`SOLARBANK_HOST`, `SMART_METER_HOST`, …) oder die Einstellungen in der UI.

**Wichtig:** Eine Cloud-VM erreicht private `192.168.x.x`-Adressen nicht. LAN-Modus auf einem Rechner im Heimnetz (oder per VPN) starten. Modbus TCP am Smart Meter in der Anker-App unter Drittanbieter-/Modbus-Kontrolle aktivieren.

### Cloud-Zugang (optional, Passwort-Konto)

```bash
DATA_SOURCE=cloud
ANKER_EMAIL=you@example.com
ANKER_PASSWORD=...
ANKER_COUNTRY=DE
```

Nicht mit Apple Sign-In allein nutzbar. Empfehlung: geteiltes Zweitkonto — nur ein gleichzeitiger Login-Token ist oft stabil.

## Poll-Intervall

Default **60 Sekunden** (UI/API, min. 15 s). Klar unter den ~20 Min. der App-Historie. Mit LAN/Modbus oft frischer als Cloud-SB2 (~5 Min. Cloud-Update).

## Speicher

Lokale SQLite-Datei unter `data/readings.sqlite` (gitignored). Auth-Cache: `data/anker-auth.json`.

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui · Recharts · better-sqlite3 · modbus-serial
