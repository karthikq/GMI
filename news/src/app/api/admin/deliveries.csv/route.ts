import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildDeliveryFilter, deliveriesCsv } from "@/lib/newsletterAdmin";

// Filtered delivery-centre export — same params as the table. Admin/editor
// only; recipient emails never leave the authenticated surface.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "editor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.url ? new URL(request.url).searchParams : new URLSearchParams();
  const filter = buildDeliveryFilter({
    date: params.get("date") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    templateId: params.get("templateId") ?? undefined,
    status: params.get("status") ?? undefined,
    source: params.get("source") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  const csv = await deliveriesCsv(filter);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deliveries-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
