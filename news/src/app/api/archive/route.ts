import { NextRequest, NextResponse } from "next/server";
import { fetchArticles } from "@/lib/queries";

const ALLOWED_DAYS = new Set([7, 15, 20, 25, 30]);

export async function GET(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get("days"));
  if (!ALLOWED_DAYS.has(days)) {
    return NextResponse.json({ error: "Unsupported range." }, { status: 400 });
  }
  try {
    const result = await fetchArticles({ olderThanDays: days, limit: 4 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[news] archive query failed:", error);
    return NextResponse.json({ error: "Archive unavailable." }, { status: 502 });
  }
}
