import { getCurrentUser, getRuntimeEnv, hasOperationalAdminAccess } from "../../../lib/auth";
import { ensureEventSchema, linkedMember } from "../../../lib/events";

const runtime = getRuntimeEnv();

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureEventSchema();
    const member = await linkedMember(user.email);
    if (!member) return Response.json({ linked: false, accountEmail: user.email });
    const year = new Date().getFullYear();
    const [goals, awards, attendance, events, subscription] = await Promise.all([
      runtime.DB.prepare("SELECT * FROM member_goals WHERE member_id = ? ORDER BY status, created_at DESC").bind(member.id).all(),
      runtime.DB.prepare(`SELECT awards.name, awards.category, progress.level, progress.status FROM member_awards progress
        JOIN award_definitions awards ON awards.code = progress.award_code WHERE progress.member_id = ?
        ORDER BY progress.updated_at DESC LIMIT 8`).bind(member.id).all(),
      runtime.DB.prepare(`SELECT sessions.meeting_date, records.status FROM attendance_records records
        JOIN attendance_sessions sessions ON sessions.id = records.session_id WHERE records.member_id = ?
        ORDER BY sessions.meeting_date DESC LIMIT 8`).bind(member.id).all(),
      runtime.DB.prepare(`SELECT events.id, events.title, events.event_date, events.location, events.section,
        COALESCE(rsvps.status, '') AS rsvp_status FROM company_events events
        LEFT JOIN event_rsvps rsvps ON rsvps.event_id = events.id AND rsvps.member_id = ?
        WHERE events.cancelled_at IS NULL AND events.event_date >= ? AND events.section IN ('all', ?)
        ORDER BY events.event_date ASC LIMIT 5`).bind(member.id, new Date().toISOString().slice(0, 10), member.section).all(),
      runtime.DB.prepare(`SELECT paid, (SELECT status FROM band_subscriptions WHERE member_id = ? AND year = ?) AS band_status
        FROM member_subscriptions WHERE member_id = ? AND year = ?`).bind(member.id, year, member.id, year).first<{ paid: number; band_status: string | null }>(),
    ]);
    const completed = goals.results.filter((goal: { status: string }) => goal.status === "completed").length;
    return Response.json({ linked: true, member, goals: goals.results, awards: awards.results, attendance: attendance.results, upcomingEvents: events.results, subscription: subscription ?? { paid: 0, band_status: null }, summary: { completedGoals: completed, totalGoals: goals.results.length } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load your journey" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "viewer") return Response.json({ error: "Viewer accounts are read-only" }, { status: 403 });
    await ensureEventSchema();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const ownMember = await linkedMember(user.email);
    const targetMemberId = hasOperationalAdminAccess(user) && Number(body.memberId) ? Number(body.memberId) : ownMember?.id;
    if (!targetMemberId) return Response.json({ error: "Your account is not linked to a member profile" }, { status: 409 });
    const now = new Date().toISOString();
    if (action === "create_goal") {
      const title = String(body.title ?? "").trim().slice(0, 140);
      if (!title) return Response.json({ error: "Enter a goal" }, { status: 400 });
      await runtime.DB.prepare("INSERT INTO member_goals (member_id, title, category, status, created_by_user_id, created_at) VALUES (?, ?, ?, 'open', ?, ?)")
        .bind(targetMemberId, title, String(body.category ?? "Personal").trim().slice(0, 40) || "Personal", user.id, now).run();
      return Response.json({ ok: true, message: "Goal added to your journey." });
    }
    if (action === "toggle_goal") {
      const goalId = Number(body.goalId);
      const goal = await runtime.DB.prepare("SELECT member_id, status FROM member_goals WHERE id = ?").bind(goalId).first<{ member_id: number; status: string }>();
      if (!goal || (goal.member_id !== ownMember?.id && !hasOperationalAdminAccess(user))) return Response.json({ error: "Goal not found" }, { status: 404 });
      const complete = goal.status !== "completed";
      await runtime.DB.prepare("UPDATE member_goals SET status = ?, completed_at = ? WHERE id = ?").bind(complete ? "completed" : "open", complete ? now : null, goalId).run();
      return Response.json({ ok: true, message: complete ? "Goal completed—well done." : "Goal reopened." });
    }
    return Response.json({ error: "Unknown journey action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update your journey" }, { status: 500 });
  }
}
