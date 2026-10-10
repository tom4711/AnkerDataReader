export type DataSourceMode = "mock" | "cloud" | "lan";

export interface DeviceEndpoints {
  solarbankHost: string;
  solarbankPort: number;
  smartMeterHost: string;
  smartMeterPort: number;
  modbusUnitId: number;
}

export interface AppConfig {
  pollIntervalSeconds: number;
  dataSource: DataSourceMode;
  ankerCountry: string;
  siteId: string | null;
  maxReadings: number;
  devices: DeviceEndpoints;
}

export interface WeatherSnapshot {
  temperatureC: number | null;
  cloudCoverPercent: number | null;
  shortwaveRadiationWm2: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  observedAt: string | null;
  locationLabel: string | null;
}

/** Anker cloud / app telemetry — never mixed with Modbus meter watts. */
export interface CloudPowerSnapshot {
  solarPowerW: number | null;
  batteryPowerW: number | null;
  batterySocPercent: number | null;
  homeLoadW: number | null;
  gridPowerW: number | null;
}

export interface Reading {
  id: number;
  recordedAt: string;
  source: DataSourceMode;
  siteName: string;
  /** @deprecated Prefer `cloud.*` — kept for older rows / UI aliases. */
  solarPowerW: number;
  /** @deprecated Prefer `cloud.*` */
  batteryPowerW: number;
  /** @deprecated Prefer `cloud.*` */
  batterySocPercent: number;
  /** @deprecated Prefer `cloud.*` */
  homeLoadW: number;
  /** @deprecated Prefer `cloud.*` */
  gridPowerW: number;
  /** Live Modbus Smart Meter (LAN) — null when not polled. */
  meterPowerW: number | null;
  cloud: CloudPowerSnapshot;
  charging: boolean;
  rawJson: string | null;
  weather: WeatherSnapshot | null;
}

export interface DeviceReachability {
  host: string;
  port: number;
  reachable: boolean;
  detail: string;
}

export interface PollStatus {
  running: boolean;
  mode: DataSourceMode;
  pollIntervalSeconds: number;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextPollAt: string | null;
  readingCount: number;
  siteName: string | null;
  devices: DeviceEndpoints;
  lan: {
    smartMeter: DeviceReachability | null;
    solarbank: DeviceReachability | null;
    note: string;
  };
  weather: WeatherSnapshot | null;
}

export interface NormalizedSample {
  siteName: string;
  cloud: CloudPowerSnapshot;
  /** Live Modbus only; do not put cloud grid here. */
  meterPowerW: number | null;
  charging: boolean;
  raw: unknown;
}
