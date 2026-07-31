"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Rule = {
  rule_key: string;
  enabled: number;
  reminder_days: string;
  recipient_roles: string;
  due_month_day: string;
};
type Run = {
  id: number;
  run_type: string;
  status: string;
  started_at: string;
  created_count: number;
  resolved_count: number;
  notification_count: number;
  error_message: string;
};
type Settings = { daily_time: string; weekly_time: string };

export default function AutomationCentre({ readOnly }: { readOnly: boolean }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [allowedRoles, setAllowedRoles] = useState<Record<string, string[]>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<Settings>({ daily_time: "08:00", weekly_time: "08:00" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/automation?management=1", { cache: "no-store" });
    const result = (await response.json()) as {
      rules?: Rule[]; runs?: Run[]; settings?: Settings;
      definitions?: Array<{ key: string; label: string; roles: string[] }>; error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? "Unable to load automation settings");
    setRules(result.rules ?? []);
    setRuns(result.runs ?? []);
    setSettings(result.settings ?? { daily_time: "08:00", weekly_time: "08:00" });
    setLabels(Object.fromEntries((result.definitions ?? []).map((item) => [item.key, item.label])));
    setAllowedRoles(Object.fromEntries((result.definitions ?? []).map((item) => [item.key, item.roles])));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load automation")), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>, ruleKey: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_rule", ruleKey,
        enabled: form.get("enabled") === "on",
        reminderDays: String(form.get("reminderDays") ?? "").split(",").map((value) => Number(value.trim())),
        recipientRoles: form.getAll("recipientRoles"),
        dueMonthDay: form.get("dueMonthDay"),
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to save rule");
    setNotice(result.message ?? "Rule saved.");
    await load();
  }

  async function runNow() {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/automation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_now" }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to run automation");
    setNotice(result.message ?? "Automation completed.");
    await load();
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_schedule",
        dailyTime: form.get("dailyTime"),
        weeklyTime: form.get("weeklyTime"),
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to save schedule");
    setNotice(result.message ?? "Automation schedule saved.");
    await load();
  }

  return (
    <main className="automation-page">
      <header className="automation-hero">
        <div><p className="eyebrow">AUTOMATED OPERATIONS</p><h1>Automation Centre</h1><p>Daily checks run at 08:00 Malaysia time. The system creates follow-up work but never makes official decisions.</p></div>
        {!readOnly && <button className="primary" disabled={busy} onClick={runNow}>{busy ? "Running…" : "Run checks now"}</button>}
      </header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      <form className="automation-schedule" onSubmit={saveSchedule} key={`${settings.daily_time}:${settings.weekly_time}`}>
        <div><p className="eyebrow">MALAYSIA TIME</p><h2>Run schedule</h2><p>Checks are claimed once per period, even when Cloudflare retries a scheduled event.</p></div>
        <label>Daily checks<input name="dailyTime" type="time" step="900" defaultValue={settings.daily_time} disabled={readOnly} /></label>
        <label>Monday summary<input name="weeklyTime" type="time" step="900" defaultValue={settings.weekly_time} disabled={readOnly} /></label>
        {!readOnly && <button disabled={busy}>Save schedule</button>}
      </form>
      <section className="automation-rule-grid">
        {rules.map((rule) => {
          const subscription = rule.rule_key.includes("subscription");
          let reminderDays = [3, 7];
          let selectedRoles: string[] = [];
          try {
            const parsedDays = JSON.parse(rule.reminder_days);
            if (Array.isArray(parsedDays)) reminderDays = parsedDays.map(Number);
            const parsedRoles = JSON.parse(rule.recipient_roles);
            if (Array.isArray(parsedRoles)) selectedRoles = parsedRoles.map(String);
          } catch {
            // Preserve safe defaults if a legacy settings row is malformed.
          }
          return (
            <form onSubmit={(event) => save(event, rule.rule_key)} key={rule.rule_key}>
              <div><span className={rule.enabled ? "enabled" : ""} /><div><h2>{labels[rule.rule_key] ?? rule.rule_key}</h2><p>{subscription ? "Reminders remain inactive until a due date is entered." : "Creates deduplicated Action Centre tasks and safe notifications."}</p></div></div>
              <label className="checkbox-row"><input name="enabled" type="checkbox" defaultChecked={Boolean(rule.enabled)} disabled={readOnly} /> Enabled</label>
              <label>Reminder days<input name="reminderDays" defaultValue={reminderDays.join(", ")} disabled={readOnly} /></label>
              <fieldset className="automation-recipients">
                <legend>Notify roles</legend>
                {(allowedRoles[rule.rule_key] ?? []).map((role) => (
                  <label className="checkbox-row" key={role}>
                    <input
                      name="recipientRoles"
                      type="checkbox"
                      value={role}
                      defaultChecked={selectedRoles.includes(role)}
                      disabled={readOnly}
                    />
                    {role.replaceAll("_", " ")}
                  </label>
                ))}
              </fieldset>
              {subscription && <label>Due month and day<input name="dueMonthDay" type="text" pattern="\\d{2}-\\d{2}" placeholder="MM-DD" defaultValue={rule.due_month_day} disabled={readOnly} /></label>}
              {!readOnly && <button disabled={busy}>Save rule</button>}
            </form>
          );
        })}
      </section>
      <section className="automation-history">
        <div><p className="eyebrow">RUN HISTORY</p><h2>Recent checks</h2></div>
        <div>
          {runs.map((run) => (
            <article key={run.id}>
              <span className={run.status} />
              <div><strong>{run.status === "completed" ? "Checks completed" : run.status === "failed" ? "Checks failed" : "Checks running"}</strong><small>{new Date(run.started_at).toLocaleString("en-MY")} · {run.run_type}</small>{run.error_message && <p>{run.error_message}</p>}</div>
              <b>{run.created_count} new · {run.resolved_count} resolved · {run.notification_count} alerts</b>
            </article>
          ))}
          {!runs.length && <p className="empty-inline">No automation runs yet.</p>}
        </div>
      </section>
    </main>
  );
}
