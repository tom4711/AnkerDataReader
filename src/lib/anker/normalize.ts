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
 * Maps Anker get_scen_info / site homepage payloads into cloud channels only.
 * Meter watts belong on the LAN Modbus path — not here.
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

  const solarPowerW = num(
    solarbankInfo.total_photovoltaic_power ??
      solarbank.photovoltaic_power ??
      solarbank.pv_power ??
      root.solar_power,
  );

  // Battery *power* (W). Note: Anker's `battery_power` / `total_battery_power`
  // on Solarbank 2 are SoC (percent or 0–1 fraction), not watts.
  const dischargeW = num(
    solarbankInfo.battery_discharge_power ?? solarbank.bat_discharge_power,
  );
  const chargeW = num(
    solarbankInfo.total_charging_power ??
      solarbank.bat_charge_power ??
      solarbank.charging_power,
  );
  const batteryPowerW =
    dischargeW > 0 ? dischargeW : chargeW > 0 ? -chargeW : num(solarbank.bat_power);

  // SoC: device `battery_power` is typically 0–100; site `total_battery_power` is 0–1.
  const explicitSoc = num(
    solarbank.battery_percentage ??
      solarbank.battery_soc ??
      solarbankInfo.total_battery_percentage ??
      root.battery_soc,
  );
  const deviceBatField = num(solarbank.battery_power);
  const totalBatField = num(solarbankInfo.total_battery_power);
  let batterySocPercent = explicitSoc;
  if (!batterySocPercent) {
    if (deviceBatField > 1 && deviceBatField <= 100) batterySocPercent = deviceBatField;
    else if (totalBatField > 0 && totalBatField <= 1) batterySocPercent = totalBatField * 100;
    else if (deviceBatField > 0 && deviceBatField <= 1) batterySocPercent = deviceBatField * 100;
  }

  const homeLoadW = num(
    root.home_load_power ??
      root.other_loads_power ??
      root.to_home_load ??
      solarbankInfo.to_home_load ??
      gridInfo.home_load_power,
  );

  const gridPowerW = num(
    gridInfo.grid_to_home_power ??
      root.grid_power ??
      gridInfo.photovoltaic_to_grid_power,
  );

  const chargingFlag = num(solarbank.charging_status ?? solarbank.status ?? 0);
  const charging = chargingFlag === 1 || batteryPowerW < 0;

  return {
    siteName,
    cloud: {
      solarPowerW,
      batteryPowerW,
      batterySocPercent,
      homeLoadW,
      gridPowerW,
    },
    meterPowerW: null,
    charging,
    raw: payload,
  };
}
