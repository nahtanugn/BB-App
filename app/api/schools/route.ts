import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

// PPD Kuching's KPM government/government-aided register.  This is seeded
// idempotently so existing directory entries and member free-text values are
// never overwritten. The administrator can still add private or international
// schools from the School Directory screen.
const KUCHING_SCHOOLS = [
  "SJK(C) Sungai Apong", "SJK(C) Bintawa", "SJK(C) Stampin", "SK Song Kheng Hai", "SK Kenyalang", "SK St Paul (M)",
  "SJK(C) Chung Hua 1", "SJK(C) Chung Hua 2", "SJK(C) Chung Hua 3", "SJK(C) Chung Hua No. 4", "SJK(C) Chung Hua Pending", "SJK(C) Chung Hua No. 5", "SJK(C) Chung Hua Sungai Buda", "SJK(C) Buntal",
  "SK Merpati Jepang", "SK Rancangan Perumahan Rakyat (RPR)", "SK Satria Jaya", "SK Laksamana", "SK Siol Kanan", "SK Tabuan Hilir", "SK Bandar Samariang", "SK Gita 2", "SK Muhibbah", "SK Encik Buyong", "SK Gersik", "SK Santubong", "SK Muara Tebas", "SK Pasir Pandak", "SK Gita", "SK Pulo", "SK Goebilt", "SK Tabuan", "SK Astana", "SK Tabuan Ulu", "SK Salak", "SK Semariang", "SK Tabuan Jaya", "SK Semerah Padi", "SK Rampang", "SK Maj. Gen. Datu Ibrahim", "SK Batu Lintang", "SK Pendidikan Khas (B) Kuching", "SK Jalan Ong Tian Swee", "SK Green Road", "SK Sungai Stutong", "SK Lumba Kuda", "SK Combined", "SK Buntal", "SK Bako", "SK Pajar Sejingkat", "SK Kampung Senari", "SK Matu Baru", "SK Rakyat", "SK Rakyat Tupong", "SK Madrasah Datuk Haji Abdul Kadir Hasan", "SK St Thomas (M)", "SK St Mary (M)", "SK St Joseph (M)", "SK St Teresa (M)", "SK St Theresa Padungan", "SK Catholic English (M)", "SK St Andrew (M)",
  "Kolej Vokasional Kuching", "Sekolah Seni Kuching", "SMK Agama Tun Ahmad Zaidi", "SMK DPH Abdul Gapor (Integrasi)", "SMK Seri Setia", "SMK Tabuan Jaya", "SMK Bako", "SMK Demak Baru", "SMK Bandar Samariang", "SMK Petrajaya", "SMK Tunku Abdul Rahman", "SMK Santubong", "SMK Semerah Padi", "SMK Green Road", "SMK Bandar Kuching No. 1", "Kolej Datu Patinggi Abang Haji Abdillah", "SMK Pending", "SMK Batu Lintang", "SMK Padungan", "SMK Tun Abang Haji Openg", "SMK Tinggi Kuching", "SMK St Joseph (M)", "SMK St Teresa", "SMK St Thomas (M)", "SMK St Mary (M)", "SMT Sejingkat",
];

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS school_directory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '')`).run();
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO school_directory (name, created_at, updated_at) SELECT DISTINCT TRIM(school), ?, ? FROM members WHERE TRIM(school) != ''`).bind(now, now).run();
  await env.DB.batch(KUCHING_SCHOOLS.map((name) => env.DB.prepare("INSERT OR IGNORE INTO school_directory (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'system-kuching-register')").bind(name, now, now)));
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureSchema();
  const rows = await env.DB.prepare("SELECT id, name, active FROM school_directory WHERE active = 1 ORDER BY name COLLATE NOCASE").all();
  return Response.json({ schools: rows.results });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
  await ensureSchema();
  const body = await request.json() as { action?: string; id?: number; name?: string };
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  if (body.action === "archive") { if (!body.id) return Response.json({ error: "School id required" }, { status: 400 }); await env.DB.prepare("UPDATE school_directory SET active = 0, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), body.id).run(); await writeAuditEvent({ actor: user, action: "school_archived", entityType: "school", entityId: body.id }); return Response.json({ ok: true }); }
  if (!name) return Response.json({ error: "School name is required" }, { status: 400 });
  try { await env.DB.prepare("INSERT INTO school_directory (name, created_at, updated_at, created_by) VALUES (?, ?, ?, ?)").bind(name, new Date().toISOString(), new Date().toISOString(), user.email).run(); } catch { return Response.json({ error: "That school already exists" }, { status: 409 }); }
  await writeAuditEvent({ actor: user, action: "school_created", entityType: "school", after: { name } });
  return Response.json({ ok: true });
}
