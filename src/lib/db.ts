import Database from "better-sqlite3";
import path from "path";
import { getDataDir, readConfig } from "@/lib/config";
import type { CloudPowerSnapshot, DataSourceMode, Reading, WeatherSnapshot } from "@/lib/types";

let db: Database.Database | null = null;

function ensureColumn(database: Database.Database, table: string, column: string, ddl: string) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function getDb() {
  if (db) return db;
  const file = path.join(getDataDir(), "readings.sqlite");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL,
      site_name TEXT NOT NULL,
      solar_power_w REAL NOT NULL,
      battery_power_w REAL NOT NULL,
      battery_soc_percent REAL NOT NULL,
      home_load_w REAL NOT NULL,
      grid_power_w REAL NOT NULL,
      meter_power_w REAL,
      charging INTEGER NOT NULL,
      raw_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON readings(recorded_at);
  `);

  // Explicit cloud channels (separated from meter_power_w for clean stats).
  ensureColumn(db, "readings", "cloud_solar_w", "cloud_solar_w REAL");
  ensureColumn(db, "readings", "cloud_battery_w", "cloud_battery_w REAL");
  ensureColumn(db, "readings", "cloud_battery_soc_percent", "cloud_battery_soc_percent REAL");
  ensureColumn(db, "readings", "cloud_home_w", "cloud_home_w REAL");
  ensureColumn(db, "readings", "cloud_grid_w", "cloud_grid_w REAL");

  // Weather columns (Open-Meteo).
  ensureColumn(db, "readings", "weather_temp_c", "weather_temp_c REAL");
  ensureColumn(db, "readings", "weather_cloud_cover_pct", "weather_cloud_cover_pct REAL");
  ensureColumn(db, "readings", "weather_shortwave_wm2", "weather_shortwave_wm2 REAL");
  ensureColumn(db, "readings", "weather_code", "weather_code INTEGER");
  ensureColumn(db, "readings", "weather_wind_kmh", "weather_wind_kmh REAL");
  ensureColumn(db, "readings", "weather_observed_at", "weather_observed_at TEXT");
  ensureColumn(db, "readings", "weather_location", "weather_location TEXT");

  return db;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapWeather(row: Record<string, unknown>): WeatherSnapshot | null {
  const hasWeather =
    row.weather_temp_c != null ||
    row.weather_cloud_cover_pct != null ||
    row.weather_shortwave_wm2 != null ||
    row.weather_code != null;
  if (!hasWeather) return null;
  return {
    temperatureC: numOrNull(row.weather_temp_c),
    cloudCoverPercent: numOrNull(row.weather_cloud_cover_pct),
    shortwaveRadiationWm2: numOrNull(row.weather_shortwave_wm2),
    weatherCode: numOrNull(row.weather_code),
    windSpeedKmh: numOrNull(row.weather_wind_kmh),
    observedAt: row.weather_observed_at == null ? null : String(row.weather_observed_at),
    locationLabel: row.weather_location == null ? null : String(row.weather_location),
  };
}

function mapCloud(row: Record<string, unknown>): CloudPowerSnapshot {
  // Prefer explicit cloud_* columns; fall back to legacy columns for older rows.
  return {
    solarPowerW: numOrNull(row.cloud_solar_w) ?? numOrNull(row.solar_power_w),
    batteryPowerW: numOrNull(row.cloud_battery_w) ?? numOrNull(row.battery_power_w),
    batterySocPercent: numOrNull(row.cloud_battery_soc_percent) ?? numOrNull(row.battery_soc_percent),
    homeLoadW: numOrNull(row.cloud_home_w) ?? numOrNull(row.home_load_w),
    gridPowerW: numOrNull(row.cloud_grid_w) ?? numOrNull(row.grid_power_w),
  };
}

function mapRow(row: Record<string, unknown>): Reading {
  const cloud = mapCloud(row);
  return {
    id: Number(row.id),
    recordedAt: String(row.recorded_at),
    source: row.source as DataSourceMode,
    siteName: String(row.site_name),
    solarPowerW: cloud.solarPowerW ?? 0,
    batteryPowerW: cloud.batteryPowerW ?? 0,
    batterySocPercent: cloud.batterySocPercent ?? 0,
    homeLoadW: cloud.homeLoadW ?? 0,
    gridPowerW: cloud.gridPowerW ?? 0,
    meterPowerW: numOrNull(row.meter_power_w),
    cloud,
    charging: Boolean(row.charging),
    rawJson: row.raw_json == null ? null : String(row.raw_json),
    weather: mapWeather(row),
  };
}

export function insertReading(
  sample: {
    source: DataSourceMode;
    siteName: string;
    cloud: CloudPowerSnapshot;
    meterPowerW: number | null;
    charging: boolean;
    recordedAt?: string;
    rawJson?: string | null;
    weather?: WeatherSnapshot | null;
  },
): Reading {
  const database = getDb();
  const recordedAt = sample.recordedAt ?? new Date().toISOString();
  const w = sample.weather;
  const c = sample.cloud;
  // Legacy columns mirror cloud values so old queries stay meaningful.
  const info = database
    .prepare(
      `INSERT INTO readings (
        recorded_at, source, site_name, solar_power_w, battery_power_w,
        battery_soc_percent, home_load_w, grid_power_w, meter_power_w, charging, raw_json,
        cloud_solar_w, cloud_battery_w, cloud_battery_soc_percent, cloud_home_w, cloud_grid_w,
        weather_temp_c, weather_cloud_cover_pct, weather_shortwave_wm2, weather_code,
        weather_wind_kmh, weather_observed_at, weather_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      recordedAt,
      sample.source,
      sample.siteName,
      c.solarPowerW ?? 0,
      c.batteryPowerW ?? 0,
      c.batterySocPercent ?? 0,
      c.homeLoadW ?? 0,
      c.gridPowerW ?? 0,
      sample.meterPowerW,
      sample.charging ? 1 : 0,
      sample.rawJson ?? null,
      c.solarPowerW,
      c.batteryPowerW,
      c.batterySocPercent,
      c.homeLoadW,
      c.gridPowerW,
      w?.temperatureC ?? null,
      w?.cloudCoverPercent ?? null,
      w?.shortwaveRadiationWm2 ?? null,
      w?.weatherCode ?? null,
      w?.windSpeedKmh ?? null,
      w?.observedAt ?? null,
      w?.locationLabel ?? null,
    );

  const max = readConfig().maxReadings;
  const total = (database.prepare("SELECT COUNT(*) AS c FROM readings").get() as { c: number }).c;
  if (total > max) {
    database
      .prepare(
        `DELETE FROM readings WHERE id IN (
          SELECT id FROM readings ORDER BY recorded_at ASC LIMIT ?
        )`,
      )
      .run(total - max);
  }

  const row = database
    .prepare("SELECT * FROM readings WHERE id = ?")
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return mapRow(row);
}

export function getLatestReading(): Reading | null {
  const row = getDb()
    .prepare("SELECT * FROM readings ORDER BY recorded_at DESC, id DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function getReadingsSince(sinceIso: string, limit = 2000): Reading[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM readings
       WHERE recorded_at >= ?
       ORDER BY recorded_at ASC, id ASC
       LIMIT ?`,
    )
    .all(sinceIso, limit) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function getReadingCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM readings").get() as { c: number }).c;
}

export function clearReadings() {
  getDb().exec("DELETE FROM readings");
}
