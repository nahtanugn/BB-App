import { getCurrentUser } from "../../../lib/auth";
import { PRIVATE_DOCUMENT_LIMITS, ensurePresidentsBadgeSchema, presidentsBadgeRuntime } from "../../../lib/presidents-badge";

export const runtime = "edge";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!["admin", "officer", "viewer"].includes(user.role)) return json({ error: "Administrator or Officer access required" }, 403);
  await ensurePresidentsBadgeSchema();
  let d1Bytes: number | null = null;
  try {
    const pageCount = await presidentsBadgeRuntime.DB.prepare("PRAGMA page_count").first<{ page_count: number }>();
    const pageSize = await presidentsBadgeRuntime.DB.prepare("PRAGMA page_size").first<{ page_size: number }>();
    if (pageCount && pageSize) d1Bytes = Number(pageCount.page_count) * Number(pageSize.page_size);
  } catch { /* Compatibility fallback. */ }
  const usage = await presidentsBadgeRuntime.DB.prepare("SELECT bytes,objects,writes,updated_at FROM private_document_usage WHERE id=1").first<{ bytes:number;objects:number;writes:number;updated_at:string}>();
  const r2 = { bytes: Number(usage?.bytes ?? 0), objects: Number(usage?.objects ?? 0), writes: Number(usage?.writes ?? 0), updatedAt: usage?.updated_at ?? null };
  const percent = (value:number, limit:number) => Math.round((value / limit) * 1000) / 10;
  return json({ d1: { bytes: d1Bytes, freeDatabaseLimitBytes: 500 * 1024 * 1024, percent: d1Bytes === null ? null : percent(d1Bytes, 500 * 1024 * 1024) }, r2: { ...r2, limits: PRIVATE_DOCUMENT_LIMITS, percent: { bytes: percent(r2.bytes, PRIVATE_DOCUMENT_LIMITS.bytes), objects: percent(r2.objects, PRIVATE_DOCUMENT_LIMITS.objects), writes: percent(r2.writes, PRIVATE_DOCUMENT_LIMITS.writes) } }, policy: "Uploads and generated documents stop before the app safety limits. Configure a Cloudflare budget alert for account-wide protection." });
}
