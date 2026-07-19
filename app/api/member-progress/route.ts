import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role !== "member")
      return Response.json(
        { error: "Member access required" },
        { status: 403 },
      );

    const member = await env.DB.prepare(
      "SELECT id, name, rank, squad, section, service_award_count FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
    )
      .bind(user.email)
      .first<{
        id: number;
        name: string;
        rank: string;
        squad: string;
        section: string;
        service_award_count: number;
      }>();
    if (!member)
      return Response.json({ linked: false, accountEmail: user.email });

    const [awards, progress, attendance] = await Promise.all([
      env.DB.prepare(
        "SELECT code, name, category, basic_available, advanced_available FROM award_definitions WHERE section = ? AND code NOT IN ('arts_crafts_hobbies', 'band_proficiency', 'scholastic', 'duke_of_edinburgh', 'three_year_service', 'long_year_service') ORDER BY sort_order",
      )
        .bind(member.section)
        .all(),
      env.DB.prepare(
        "SELECT award_code, level, status FROM member_awards WHERE member_id = ? AND award_code != 'duke_of_edinburgh'",
      )
        .bind(member.id)
        .all(),
      env.DB.prepare(
        `SELECT
        COUNT(s.id) AS total,
        COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present,
        COALESCE(SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent,
        COALESCE(SUM(CASE WHEN ar.status = 'excused' THEN 1 ELSE 0 END), 0) AS excused
        FROM attendance_sessions s
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.member_id = ?
        WHERE s.section = ?`,
      )
        .bind(member.id, member.section)
        .first<{
          total: number;
          present: number;
          absent: number;
          excused: number;
        }>(),
    ]);

    const total = Number(attendance?.total ?? 0);
    const present = Number(attendance?.present ?? 0);
    const absent = Number(attendance?.absent ?? 0);
    const excused = Number(attendance?.excused ?? 0);
    return Response.json({
      linked: true,
      member,
      awards: awards.results,
      progress: progress.results,
      attendance: {
        total,
        present,
        absent,
        excused,
        unmarked: Math.max(0, total - present - absent - excused),
        percentage: total ? Math.round((present / total) * 100) : 0,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load member progress",
      },
      { status: 500 },
    );
  }
}
