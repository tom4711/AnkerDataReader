import { generateMockSample } from "@/lib/anker/mock";
import { getReadingCount, insertReading } from "@/lib/db";

/** Seed a short mock history so the chart is useful on first launch. */
export function seedMockHistoryIfEmpty(points = 36, stepMinutes = 5) {
  if (getReadingCount() > 0) return;
  const now = Date.now();
  for (let i = points; i >= 1; i--) {
    const at = new Date(now - i * stepMinutes * 60_000);
    const sample = generateMockSample(at);
    insertReading({
      recordedAt: at.toISOString(),
      source: "mock",
      siteName: sample.siteName,
      solarPowerW: sample.solarPowerW,
      batteryPowerW: sample.batteryPowerW,
      batterySocPercent: sample.batterySocPercent,
      homeLoadW: sample.homeLoadW,
      gridPowerW: sample.gridPowerW,
      meterPowerW: sample.meterPowerW,
      charging: sample.charging,
      rawJson: JSON.stringify(sample.raw),
    });
  }
}
