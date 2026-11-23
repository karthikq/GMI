import { NextRequest, NextResponse } from "next/server";
import { fetchArticles } from "@/lib/queries";
import { ARCHIVE_OPTIONS } from "@/lib/archive";

const ALLOWED_DAYS = new Set(ARCHIVE_OPTIONS.map((o) => o.days));

export async function GET(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get("days"));
  if (!ALLOWED_DAYS.has(days)) {
    return NextResponse.json({ error: "Unsupported range." }, { status: 400 });
  }
  try {
    const result = await fetchArticles({ olderThanDays: days - 7, newerThanDays: days, limit: 4 });
    console.log(result,'result');
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[news] archive query failed:", error);
    return NextResponse.json({ error: "Archive unavailable." }, { status: 502 });
  }
}
