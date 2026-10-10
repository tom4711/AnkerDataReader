export interface WeatherSample {
  locationLabel: string;
  latitude: number;
  longitude: number;
  temperatureC: number | null;
  cloudCoverPercent: number | null;
  shortwaveRadiationWm2: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  observedAt: string | null;
  fetchedAt: string;
  source: "open-meteo";
}

export interface WeatherConfig {
  enabled: boolean;
  latitude: number;
  longitude: number;
  locationLabel: string;
  /** Min seconds between Open-Meteo requests (current weather ~15 min resolution). */
  cacheSeconds: number;
}

const DEFAULT_LAT = 48.097537;
const DEFAULT_LON = 12.018481;
const DEFAULT_LABEL = "Berg 11, Steinhöring";

type CacheState = { sample: WeatherSample; expiresAt: number };

const globalForWeather = globalThis as unknown as { __ankerWeatherCache?: CacheState };

export function getWeatherConfig(): WeatherConfig {
  const disabled =
    process.env.WEATHER_ENABLED === "0" ||
    process.env.WEATHER_ENABLED === "false" ||
    process.env.WEATHER_ENABLED === "off";
  return {
    enabled: !disabled,
    latitude: Number(process.env.WEATHER_LAT || DEFAULT_LAT),
    longitude: Number(process.env.WEATHER_LON || DEFAULT_LON),
    locationLabel: (process.env.WEATHER_LOCATION || DEFAULT_LABEL).trim(),
    cacheSeconds: Math.max(60, Number(process.env.WEATHER_CACHE_SECONDS || 600)),
  };
}

export async function fetchWeatherSample(force = false): Promise<WeatherSample | null> {
  const cfg = getWeatherConfig();
  if (!cfg.enabled) return null;
  if (!Number.isFinite(cfg.latitude) || !Number.isFinite(cfg.longitude)) return null;

  const now = Date.now();
  const cached = globalForWeather.__ankerWeatherCache;
  if (!force && cached && cached.expiresAt > now) {
    return cached.sample;
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(cfg.latitude));
  url.searchParams.set("longitude", String(cfg.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,cloud_cover,shortwave_radiation,wind_speed_10m",
  );
  url.searchParams.set("timezone", "Europe/Berlin");
  url.searchParams.set("wind_speed_unit", "kmh");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      cloud_cover?: number;
      shortwave_radiation?: number;
      wind_speed_10m?: number;
    };
  };

  const current = json.current || {};
  const sample: WeatherSample = {
    locationLabel: cfg.locationLabel,
    latitude: cfg.latitude,
    longitude: cfg.longitude,
    temperatureC: current.temperature_2m ?? null,
    cloudCoverPercent: current.cloud_cover ?? null,
    shortwaveRadiationWm2: current.shortwave_radiation ?? null,
    weatherCode: current.weather_code ?? null,
    windSpeedKmh: current.wind_speed_10m ?? null,
    observedAt: current.time ? new Date(current.time).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    source: "open-meteo",
  };

  globalForWeather.__ankerWeatherCache = {
    sample,
    expiresAt: now + cfg.cacheSeconds * 1000,
  };

  return sample;
}
