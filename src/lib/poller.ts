import { fetchAnkerSample } from "@/lib/anker/client";
import { fetchLanSample, LAN_LIMITATIONS_DE } from "@/lib/anker/lan";
import { generateMockSample } from "@/lib/anker/mock";
import { hasAnkerCredentials, readConfig, writeConfig } from "@/lib/config";
import { getLatestReading, getReadingCount, insertReading } from "@/lib/db";
import { seedMockHistoryIfEmpty } from "@/lib/seed";
import type { AppConfig, DeviceReachability, PollStatus, WeatherSnapshot } from "@/lib/types";
import { fetchWeatherSample } from "@/lib/weather";

interface PollerState {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextPollAt: string | null;
  polling: boolean;
  lanSmartMeter: DeviceReachability | null;
  lanSolarbank: DeviceReachability | null;
  lastWeather: WeatherSnapshot | null;
  lastWeatherError: string | null;
}

const globalForPoller = globalThis as unknown as { __ankerPoller?: PollerState };

function state(): PollerState {
  if (!globalForPoller.__ankerPoller) {
    globalForPoller.__ankerPoller = {
      timer: null,
      running: false,
      lastPollAt: null,
      lastSuccessAt: null,
      lastError: null,
      nextPollAt: null,
      polling: false,
      lanSmartMeter: null,
      lanSolarbank: null,
      lastWeather: null,
      lastWeatherError: null,
    };
  }
  return globalForPoller.__ankerPoller;
}

async function collectSample(config: AppConfig) {
  if (config.dataSource === "mock") {
    return { sample: generateMockSample(), reachability: null as null };
  }
  if (config.dataSource === "cloud") {
    if (!hasAnkerCredentials()) {
      throw new Error(
        "Cloud-Modus aktiv, aber ANKER_EMAIL / ANKER_PASSWORD fehlen. Auf Mock umschalten oder Zugangsdaten setzen.",
      );
    }
    return { sample: await fetchAnkerSample(), reachability: null as null };
  }
  // lan
  const { sample, reachability } = await fetchLanSample(config.devices);
  return { sample, reachability };
}

export async function runPollOnce(): Promise<{ ok: boolean; error?: string }> {
  const s = state();
  if (s.polling) return { ok: false, error: "Poll läuft bereits" };
  s.polling = true;
  const config = readConfig();
  s.lastPollAt = new Date().toISOString();
  try {
    const { sample, reachability } = await collectSample(config);
    if (reachability) {
      s.lanSmartMeter = reachability.smartMeter;
      s.lanSolarbank = reachability.solarbank;
    }

    let weather: WeatherSnapshot | null = s.lastWeather;
    try {
      const wx = await fetchWeatherSample();
      if (wx) {
        weather = {
          temperatureC: wx.temperatureC,
          cloudCoverPercent: wx.cloudCoverPercent,
          shortwaveRadiationWm2: wx.shortwaveRadiationWm2,
          weatherCode: wx.weatherCode,
          windSpeedKmh: wx.windSpeedKmh,
          observedAt: wx.observedAt,
          locationLabel: wx.locationLabel,
        };
        s.lastWeather = weather;
        s.lastWeatherError = null;
      }
    } catch (err) {
      s.lastWeatherError = err instanceof Error ? err.message : String(err);
      // Keep last good weather snapshot on the reading when fetch fails.
    }

    insertReading({
      source: config.dataSource,
      siteName: sample.siteName,
      cloud: sample.cloud,
      meterPowerW: sample.meterPowerW,
      charging: sample.charging,
      rawJson: JSON.stringify(sample.raw),
      weather,
    });
    s.lastSuccessAt = new Date().toISOString();
    s.lastError = null;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    s.lastError = message;
    return { ok: false, error: message };
  } finally {
    s.polling = false;
    if (s.running) {
      const interval = readConfig().pollIntervalSeconds * 1000;
      s.nextPollAt = new Date(Date.now() + interval).toISOString();
    }
  }
}

export function startPoller() {
  const s = state();
  if (s.running) return;
  s.running = true;
  if (readConfig().dataSource === "mock") {
    seedMockHistoryIfEmpty();
  }
  const tick = async () => {
    await runPollOnce();
  };
  void tick();
  const schedule = () => {
    if (s.timer) clearInterval(s.timer);
    const ms = readConfig().pollIntervalSeconds * 1000;
    s.nextPollAt = new Date(Date.now() + ms).toISOString();
    s.timer = setInterval(() => {
      void tick();
    }, ms);
  };
  schedule();
}

export function restartPoller() {
  const s = state();
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
  s.running = false;
  startPoller();
}

export function getPollStatus(): PollStatus {
  const s = state();
  const config = readConfig();
  const latest = getLatestReading();
  return {
    running: s.running,
    mode: config.dataSource,
    pollIntervalSeconds: config.pollIntervalSeconds,
    lastPollAt: s.lastPollAt,
    lastSuccessAt: s.lastSuccessAt,
    lastError: s.lastError,
    nextPollAt: s.nextPollAt,
    readingCount: getReadingCount(),
    siteName: latest?.siteName ?? null,
    devices: config.devices,
    lan: {
      smartMeter: s.lanSmartMeter,
      solarbank: s.lanSolarbank,
      note: LAN_LIMITATIONS_DE,
    },
    weather: s.lastWeather,
  };
}

export function updatePollerConfig(
  patch: Partial<Omit<AppConfig, "devices">> & {
    devices?: Partial<AppConfig["devices"]>;
  },
) {
  const config = writeConfig(patch as Partial<AppConfig>);
  restartPoller();
  return config;
}

export function ensurePollerStarted() {
  startPoller();
}
