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
    solar: r.solarPowerW,
    battery: r.batteryPowerW,
    grid: r.gridPowerW,
    home: r.homeLoadW,
    meter: r.meterPowerW ?? undefined,
  }));

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(0.85 0.02 95)" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={28} />
          <YAxis
            tick={{ fontSize: 11 }}
            unit=" W"
            width={56}
            tickFormatter={(v) => `${Math.round(Number(v))}`}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.99 0.01 95)",
              border: "1px solid oklch(0.88 0.02 95)",
              borderRadius: 0,
              fontSize: 12,
            }}
            formatter={(value) => [`${Math.round(Number(value))} W`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="solar" name="Solar" stroke="var(--solar)" dot={false} strokeWidth={2} />
          <Line
            type="monotone"
            dataKey="battery"
            name="Batterie"
            stroke="var(--battery)"
            dot={false}
            strokeWidth={2}
          />
          <Line type="monotone" dataKey="grid" name="Netz" stroke="var(--grid)" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="home" name="Haus" stroke="var(--home)" dot={false} strokeWidth={2} />
          <Line
            type="monotone"
            dataKey="meter"
            name="Zähler"
            stroke="var(--meter)"
            dot={false}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
