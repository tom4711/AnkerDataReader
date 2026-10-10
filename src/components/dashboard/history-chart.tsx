"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Reading } from "@/lib/types";

interface HistoryChartProps {
  readings: Reading[];
}

export function HistoryChart({ readings }: HistoryChartProps) {
  if (readings.length === 0) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
        Noch keine Verlaufsdaten. Warte auf den nächsten Poll oder starte einen manuell.
      </div>
    );
  }

  const data = readings.map((r) => ({
    t: new Date(r.recordedAt).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cloudSolar: r.cloud.solarPowerW ?? undefined,
    cloudBattery: r.cloud.batteryPowerW ?? undefined,
    cloudHome: r.cloud.homeLoadW ?? undefined,
    cloudGrid: r.cloud.gridPowerW ?? undefined,
    meter: r.meterPowerW ?? undefined,
    irradiance: r.weather?.shortwaveRadiationWm2 ?? undefined,
  }));
  const hasIrradiance = data.some((d) => d.irradiance != null);
  const hasMeter = data.some((d) => d.meter != null);

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(0.85 0.02 95)" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={28} />
          <YAxis
            yAxisId="power"
            tick={{ fontSize: 11 }}
            unit=" W"
            width={56}
            tickFormatter={(v) => `${Math.round(Number(v))}`}
          />
          {hasIrradiance ? (
            <YAxis
              yAxisId="irr"
              orientation="right"
              tick={{ fontSize: 11 }}
              unit=" W/m²"
              width={58}
              tickFormatter={(v) => `${Math.round(Number(v))}`}
            />
          ) : null}
          <Tooltip
            contentStyle={{
              background: "oklch(0.99 0.01 95)",
              border: "1px solid oklch(0.88 0.02 95)",
              borderRadius: 0,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const n = Math.round(Number(value));
              if (name === "Einstrahlung") return [`${n} W/m²`, name];
              return [`${n} W`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="cloudSolar"
            name="Solar (Cloud)"
            stroke="var(--solar)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="cloudBattery"
            name="Batterie (Cloud)"
            stroke="var(--battery)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="cloudHome"
            name="Haus (Cloud)"
            stroke="var(--home)"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="cloudGrid"
            name="Netz (Cloud)"
            stroke="var(--grid)"
            dot={false}
            strokeWidth={2}
          />
          {hasMeter ? (
            <Line
              yAxisId="power"
              type="monotone"
              dataKey="meter"
              name="Zähler (Meter)"
              stroke="var(--meter)"
              dot={false}
              strokeWidth={2.5}
              strokeDasharray="5 3"
            />
          ) : null}
          {hasIrradiance ? (
            <Line
              yAxisId="irr"
              type="monotone"
              dataKey="irradiance"
              name="Einstrahlung"
              stroke="oklch(0.55 0.12 75)"
              dot={false}
              strokeWidth={2}
              strokeDasharray="2 4"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
