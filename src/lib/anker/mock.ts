import type { NormalizedSample } from "@/lib/types";

/** Deterministic-ish solar day curve for demos without credentials. */
export function generateMockSample(now = new Date()): NormalizedSample {
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const dayAngle = ((minutes - 6 * 60) / (12 * 60)) * Math.PI; // sunrise~6 to sunset~18
  const sunFactor = Math.max(0, Math.sin(dayAngle));
  const wobble = Math.sin(minutes / 7) * 40 + Math.sin(minutes / 3.5) * 25;

  const solarPowerW = Math.round(sunFactor * 920 + wobble * sunFactor);
  const homeLoadW = Math.round(180 + Math.abs(Math.sin(minutes / 11)) * 420 + (minutes % 17));
  const surplus = solarPowerW - homeLoadW;

  let batteryPowerW = 0;
  let gridPowerW = 0;
  let batterySocPercent = 35 + sunFactor * 45 + Math.sin(minutes / 40) * 5;

  if (surplus > 40) {
    // Charge from surplus; residual to grid (negative = export).
    batteryPowerW = -Math.min(surplus, 800);
    gridPowerW = -(surplus + batteryPowerW);
  } else if (surplus < -40) {
    // Discharge to cover load; remainder from grid.
    batteryPowerW = Math.min(-surplus, 800);
    gridPowerW = -surplus - batteryPowerW;
  } else {
    gridPowerW = -surplus;
  }

  batterySocPercent = Math.max(8, Math.min(100, batterySocPercent));
  const cloudGrid = Math.round(gridPowerW);
  // Simulate slight live-meter offset vs "cloud" grid for demo charts.
  const meterPowerW = cloudGrid + Math.round(Math.sin(minutes / 5) * 35);

  return {
    siteName: "Demo Solarbank 2 + Smart Meter",
    cloud: {
      solarPowerW: Math.max(0, solarPowerW),
      batteryPowerW: Math.round(batteryPowerW),
      batterySocPercent: Math.round(batterySocPercent * 10) / 10,
      homeLoadW: Math.max(0, homeLoadW),
      gridPowerW: cloudGrid,
    },
    meterPowerW,
    charging: batteryPowerW < 0,
    raw: {
      mode: "mock",
      generatedAt: now.toISOString(),
      note: "Simulated Solarbank 2 E1600 Pro + Smart Meter Gen 2 values (cloud vs meter separated)",
    },
  };
}
