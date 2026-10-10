export function formatWatts(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(2)} kW`;
  return `${Math.round(value)} W`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} %`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function gridLabel(watts: number): string {
  if (watts > 5) return "Bezug";
  if (watts < -5) return "Einspeisung";
  return "neutral";
}

export function formatTempC(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} °C`;
}

export function formatIrradiance(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)} W/m²`;
}

/** WMO weather interpretation codes (Open-Meteo). */
export function weatherCodeLabel(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) return "—";
  if (code === 0) return "klar";
  if (code === 1) return "überwiegend klar";
  if (code === 2) return "teilweise bewölkt";
  if (code === 3) return "bedeckt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 57) return "Nieselregen";
  if (code >= 61 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code >= 85 && code <= 86) return "Schneeschauer";
  if (code >= 95) return "Gewitter";
  return `Code ${code}`;
}
