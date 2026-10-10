"use client";

import { useCallback, useEffect, useState } from "react";
import { HistoryChart } from "@/components/dashboard/history-chart";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatIrradiance,
  formatPercent,
  formatTempC,
  formatTime,
  formatWatts,
  gridLabel,
  weatherCodeLabel,
} from "@/lib/format";
import type { AppConfig, PollStatus, Reading } from "@/lib/types";

interface StatusResponse {
  status: PollStatus;
  config: AppConfig;
  credentials: { ankerConfigured: boolean };
}

interface ReadingsResponse {
  latest: Reading | null;
  readings: Reading[];
}

export function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [readings, setReadings] = useState<ReadingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, readingsRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }),
        fetch("/api/readings?hours=24", { cache: "no-store" }),
      ]);
      if (!statusRes.ok || !readingsRes.ok) {
        throw new Error("API antwortet nicht korrekt");
      }
      setStatus((await statusRes.json()) as StatusResponse);
      setReadings((await readingsRes.json()) as ReadingsResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void refresh();
    }, 0);
    const id = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [refresh]);

  async function manualPoll() {
    setPolling(true);
    try {
      await fetch("/api/poll", { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolling(false);
    }
  }

  const latest = readings?.latest ?? null;
  const mode = status?.status.mode;

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_-10%,oklch(0.93_0.06_95),transparent_55%),radial-gradient(90%_70%_at_90%_0%,oklch(0.9_0.05_220),transparent_50%),linear-gradient(180deg,oklch(0.98_0.02_95),oklch(0.95_0.03_140))]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(115deg,transparent_0_18px,oklch(0.35_0.04_140)_18px_19px)]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-8 pb-4 sm:px-6 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-heading text-4xl font-semibold tracking-tight text-[oklch(0.28_0.05_140)] sm:text-5xl">
              AnkerDataReader
            </p>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm sm:text-base">
              Kürzere Messintervalle für Solarbank 2 E1600 Pro und Smart Meter Gen 2 — lokal speichern und
              anzeigen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode ? (
              <Badge variant="secondary" className="rounded-none">
                Modus: {mode}
              </Badge>
            ) : null}
            <Badge variant="outline" className="rounded-none">
              Intervall: {status?.status.pollIntervalSeconds ?? "—"} s
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void manualPoll()} disabled={polling}>
              {polling ? "Poll…" : "Jetzt abfragen"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 sm:px-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-none" />
            ))}
          </div>
        ) : null}

        {!loading && error && !latest ? (
          <div className="border-destructive/40 bg-destructive/5 border border-solid p-4 text-sm">
            <p className="font-medium">Fehler beim Laden</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            <Button className="mt-3" size="sm" onClick={() => void refresh()}>
              Erneut versuchen
            </Button>
          </div>
        ) : null}

        {!loading && !latest ? (
          <div className="border-border/70 bg-background/60 border border-dashed p-6 text-sm">
            <p className="font-heading text-base font-semibold">Noch keine Messwerte</p>
            <p className="text-muted-foreground mt-1">
              Der Poller startet automatisch. Im Mock-Modus erscheinen Demo-Werte innerhalb einer Minute —
              oder tippe auf „Jetzt abfragen“.
            </p>
          </div>
        ) : null}

        {latest ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                label="Solar (Cloud)"
                value={formatWatts(latest.cloud.solarPowerW)}
                hint={latest.siteName}
                accent="solar"
              />
              <MetricTile
                label="Batterie (Cloud)"
                value={formatWatts(latest.cloud.batteryPowerW)}
                hint={`SoC ${formatPercent(latest.cloud.batterySocPercent)} · ${latest.charging ? "lädt" : "entlädt/ruhe"}`}
                accent="battery"
              />
              <MetricTile
                label="Hausverbrauch (Cloud)"
                value={formatWatts(latest.cloud.homeLoadW)}
                hint="Anker-App / Cloud"
                accent="home"
              />
              <MetricTile
                label="Netz (Cloud)"
                value={formatWatts(latest.cloud.gridPowerW)}
                hint={`${gridLabel(latest.cloud.gridPowerW ?? 0)} · Anker-App`}
                accent="grid"
              />
              <MetricTile
                label="Zähler (Meter)"
                value={formatWatts(latest.meterPowerW)}
                hint="live Modbus · positiv = Bezug"
                accent="meter"
              />
              <MetricTile
                label="Letzte Messung"
                value={formatTime(latest.recordedAt)}
                hint={`Quelle: ${latest.source} · ${status?.status.readingCount ?? 0} Punkte`}
                accent="solar"
              />
              <MetricTile
                label="Wetter"
                value={formatTempC(latest.weather?.temperatureC ?? status?.status.weather?.temperatureC)}
                hint={
                  latest.weather || status?.status.weather
                    ? `${weatherCodeLabel((latest.weather ?? status?.status.weather)?.weatherCode)} · Wolken ${formatPercent((latest.weather ?? status?.status.weather)?.cloudCoverPercent)} · ${formatIrradiance((latest.weather ?? status?.status.weather)?.shortwaveRadiationWm2)} · ${(latest.weather ?? status?.status.weather)?.locationLabel ?? "—"}`
                    : "noch kein Wetterpunkt"
                }
                accent="home"
              />
            </section>

            <section className="border-border/70 bg-background/50 border border-solid p-4 backdrop-blur-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-semibold">Verlauf (24 h)</h2>
                  <p className="text-muted-foreground text-sm">
                    Solar, Batterie, Netz, Haus und Zähler — lokal in SQLite gespeichert.
                  </p>
                </div>
                {status?.status.lastError ? (
                  <p className="text-destructive max-w-md text-xs">{status.status.lastError}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Nächster Poll: {formatTime(status?.status.nextPollAt)}
                  </p>
                )}
              </div>
              <HistoryChart readings={readings?.readings ?? []} />
            </section>
          </>
        ) : null}

        {status ? (
          <section className="border-border/70 bg-background/40 grid gap-3 border border-solid p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-heading font-semibold">Geräte-IPs</p>
              <p className="text-muted-foreground mt-1">
                Solarbank: {status.status.devices.solarbankHost}:{status.status.devices.solarbankPort}
              </p>
              <p className="text-muted-foreground">
                Smart Meter: {status.status.devices.smartMeterHost}:
                {status.status.devices.smartMeterPort}
              </p>
            </div>
            <div>
              <p className="font-heading font-semibold">LAN-Hinweis</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {status.status.lan.note}
              </p>
            </div>
          </section>
        ) : null}

        {status ? (
          <SettingsPanel
            config={status.config}
            ankerConfigured={status.credentials.ankerConfigured}
            onSaved={() => void refresh()}
          />
        ) : null}
      </main>
    </div>
  );
}
