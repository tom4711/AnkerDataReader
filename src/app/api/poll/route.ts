import { NextResponse } from "next/server";
import { ensurePollerStarted, getPollStatus, runPollOnce } from "@/lib/poller";

export const dynamic = "force-dynamic";

export async function POST() {
  ensurePollerStarted();
  const result = await runPollOnce();
  return NextResponse.json({ ...result, status: getPollStatus() }, { status: result.ok ? 200 : 502 });
}
