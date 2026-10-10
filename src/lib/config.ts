import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AppConfig, DataSourceMode, DeviceEndpoints } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

/** User home LAN defaults (FritzBox .178 net). Cloud VMs cannot reach these. */
export const DEFAULT_DEVICES: DeviceEndpoints = {
  solarbankHost: "192.168.178.190",
  solarbankPort: 502,
  smartMeterHost: "192.168.178.83",
  smartMeterPort: 502,
  modbusUnitId: 1,
};

const DEFAULT_CONFIG: AppConfig = {
  pollIntervalSeconds: 60,
  dataSource: "mock",
  ankerCountry: "DE",
  siteId: null,
  maxReadings: 10_000,
  devices: DEFAULT_DEVICES,
};

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function resolveDataSource(
  envMode: string | undefined,
  stored: DataSourceMode,
): DataSourceMode {
  if (envMode === "mock" || envMode === "cloud" || envMode === "lan") return envMode;
  // Legacy alias from earlier docs/env naming.
  if (envMode === "anker") return "cloud";
  if (process.env.ANKER_EMAIL && process.env.ANKER_PASSWORD && stored === "mock") {
    // Prefer explicit stored/env mode; only auto-upgrade when credentials exist and
    // the user has not chosen lan/mock in config yet — keep mock as safe default.
  }
  return stored;
}

function mergeDevices(partial?: Partial<DeviceEndpoints> | null): DeviceEndpoints {
  return {
    ...DEFAULT_DEVICES,
    ...(partial || {}),
    solarbankHost:
      process.env.SOLARBANK_HOST?.trim() ||
      partial?.solarbankHost ||
      DEFAULT_DEVICES.solarbankHost,
    smartMeterHost:
      process.env.SMART_METER_HOST?.trim() ||
      partial?.smartMeterHost ||
      DEFAULT_DEVICES.smartMeterHost,
    solarbankPort: Number(
      process.env.SOLARBANK_PORT || partial?.solarbankPort || DEFAULT_DEVICES.solarbankPort,
    ),
    smartMeterPort: Number(
      process.env.SMART_METER_PORT ||
        partial?.smartMeterPort ||
        DEFAULT_DEVICES.smartMeterPort,
    ),
    modbusUnitId: Number(
      process.env.MODBUS_UNIT_ID || partial?.modbusUnitId || DEFAULT_DEVICES.modbusUnitId,
    ),
  };
}

export function getEnvCredentials() {
  return {
    email: process.env.ANKER_EMAIL?.trim() || "",
    password: process.env.ANKER_PASSWORD?.trim() || "",
    country: (process.env.ANKER_COUNTRY || "DE").trim().toUpperCase(),
    siteId: process.env.ANKER_SITE_ID?.trim() || null,
  };
}

export function readConfig(): AppConfig {
  ensureDataDir();
  let stored: AppConfig = DEFAULT_CONFIG;
  if (existsSync(CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<AppConfig>;
      stored = {
        ...DEFAULT_CONFIG,
        ...parsed,
        devices: mergeDevices(parsed.devices),
      };
    } catch {
      stored = DEFAULT_CONFIG;
    }
  }

  const env = getEnvCredentials();
  const dataSource = resolveDataSource(process.env.DATA_SOURCE, stored.dataSource);

  return {
    ...stored,
    dataSource,
    ankerCountry: env.country || stored.ankerCountry,
    siteId: env.siteId || stored.siteId,
    pollIntervalSeconds: Math.max(
      15,
      Math.min(
        3600,
        Number(process.env.POLL_INTERVAL_SECONDS) || stored.pollIntervalSeconds,
      ),
    ),
    devices: mergeDevices(stored.devices),
  };
}

export function writeConfig(
  patch: Partial<Omit<AppConfig, "devices">> & {
    devices?: Partial<DeviceEndpoints>;
  },
): AppConfig {
  ensureDataDir();
  const current = readConfig();
  const nextDevices = mergeDevices({
    ...current.devices,
    ...(patch.devices || {}),
  });

  const next: AppConfig = {
    ...current,
    ...patch,
    devices: nextDevices,
    pollIntervalSeconds: Math.max(
      15,
      Math.min(3600, patch.pollIntervalSeconds ?? current.pollIntervalSeconds),
    ),
  };

  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      {
        pollIntervalSeconds: next.pollIntervalSeconds,
        dataSource: next.dataSource,
        ankerCountry: next.ankerCountry,
        siteId: next.siteId,
        maxReadings: next.maxReadings,
        devices: {
          solarbankHost: next.devices.solarbankHost,
          solarbankPort: next.devices.solarbankPort,
          smartMeterHost: next.devices.smartMeterHost,
          smartMeterPort: next.devices.smartMeterPort,
          modbusUnitId: next.devices.modbusUnitId,
        },
      },
      null,
      2,
    ),
  );
  return readConfig();
}

export function hasAnkerCredentials(): boolean {
  const { email, password } = getEnvCredentials();
  return Boolean(email && password);
}

export function getDataDir() {
  ensureDataDir();
  return DATA_DIR;
}
