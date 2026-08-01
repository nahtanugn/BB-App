import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import {
  AUTOMATION_RULES,
  ensureAutomationSchema,
  runAutomation,
} from "../../../lib/automation";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureAutomationSchema(env.DB);
    const url = new URL(request.url);
    if (url.searchParams.get("management") === "1") {
      if (!["admin", "viewer"].includes(user.role))
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const [rules, runs, settings] = await Promise.all([
        env.DB.prepare("SELECT * FROM automation_rules ORDER BY rule_key").all(),
        env.DB.prepare("SELECT * FROM automation_runs ORDER BY started_at DESC LIMIT 30").all(),
        env.DB.prepare("SELECT daily_time, weekly_time FROM automation_settings WHERE id = 1").first(),
      ]);
      return Response.json({
        rules: rules.results,
        definitions: AUTOMATION_RULES.map(([key, label, roles]) => ({ key, label, roles })),
        runs: runs.results,
        settings,
        readOnly: user.role === "viewer",
        schedule: {
          daily: "08:00 Asia/Kuching",
          weekly: "Monday 08:00 Asia/Kuching",
        },
      });
    }
    const items = await env.DB.prepare(`SELECT * FROM automation_action_items
      WHERE recipient_user_id = ? AND status IN ('open','snoozed')
        AND (snoozed_until IS NULL OR snoozed_until <= ?)
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        COALESCE(due_at, first_seen_at), first_seen_at`)
      .bind(user.id, new Date().toISOString()).all();
    const counts = await env.DB.prepare(`SELECT rule_key, COUNT(*) AS total FROM automation_action_items
      WHERE recipient_user_id = ? AND status IN ('open','snoozed')
        AND (snoozed_until IS NULL OR snoozed_until <= ?)
      GROUP BY rule_key`).bind(user.id, new Date().toISOString()).all();
    return Response.json({
      items: items.results,
      counts: counts.results,
      summary: counts.results,
      preview: items.results.slice(0, 3),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load automation" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureAutomationSchema(env.DB);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();

    if (action === "dismiss_item" || action === "snooze_item") {
      if (user.role === "viewer")
        return Response.json({ error: "Viewer accounts are read-only" }, { status: 403 });
      const itemId = Number(body.itemId);
      if (!itemId) return Response.json({ error: "Invalid action item" }, { status: 400 });
      if (action === "dismiss_item")
        await env.DB.prepare(`UPDATE automation_action_items SET status = 'dismissed', resolved_at = ?
          WHERE id = ? AND recipient_user_id = ?`).bind(now, itemId, user.id).run();
      else {
        const days = Math.max(1, Math.min(14, Number(body.days) || 1));
        const until = new Date(Date.now() + days * 86400000).toISOString();
        await env.DB.prepare(`UPDATE automation_action_items SET status = 'snoozed', snoozed_until = ?
          WHERE id = ? AND recipient_user_id = ?`).bind(until, itemId, user.id).run();
      }
      return Response.json({ ok: true, message: action === "dismiss_item" ? "Task dismissed." : "Task snoozed." });
    }

    if (action === "update_rule") {
      if (user.role !== "admin")
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const ruleKey = String(body.ruleKey ?? "");
      if (!AUTOMATION_RULES.some(([key]) => key === ruleKey))
        return Response.json({ error: "Unknown automation rule" }, { status: 400 });
      const reminderDays = [...new Set(
        (Array.isArray(body.reminderDays) ? body.reminderDays : [3, 7])
          .map(Number)
          .filter((day) => Number.isInteger(day) && day >= 1 && day <= 30),
      )].sort((a, b) => a - b).slice(0, 3);
      if (!reminderDays.length)
        return Response.json({ error: "Choose at least one reminder day from 1 to 30" }, { status: 400 });
      const dueMonthDay = String(body.dueMonthDay ?? "");
      if (dueMonthDay && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dueMonthDay))
        return Response.json({ error: "Enter a valid due month and day" }, { status: 400 });
      const definition = AUTOMATION_RULES.find(([key]) => key === ruleKey)!;
      const allowedRoles = definition[2] as readonly string[];
      const recipientRoles = [...new Set(
        (Array.isArray(body.recipientRoles) ? body.recipientRoles : allowedRoles)
          .map(String)
          .filter((role) => allowedRoles.includes(role)),
      )];
      if (!recipientRoles.length)
        return Response.json({ error: "Choose at least one authorised recipient role" }, { status: 400 });
      await env.DB.prepare(`UPDATE automation_rules SET enabled = ?, reminder_days = ?,
        recipient_roles = ?, due_month_day = ?, updated_by = ?, updated_at = ? WHERE rule_key = ?`)
        .bind(
          body.enabled === false ? 0 : 1,
          JSON.stringify(reminderDays),
          JSON.stringify(recipientRoles),
          dueMonthDay,
          user.id,
          now,
          ruleKey,
        ).run();
      return Response.json({ ok: true, message: "Automation rule saved." });
    }

    if (action === "update_schedule") {
      if (user.role !== "admin")
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const dailyTime = String(body.dailyTime ?? "");
      const weeklyTime = String(body.weeklyTime ?? "");
      const safeTime = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;
      if (!safeTime.test(dailyTime) || !safeTime.test(weeklyTime))
        return Response.json({ error: "Choose times in 15-minute intervals" }, { status: 400 });
      await env.DB.prepare(`UPDATE automation_settings SET daily_time = ?, weekly_time = ?,
        updated_by = ?, updated_at = ? WHERE id = 1`)
        .bind(dailyTime, weeklyTime, user.id, now).run();
      return Response.json({ ok: true, message: "Automation schedule saved." });
    }

    if (action === "run_now") {
      if (user.role !== "admin")
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const result = await runAutomation(env.DB, "manual");
      return Response.json({ ok: true, result, message: "Automation refresh completed." });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update automation" },
      { status: 500 },
    );
  }
}
