import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAnkerCredentials, readConfig } from "@/lib/config";
import { getPollStatus, updatePollerConfig } from "@/lib/poller";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  pollIntervalSeconds: z.number().int().min(15).max(3600).optional(),
  dataSource: z.enum(["mock", "cloud", "lan"]).optional(),
  ankerCountry: z.string().length(2).optional(),
  siteId: z.string().nullable().optional(),
  devices: z
    .object({
      solarbankHost: z.string().min(1).optional(),
      solarbankPort: z.number().int().min(1).max(65535).optional(),
      smartMeterHost: z.string().min(1).optional(),
      smartMeterPort: z.number().int().min(1).max(65535).optional(),
      modbusUnitId: z.number().int().min(1).max(247).optional(),
    })
    .optional(),
});

export async function GET() {
  return NextResponse.json({
    config: readConfig(),
    credentials: { ankerConfigured: hasAnkerCredentials() },
    status: getPollStatus(),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const config = updatePollerConfig(parsed.data);
  return NextResponse.json({ config, status: getPollStatus() });
}
