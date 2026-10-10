import Database from "better-sqlite3";
import path from "path";
import { getDataDir, readConfig } from "@/lib/config";
import type { DataSourceMode, Reading } from "@/lib/types";

let db: Database.Database | null = null;

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
  return db;
}

function mapRow(row: Record<string, unknown>): Reading {
  return {
    id: Number(row.id),
    recordedAt: String(row.recorded_at),
    source: row.source as DataSourceMode,
    siteName: String(row.site_name),
    solarPowerW: Number(row.solar_power_w),
    batteryPowerW: Number(row.battery_power_w),
    batterySocPercent: Number(row.battery_soc_percent),
    homeLoadW: Number(row.home_load_w),
    gridPowerW: Number(row.grid_power_w),
    meterPowerW: row.meter_power_w == null ? null : Number(row.meter_power_w),
    charging: Boolean(row.charging),
    rawJson: row.raw_json == null ? null : String(row.raw_json),
  };
}

export function insertReading(
  sample: Omit<Reading, "id" | "recordedAt" | "rawJson"> & {
    recordedAt?: string;
    rawJson?: string | null;
  },
): Reading {
  const database = getDb();
  const recordedAt = sample.recordedAt ?? new Date().toISOString();
  const info = database
    .prepare(
      `INSERT INTO readings (
        recorded_at, source, site_name, solar_power_w, battery_power_w,
        battery_soc_percent, home_load_w, grid_power_w, meter_power_w, charging, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      recordedAt,
      sample.source,
      sample.siteName,
      sample.solarPowerW,
      sample.batteryPowerW,
      sample.batterySocPercent,
      sample.homeLoadW,
      sample.gridPowerW,
      sample.meterPowerW,
      sample.charging ? 1 : 0,
      sample.rawJson ?? null,
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
