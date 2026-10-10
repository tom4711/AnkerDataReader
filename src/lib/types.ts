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

export interface Reading {
  id: number;
  recordedAt: string;
  source: DataSourceMode;
  siteName: string;
  solarPowerW: number;
  batteryPowerW: number;
  batterySocPercent: number;
  homeLoadW: number;
  gridPowerW: number;
  meterPowerW: number | null;
  charging: boolean;
  rawJson: string | null;
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
}

export interface NormalizedSample {
  siteName: string;
  solarPowerW: number;
  batteryPowerW: number;
  batterySocPercent: number;
  homeLoadW: number;
  gridPowerW: number;
  meterPowerW: number | null;
  charging: boolean;
  raw: unknown;
}
