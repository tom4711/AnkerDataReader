import { NextRequest, NextResponse } from "next/server";
import { getLatestReading, getReadingsSince } from "@/lib/db";
import { ensurePollerStarted } from "@/lib/poller";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  ensurePollerStarted();
  const hours = Math.max(1, Math.min(168, Number(req.nextUrl.searchParams.get("hours") || 24)));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const readings = getReadingsSince(since);
  return NextResponse.json({
    latest: getLatestReading(),
    readings,
    hours,
  });
}
