import net from "net";
import ModbusRTU from "modbus-serial";
import type { DeviceEndpoints, DeviceReachability, NormalizedSample } from "@/lib/types";
import { hasAnkerCredentials } from "@/lib/config";
import { fetchAnkerSample } from "@/lib/anker/client";

function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<DeviceReachability> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (reachable: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ host, port, reachable, detail });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, "TCP-Verbindung ok"));
    socket.once("timeout", () => finish(false, "Timeout – Host nicht erreichbar (LAN/VPN?)"));
    socket.once("error", (err) => finish(false, err.message));
    socket.connect(port, host);
  });
}

/** Decode big-endian IEEE754 float32 from two Modbus registers. */
function registersToFloat32(high: number, low: number): number {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(high & 0xffff, 0);
  buf.writeUInt16BE(low & 0xffff, 2);
  return buf.readFloatBE(0);
}

export async function probeDevices(devices: DeviceEndpoints) {
  const [smartMeter, solarbank] = await Promise.all([
    probeTcp(devices.smartMeterHost, devices.smartMeterPort),
    probeTcp(devices.solarbankHost, devices.solarbankPort),
  ]);
  return { smartMeter, solarbank };
}

/**
 * Smart Meter Gen 2: Modbus TCP (enable in Anker app → Three-Party / Modbus).
 * Community map: input register 56 = total active power (float32).
 * Solarbank 2 E1600 Pro: no public local Modbus/HTTP API — optional cloud enrich.
 */
export async function fetchLanSample(devices: DeviceEndpoints): Promise<{
  sample: NormalizedSample;
  reachability: { smartMeter: DeviceReachability; solarbank: DeviceReachability };
}> {
  const reachability = await probeDevices(devices);

  if (!reachability.smartMeter.reachable) {
    throw new Error(
      `Smart Meter ${devices.smartMeterHost}:${devices.smartMeterPort} nicht erreichbar. ` +
        `Dieses Tool muss im Heimnetz (oder per VPN) laufen. Cloud-VMs erreichen 192.168.x.x nicht. ` +
        `(${reachability.smartMeter.detail})`,
    );
  }

  const client = new ModbusRTU();
  client.setTimeout(3000);
  try {
    await client.connectTCP(devices.smartMeterHost, { port: devices.smartMeterPort });
    client.setID(devices.modbusUnitId);

    // Total active power @ input register 56 (2 regs = float32)
    const powerRes = await client.readInputRegisters(56, 2);
    const meterPowerW = Math.round(registersToFloat32(powerRes.data[0], powerRes.data[1]));

    // Phase powers 18/20/22 (optional enrichment)
    let phasePowers: number[] = [];
    try {
      const phases = await client.readInputRegisters(18, 6);
      phasePowers = [
        registersToFloat32(phases.data[0], phases.data[1]),
        registersToFloat32(phases.data[2], phases.data[3]),
        registersToFloat32(phases.data[4], phases.data[5]),
      ].map((n) => Math.round(n));
    } catch {
      phasePowers = [];
    }

    let solarPowerW = 0;
    let batteryPowerW = 0;
    let batterySocPercent = 0;
    let homeLoadW = 0;
    let charging = false;
    let siteName = "LAN: Smart Meter Gen 2";
    let cloudPart: unknown = null;

    // SB2 has no local Modbus — enrich from cloud when credentials are present.
    if (hasAnkerCredentials()) {
      try {
        const cloud = await fetchAnkerSample();
        solarPowerW = cloud.solarPowerW;
        batteryPowerW = cloud.batteryPowerW;
        batterySocPercent = cloud.batterySocPercent;
        homeLoadW = cloud.homeLoadW;
        charging = cloud.charging;
        siteName = `${cloud.siteName} (LAN-Meter)`;
        cloudPart = cloud.raw;
      } catch (err) {
        cloudPart = {
          cloudError: err instanceof Error ? err.message : String(err),
        };
      }
    } else if (!reachability.solarbank.reachable) {
      // Expected for SB2: port 502 usually closed.
      siteName = "LAN: Smart Meter Gen 2 (Solarbank nur via Cloud)";
    }

    if (!homeLoadW && meterPowerW !== 0) {
      // Without solar/battery context, approximate home load from grid import only when importing.
      homeLoadW = Math.max(0, meterPowerW);
    }

    const sample: NormalizedSample = {
      siteName,
      solarPowerW,
      batteryPowerW,
      batterySocPercent,
      homeLoadW,
      gridPowerW: meterPowerW,
      meterPowerW,
      charging,
      raw: {
        mode: "lan",
        smartMeter: {
          host: devices.smartMeterHost,
          port: devices.smartMeterPort,
          totalActivePowerW: meterPowerW,
          phasePowersW: phasePowers,
        },
        solarbank: {
          host: devices.solarbankHost,
          port: devices.solarbankPort,
          localApi: "unavailable-for-sb2",
          tcpProbe: reachability.solarbank,
          note:
            "Solarbank 2 E1600 Pro hat laut Anker keine lokale Modbus/HTTP-API. IP wird für Inventar/Probe gespeichert; Telemetrie kommt aus der Cloud, falls ANKER_EMAIL/PASSWORD gesetzt sind.",
        },
        cloudPart,
      },
    };

    return { sample, reachability };
  } finally {
    try {
      client.close(() => undefined);
    } catch {
      // ignore
    }
  }
}

export const LAN_LIMITATIONS_DE =
  "Smart Meter Gen 2: lokales Modbus TCP (Port 502, in der Anker-App aktivieren). " +
  "Solarbank 2 E1600 Pro: kein öffentliches LAN-API — Cloud oder Mock. " +
  "Dieses Cloud-Environment erreicht private IPs (192.168.178.x) nicht; LAN-Modus auf einem Rechner im Heimnetz starten.";
