import type { NormalizedSample } from "@/lib/types";

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function firstOf<T>(list: unknown): T | null {
  return Array.isArray(list) && list.length > 0 ? (list[0] as T) : null;
}

/**
 * Maps Anker get_scen_info / site homepage payloads into a flat sample.
 * Field names vary slightly across Solarbank generations; we tolerate missing keys.
 */
export function normalizeSceneInfo(payload: unknown, fallbackSiteName = "Anker System"): NormalizedSample {
  const root = (payload as { data?: Record<string, unknown> })?.data ?? (payload as Record<string, unknown>);
  const homeInfo = (root?.home_info || {}) as Record<string, unknown>;
  const siteName = String(
    root?.site_name || root?.siteName || homeInfo.site_name || fallbackSiteName,
  );

  const solarbankInfo = (root?.solarbank_info || root?.solarbankInfo || {}) as Record<string, unknown>;
  const solarbank = firstOf<Record<string, unknown>>(solarbankInfo.solarbank_list) || {};
  const gridInfo = (root?.grid_info || root?.gridInfo || {}) as Record<string, unknown>;
  const smartMeter = firstOf<Record<string, unknown>>(
    (root?.smart_meter_info as { smartmeter_list?: unknown })?.smartmeter_list ||
      (root as { smartmeter_list?: unknown }).smartmeter_list,
  );

  const solarPowerW = num(
    solarbankInfo.total_photovoltaic_power ??
      solarbank.photovoltaic_power ??
      solarbank.pv_power ??
      root.solar_power,
  );

  // Convention in community parsers: positive battery power often means discharging.
  const batteryPowerW = num(
    solarbankInfo.total_battery_power ??
      solarbank.battery_power ??
      solarbank.bat_power ??
      root.battery_power,
  );

  const batterySocPercent = num(
    solarbank.battery_percentage ??
      solarbank.battery_soc ??
      solarbankInfo.total_battery_percentage ??
      root.battery_soc,
  );

  const homeLoadW = num(
    root.home_load_power ??
      root.to_home_load ??
      solarbankInfo.to_home_load ??
      gridInfo.home_load_power,
  );

  const gridPowerW = num(
    gridInfo.grid_to_home_power ??
      gridInfo.photovoltaic_to_grid_power ??
      root.grid_power ??
      smartMeter?.grid_to_home_power,
  );

  const meterPowerWRaw =
    smartMeter?.current_power ??
    smartMeter?.grid_to_home_power ??
    gridInfo.grid_to_home_power ??
    null;
  const meterPowerW = meterPowerWRaw == null ? null : num(meterPowerWRaw);

  const chargingFlag = num(solarbank.charging_status ?? solarbank.status ?? 0);
  const charging = chargingFlag === 1 || batteryPowerW < 0;

  return {
    siteName,
    solarPowerW,
    batteryPowerW,
    batterySocPercent,
    homeLoadW,
    gridPowerW,
    meterPowerW,
    charging,
    raw: payload,
  };
}
