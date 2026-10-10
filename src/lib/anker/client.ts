import { createCipheriv, createECDH, createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getDataDir, getEnvCredentials } from "@/lib/config";
import { normalizeSceneInfo } from "@/lib/anker/normalize";
import type { NormalizedSample } from "@/lib/types";

const EU_API = "https://ankerpower-api-eu.anker.com";
const SERVER_PUBLIC_KEY =
  "04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076";

interface LoginData {
  user_id: string;
  auth_token: string;
  email?: string;
}

interface ApiEnvelope<T> {
  code?: number;
  msg?: string;
  data?: T;
}

function authStorePath() {
  return path.join(getDataDir(), "anker-auth.json");
}

function encryptPassword(password: string, sharedKey: Buffer) {
  const cipher = createCipheriv("aes-256-cbc", sharedKey, sharedKey.subarray(0, 16));
  return cipher.update(password, "utf8", "base64") + cipher.final("base64");
}

function timezoneOffsetMs() {
  const offsetMin = new Date().getTimezoneOffset();
  return offsetMin !== 0 ? -offsetMin * 60 * 1000 : 0;
}

function timezoneHeader() {
  const tzo = -new Date().getTimezoneOffset();
  const sign = tzo >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(tzo) / 60)).padStart(2, "0");
  const mins = String(Math.abs(tzo) % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${mins}`;
}

async function postJson<T>(
  endpoint: string,
  body: unknown,
  headers: Record<string, string>,
  country: string,
): Promise<ApiEnvelope<T>> {
  const url = new URL(endpoint, EU_API).href;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Country: country,
      Timezone: timezoneHeader(),
      "Model-Type": "DESKTOP",
      "App-Name": "anker_power",
      "Os-Type": "android",
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Anker API ${endpoint} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as ApiEnvelope<T>;
}

function loadCachedLogin(): LoginData | null {
  const file = authStorePath();
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as LoginData;
  } catch {
    return null;
  }
}

function saveLogin(data: LoginData) {
  writeFileSync(authStorePath(), JSON.stringify(data, null, 2));
}

async function login(email: string, password: string, country: string): Promise<LoginData> {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const shared = ecdh.computeSecret(Buffer.from(SERVER_PUBLIC_KEY, "hex"));

  const payload = {
    ab: country,
    client_secret_info: { public_key: ecdh.getPublicKey("hex") },
    enc: 0,
    email,
    password: encryptPassword(password, shared),
    time_zone: timezoneOffsetMs(),
    transaction: `${Date.now()}`,
  };

  const result = await postJson<LoginData>("/passport/login", payload, {}, country);
  if (!result.data?.auth_token || !result.data?.user_id) {
    throw new Error(result.msg || "Anker-Login fehlgeschlagen (keine Auth-Token-Antwort).");
  }
  saveLogin(result.data);
  return result.data;
}

async function ensureLogin(email: string, password: string, country: string): Promise<LoginData> {
  const cached = loadCachedLogin();
  if (cached?.auth_token && cached.user_id) return cached;
  return login(email, password, country);
}

function authHeaders(loginData: LoginData) {
  return {
    "X-Auth-Token": loginData.auth_token,
    gtoken: createHash("md5").update(Buffer.from(loginData.user_id)).digest("hex"),
  };
}

async function authedPost<T>(
  endpoint: string,
  body: unknown,
  email: string,
  password: string,
  country: string,
  retry = true,
): Promise<T> {
  let loginData = await ensureLogin(email, password, country);
  let result = await postJson<T>(endpoint, body, authHeaders(loginData), country);

  // Token invalidated by another login — force fresh login once.
  if ((result.code === 401 || result.code === 10000 || /token|auth|login/i.test(result.msg || "")) && retry) {
    loginData = await login(email, password, country);
    result = await postJson<T>(endpoint, body, authHeaders(loginData), country);
  }

  if (result.code != null && result.code !== 0) {
    throw new Error(result.msg || `Anker API-Fehler code=${result.code}`);
  }
  if (result.data == null) {
    throw new Error(`Anker API ${endpoint}: leere Antwort`);
  }
  return result.data;
}

export async function fetchAnkerSample(): Promise<NormalizedSample> {
  const { email, password, country, siteId: envSiteId } = getEnvCredentials();
  if (!email || !password) {
    throw new Error("ANKER_EMAIL und ANKER_PASSWORD fehlen in der Umgebung.");
  }

  type SiteList = { site_list?: Array<{ site_id?: string; site_name?: string }> };
  const sites = await authedPost<SiteList>(
    "/power_service/v1/site/get_site_list",
    {},
    email,
    password,
    country,
  );

  const list = sites.site_list || [];
  if (list.length === 0) {
    throw new Error("Keine Anker-Sites im Konto gefunden.");
  }

  const selected =
    (envSiteId && list.find((s) => s.site_id === envSiteId)) ||
    list[0];
  const siteId = selected.site_id;
  if (!siteId) {
    throw new Error("Site ohne site_id – Konfiguration prüfen.");
  }

  const scene = await authedPost<unknown>(
    "/power_service/v1/site/get_scen_info",
    { site_id: siteId },
    email,
    password,
    country,
  );

  return normalizeSceneInfo({ data: scene }, selected.site_name || "Anker System");
}
