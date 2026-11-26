import { NextRequest, NextResponse } from "next/server";
import { fetchLayoutConfig } from "@/lib/queries";

// Returns the effective block program for a section (and optional
// subsection override). Read-only — writes go through server actions,
// which is the app's mutation convention.
export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section")?.trim().toLowerCase();
  const subsection = request.nextUrl.searchParams.get("subsection")?.trim().toLowerCase() || undefined;
  if (!section || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(section)) {
    return NextResponse.json({ error: "A valid section slug is required." }, { status: 400 });
  }
  try {
    const config = await fetchLayoutConfig(section, subsection);
    if (!config) return NextResponse.json({ error: "Unknown section." }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    console.error("[news] layout query failed:", error);
    return NextResponse.json({ error: "Layout unavailable." }, { status: 502 });
  }
}
