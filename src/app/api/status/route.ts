import { NextResponse } from "next/server";
import { hasAnkerCredentials, readConfig } from "@/lib/config";
import { ensurePollerStarted, getPollStatus } from "@/lib/poller";

export const dynamic = "force-dynamic";

export async function GET() {
  ensurePollerStarted();
  const config = readConfig();
  return NextResponse.json({
    status: getPollStatus(),
    config,
    credentials: {
      ankerConfigured: hasAnkerCredentials(),
    },
  });
}
