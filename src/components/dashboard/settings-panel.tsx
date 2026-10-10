"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppConfig, DataSourceMode } from "@/lib/types";

interface SettingsPanelProps {
  config: AppConfig;
  ankerConfigured: boolean;
  onSaved: () => void;
}

export function SettingsPanel({ config, ankerConfigured, onSaved }: SettingsPanelProps) {
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(config.pollIntervalSeconds);
  const [dataSource, setDataSource] = useState<DataSourceMode>(config.dataSource);
  const [solarbankHost, setSolarbankHost] = useState(config.devices.solarbankHost);
  const [smartMeterHost, setSmartMeterHost] = useState(config.devices.smartMeterHost);
  const [smartMeterPort, setSmartMeterPort] = useState(config.devices.smartMeterPort);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollIntervalSeconds,
          dataSource,
          devices: {
            solarbankHost,
            smartMeterHost,
            smartMeterPort,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ? JSON.stringify(json.error) : "Speichern fehlgeschlagen");
      setOk("Einstellungen gespeichert. Poller neu gestartet.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-border/70 space-y-4 border border-solid bg-background/50 p-4 backdrop-blur-sm sm:p-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">Einstellungen</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Poll-Intervall, Datenquelle und lokale Geräte-IPs. Bei Apple Sign-In: LAN/Modbus
          bevorzugen (Cloud braucht E‑Mail/Passwort). Standard-IPs: Solarbank{" "}
          <code className="text-foreground">192.168.178.190</code>, Smart Meter{" "}
          <code className="text-foreground">192.168.178.83</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="interval">Poll-Intervall (Sekunden)</Label>
          <Input
            id="interval"
            type="number"
            min={15}
            max={3600}
            value={pollIntervalSeconds}
            onChange={(e) => setPollIntervalSeconds(Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            Min. 15 s. Smart Meter ist live per Modbus; Hausverbrauch/Netz/Solar/SoC wie in der Anker-App
            (Cloud, oft ~5 Min.).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Datenquelle</Label>
          <Select value={dataSource} onValueChange={(v) => setDataSource(v as DataSourceMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Mock / Demo (ohne Geräte)</SelectItem>
              <SelectItem value="lan">LAN Modbus (Smart Meter) — empfohlen</SelectItem>
              <SelectItem value="cloud">Anker Cloud API (Passwort-Konto)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Cloud: {ankerConfigured ? "Zugangsdaten gesetzt" : "kein Passwort-Konto (Apple Sign-In reicht nicht)"}.
            Optional: System an ein E‑Mail/Passwort-Zweitkonto freigeben.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sb-host">Solarbank 2 IP</Label>
          <Input
            id="sb-host"
            value={solarbankHost}
            onChange={(e) => setSolarbankHost(e.target.value)}
            placeholder="192.168.178.190"
          />
          <p className="text-muted-foreground text-xs">
            SB2 hat kein öffentliches LAN-API; IP wird für Inventar/Probe gespeichert.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meter-host">Smart Meter Gen 2 IP</Label>
          <div className="flex gap-2">
            <Input
              id="meter-host"
              value={smartMeterHost}
              onChange={(e) => setSmartMeterHost(e.target.value)}
              placeholder="192.168.178.83"
              className="flex-1"
            />
            <Input
              type="number"
              aria-label="Modbus-Port"
              className="w-24"
              value={smartMeterPort}
              onChange={(e) => setSmartMeterPort(Number(e.target.value))}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Modbus TCP Port 502 — in der Anker-App unter Drittanbieter-/Modbus-Kontrolle aktivieren. Nur im
            Heimnetz erreichbar.
          </p>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {ok ? <p className="text-sm text-[var(--battery)]">{ok}</p> : null}

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Speichern…" : "Einstellungen speichern"}
      </Button>
    </section>
  );
}
