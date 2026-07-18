"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Member = {
  id: number;
  name: string;
  rank: string;
  squad: string;
  joined_at: string;
  service_years: number;
  school: string;
  contact_number: string;
  emergency_contact_number: string;
  email: string;
  parents_name: string;
  is_demo: number;
};

type Award = {
  code: string;
  name: string;
  category: string;
  basic_available: number;
  advanced_available: number;
};

type Progress = {
  member_id: number;
  award_code: string;
  level: string;
  status: Status;
  awarded_at: string | null;
};

type Status = "not_started" | "in_progress" | "submitted" | "verified" | "awarded";
type AttendanceStatus = "unmarked" | "present" | "absent" | "excused";
type AttendanceSession = { id: number; meeting_date: string; title: string; created_at: string };
type AttendanceRecord = { session_id: number; member_id: number; status: AttendanceStatus };
type TrackerData = {
  members: Member[];
  awards: Award[];
  progress: Progress[];
  attendanceSessions: AttendanceSession[];
  attendance: AttendanceRecord[];
  syllabus: string;
};

const statusOrder: Status[] = ["not_started", "in_progress", "submitted", "verified", "awarded"];
const statusLabel: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
  awarded: "Awarded",
};
const attendanceOrder: AttendanceStatus[] = ["unmarked", "present", "absent", "excused"];
const attendanceLabel: Record<AttendanceStatus, string> = { unmarked: "Unmarked", present: "Present", absent: "Absent", excused: "Excused" };

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function joinedMonth(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

type AwardTrackerProps = {
  user?: { name: string; email: string; role: "admin" | "officer" | "nco" };
  onLogout?: () => void;
  onManageAccount?: () => void;
  onOpenResources?: () => void;
  onOpenSubmissions?: () => void;
};

export default function AwardTracker({ user, onLogout, onManageAccount, onOpenResources, onOpenSubmissions }: AwardTrackerProps) {
  const isNco = user?.role === "nco";
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Compulsory");
  const [level, setLevel] = useState<"basic" | "advanced">("basic");
  const [view, setView] = useState<"dashboard" | "matrix" | "members" | "attendance">(isNco ? "attendance" : "dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [saving, setSaving] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/tracker", { cache: "no-store" });
      const result = (await response.json()) as TrackerData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load the tracker");
      setData(result);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the tracker");
    }
  }

  useEffect(() => {
    fetch("/api/tracker", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as TrackerData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load the tracker");
        setData(result);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load the tracker");
      });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>();
    data?.progress.forEach((item) => map.set(`${item.member_id}:${item.award_code}:${item.level}`, item));
    return map;
  }, [data]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    data?.attendance.forEach((item) => map.set(`${item.session_id}:${item.member_id}`, item));
    return map;
  }, [data]);

  const activeSession = data?.attendanceSessions.find((session) => session.id === activeSessionId) ?? data?.attendanceSessions[0] ?? null;

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.members ?? []).filter((member) =>
      !term || `${member.name} ${member.rank} ${member.squad}`.toLowerCase().includes(term),
    );
  }, [data, query]);

  const visibleAwards = useMemo(
    () => (data?.awards ?? []).filter((award) => award.category === category && (level === "basic" ? award.basic_available : award.advanced_available)),
    [data, category, level],
  );

  function memberStats(member: Member) {
    const rows = (data?.progress ?? []).filter((item) => item.member_id === member.id);
    const awarded = rows.filter((item) => item.status === "awarded").length;
    const active = rows.filter((item) => ["in_progress", "submitted", "verified"].includes(item.status)).length;
    return { awarded, active };
  }

  function presidentReadiness(member: Member) {
    const isAwarded = (code: string, awardLevel: string) => progressMap.get(`${member.id}:${code}:${awardLevel}`)?.status === "awarded";
    const checks = [
      isAwarded("nco_proficiency", "advanced"),
      isAwarded("christian_education", "advanced"),
      isAwarded("drill", "advanced"),
      isAwarded("recruitment", "basic"),
      member.service_years >= 3,
    ];
    const groupAwards = (data?.awards ?? []).filter((award) => /^[A-D] ·/.test(award.category));
    const best = groupAwards.map((award) => ({
      category: award.category[0],
      level: isAwarded(award.code, "advanced") ? "advanced" : isAwarded(award.code, "basic") ? "basic" : null,
    })).filter((item) => item.level);
    const categories = new Set(best.map((item) => item.category));
    checks.push(best.length >= 6, categories.size === 4, best.filter((item) => item.level === "basic").length >= 2, best.filter((item) => item.level === "advanced").length >= 4);
    const complete = checks.filter(Boolean).length;
    return { complete, total: checks.length, percent: Math.round((complete / checks.length) * 100) };
  }

  async function updateAward(memberId: number, awardCode: string) {
    const key = `${memberId}:${awardCode}:${level}`;
    const current = progressMap.get(key)?.status ?? "not_started";
    const next = statusOrder[(statusOrder.indexOf(current) + 1) % statusOrder.length];
    setSaving(key);
    setData((existing) => existing ? {
      ...existing,
      progress: [...existing.progress.filter((item) => `${item.member_id}:${item.award_code}:${item.level}` !== key), {
        member_id: memberId, award_code: awardCode, level, status: next, awarded_at: next === "awarded" ? new Date().toISOString() : null,
      }],
    } : existing);
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_award", memberId, awardCode, level, status: next }),
    });
    if (!response.ok) await load();
    setSaving("");
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const wasEditing = Boolean(editingMember);
    setNotice("");
    setSaving(editingMember ? `member-${editingMember.id}` : "new-member");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingMember ? "update_member" : "create_member",
        memberId: editingMember?.id,
        name: form.get("name"), rank: form.get("rank"), squad: form.get("squad"),
        joinedAt: form.get("joinedAt"), serviceYears: form.get("serviceYears"),
        school: form.get("school"), contactNumber: form.get("contactNumber"),
        emergencyContactNumber: form.get("emergencyContactNumber"), email: form.get("email"), parentsName: form.get("parentsName"),
      }),
    });
    setSaving("");
    if (response.ok) {
      setShowAdd(false);
      setEditingMember(null);
      await load();
      setNotice(wasEditing ? "Member details updated successfully." : "Member created successfully.");
    }
  }

  function openAddMember() {
    setEditingMember(null);
    setShowAdd(true);
  }

  function openEditMember(member: Member) {
    setEditingMember(member);
    setShowAdd(true);
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} and their award records?`)) return;
    await fetch("/api/tracker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_member", memberId: member.id }) });
    await load();
  }

  async function createAttendanceSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice("");
    setSaving("new-session");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_attendance_session", meetingDate: form.get("meetingDate"), title: form.get("title") }),
    });
    setSaving("");
    if (response.ok) {
      setShowSession(false);
      await load();
      setActiveSessionId(null);
      setNotice("Attendance meeting created successfully.");
    }
  }

  async function updateAttendance(sessionId: number, memberId: number, status: AttendanceStatus) {
    const key = `attendance-${sessionId}-${memberId}`;
    setSaving(key);
    setData((existing) => existing ? {
      ...existing,
      attendance: [...existing.attendance.filter((item) => !(item.session_id === sessionId && item.member_id === memberId)), { session_id: sessionId, member_id: memberId, status }],
    } : existing);
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_attendance", sessionId, memberId, status }),
    });
    if (!response.ok) await load();
    setSaving("");
  }

  async function deleteAttendanceSession(session: AttendanceSession) {
    if (!window.confirm(`Delete attendance for ${session.title} on ${session.meeting_date}?`)) return;
    await fetch("/api/tracker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_attendance_session", sessionId: session.id }) });
    setActiveSessionId(null);
    await load();
  }

  function exportCsv() {
    if (!data) return;
    const lines = [["Member", "Rank", "Squad", "Award", "Level", "Status"]];
    data.members.forEach((member) => data.awards.forEach((award) => ["basic", "advanced"].forEach((awardLevel) => {
      if ((awardLevel === "basic" && !award.basic_available) || (awardLevel === "advanced" && !award.advanced_available)) return;
      lines.push([member.name, member.rank, member.squad, award.name, awardLevel, progressMap.get(`${member.id}:${award.code}:${awardLevel}`)?.status ?? "not_started"]);
    })));
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `11kchbb-app-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (error) return <main className="loading-state"><div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" /><h1>11KCHBB App</h1><p>{error}</p><button onClick={load}>Try again</button></main>;
  if (!data) return <main className="loading-state"><div className="brand-mark app-photo pulse" role="img" aria-label="11th Kuching Company" /><p>Preparing your award records…</p></main>;

  const awardedTotal = data.progress.filter((item) => item.status === "awarded").length;
  const pendingTotal = data.progress.filter((item) => ["submitted", "verified"].includes(item.status)).length;
  const categories = [...new Set(data.awards.map((award) => award.category))];

  return (
    <div className="app-shell">
      {notice && <div className="action-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" /><div><strong>11KCHBB App</strong><span>{isNco ? "NCO attendance" : "Senior Section tracker"}</span></div></div>
        <nav className={isNco ? "nco-nav" : ""} aria-label="Primary navigation">
          {!isNco && <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><span>⌂</span> Overview</button>}
          {!isNco && <button className={view === "matrix" ? "active" : ""} onClick={() => setView("matrix")}><span>▦</span> Award matrix</button>}
          {!isNco && <button className={view === "members" ? "active" : ""} onClick={() => setView("members")}><span>♙</span> Members</button>}
          <button className={view === "attendance" ? "active" : ""} onClick={() => setView("attendance")}><span>✓</span> Attendance</button>
          {!isNco && <button onClick={onOpenSubmissions}><span>⇧</span> Submissions</button>}
          <button onClick={onOpenResources}><span>↗</span> Resources</button>
        </nav>
        <div className="sidebar-note"><span>SYLLABUS</span><strong>August 2024</strong><small>BB Malaysia Senior Section</small></div>
        <div className="open-source"><span>◈</span><div><strong>Open source</strong><small>MIT licensed</small></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">{view === "dashboard" ? "COMPANY OVERVIEW" : view === "matrix" ? "AWARD PROGRESS" : view === "members" ? "MEMBER DIRECTORY" : "PARADE REGISTER"}</p><h1>{view === "dashboard" ? "Shalom" : view === "matrix" ? "Award matrix" : view === "members" ? "Members" : "Attendance"}</h1></div>
          <div className="top-actions"><label className="search"><span>⌕</span><input aria-label="Search members" placeholder="Search members" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{user && <button className="account-chip" onClick={onManageAccount} title={user.email}>{initials(user.name)}<span>{user.name.split(" ")[0]}</span></button>}{onLogout && <button className="sign-out" onClick={onLogout}>Sign out</button>}{view === "attendance" ? <button className="primary" onClick={() => setShowSession(true)}>＋ New meeting</button> : <button className="primary" onClick={openAddMember}>＋ Add member</button>}</div>
        </header>

        {view === "dashboard" && <>
          <section className="stat-grid" aria-label="Company statistics">
            <article className="stat-card blue"><div><span>ACTIVE MEMBERS</span><strong>{data.members.length}</strong><small>Across {new Set(data.members.map((member) => member.squad)).size} squads</small></div><div className="stat-icon">♙</div></article>
            <article className="stat-card gold"><div><span>AWARDS EARNED</span><strong>{awardedTotal}</strong><small>Recorded completions</small></div><div className="stat-icon">✦</div></article>
            <article className="stat-card green"><div><span>AWAITING REVIEW</span><strong>{pendingTotal}</strong><small>Submitted or verified</small></div><div className="stat-icon">✓</div></article>
            <article className="stat-card navy"><div><span>SYLLABUS AWARDS</span><strong>{data.awards.length}</strong><small>Including service & special</small></div><div className="stat-icon">▤</div></article>
          </section>
          <section className="dashboard-grid">
            <article className="panel member-progress"><div className="panel-heading"><div><p className="eyebrow">MEMBER PROGRESS</p><h2>President’s Award pathway</h2></div><button className="text-button" onClick={() => setView("members")}>View all →</button></div>
              <div className="progress-list">{filteredMembers.slice(0, 5).map((member) => { const readiness = presidentReadiness(member); return <div className="progress-row" key={member.id}><div className="avatar">{initials(member.name)}</div><div className="member-meta"><strong>{member.name}</strong><span>{member.rank}</span></div><div className="progress-track"><div style={{ width: `${readiness.percent}%` }} /></div><strong className="percent">{readiness.percent}%</strong></div>; })}</div>
            </article>
            <article className="panel quick-actions"><div className="panel-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Keep parade moving</h2></div></div>
              <button onClick={() => setView("matrix")}><span className="action-icon">▦</span><span><strong>Update award progress</strong><small>Tap through member statuses</small></span><b>›</b></button>
              <button onClick={openAddMember}><span className="action-icon">＋</span><span><strong>Register a member</strong><small>Add rank, squad and service</small></span><b>›</b></button>
              <button onClick={() => setView("attendance")}><span className="action-icon">✓</span><span><strong>Take attendance</strong><small>Open the latest parade register</small></span><b>›</b></button>
              <button onClick={exportCsv}><span className="action-icon">↓</span><span><strong>Export records</strong><small>Download a spreadsheet-ready CSV</small></span><b>›</b></button>
            </article>
          </section>
        </>}

        {view === "matrix" && <section className="panel matrix-panel">
          <div className="matrix-toolbar"><div className="category-tabs" role="tablist">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="level-toggle"><button className={level === "basic" ? "active" : ""} onClick={() => setLevel("basic")}>Basic</button><button className={level === "advanced" ? "active" : ""} onClick={() => setLevel("advanced")}>Advanced</button></div></div>
          <div className="matrix-help"><span>Tap a status to move it forward</span><div>{statusOrder.slice(1).map((status) => <span key={status} className={`legend ${status}`}>{statusLabel[status]}</span>)}</div></div>
          <div className="table-scroll"><table className="award-matrix"><thead><tr><th>Member</th>{visibleAwards.map((award) => <th key={award.code}>{award.name}</th>)}</tr></thead><tbody>{filteredMembers.map((member) => <tr key={member.id}><th><div className="table-member"><div className="avatar small">{initials(member.name)}</div><div><strong>{member.name}</strong><span>{member.rank}</span></div></div></th>{visibleAwards.map((award) => { const key = `${member.id}:${award.code}:${level}`; const status = progressMap.get(key)?.status ?? "not_started"; return <td key={award.code}><button disabled={saving === key} className={`status-pill ${status}`} onClick={() => updateAward(member.id, award.code)} aria-label={`${member.name}, ${award.name}: ${statusLabel[status]}`}>{saving === key ? "…" : status === "not_started" ? "—" : statusLabel[status]}</button></td>; })}</tr>)}</tbody></table></div>
        </section>}

        {view === "members" && <section className="member-grid">{filteredMembers.map((member) => { const stats = memberStats(member); const readiness = presidentReadiness(member); return <article className="member-card" key={member.id}><div className="member-card-top"><div className="avatar large">{initials(member.name)}</div><div className="card-actions"><button className="edit-member" aria-label={`Edit ${member.name}`} onClick={() => openEditMember(member)}>Edit</button><button className="more" aria-label={`Remove ${member.name}`} onClick={() => deleteMember(member)}>×</button></div></div><h2>{member.name}</h2><p>{member.rank} · Joined {joinedMonth(member.joined_at)}</p><div className="member-numbers"><div><strong>{stats.awarded}</strong><span>Awards</span></div><div><strong>{stats.active}</strong><span>Active</span></div><div><strong>{member.service_years}</strong><span>Years</span></div></div><div className="readiness"><div><span>President’s Award</span><strong>{readiness.complete}/{readiness.total}</strong></div><div className="progress-track"><div style={{ width: `${readiness.percent}%` }} /></div></div></article>; })}</section>}

        {view === "attendance" && <section className="attendance-layout">
          <aside className="panel session-list"><div className="panel-heading"><div><p className="eyebrow">MEETINGS</p><h2>Attendance dates</h2></div></div>{data.attendanceSessions.length ? <div className="session-buttons">{data.attendanceSessions.map((session) => { const present = data.attendance.filter((item) => item.session_id === session.id && item.status === "present").length; return <button key={session.id} className={activeSession?.id === session.id ? "active" : ""} onClick={() => setActiveSessionId(session.id)}><span><strong>{session.title}</strong><small>{new Date(`${session.meeting_date}T00:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</small></span><b>{present}/{data.members.length}</b></button>; })}</div> : <div className="empty-state"><strong>No meetings yet</strong><p>Create your first meeting to start taking attendance.</p><button className="primary" onClick={() => setShowSession(true)}>New meeting</button></div>}</aside>
          <article className="panel attendance-register">{activeSession ? <><div className="panel-heading attendance-heading"><div><p className="eyebrow">ATTENDANCE REGISTER</p><h2>{activeSession.title}</h2><small>{new Date(`${activeSession.meeting_date}T00:00:00`).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</small></div>{!isNco && <button className="danger-link" onClick={() => deleteAttendanceSession(activeSession)}>Delete meeting</button>}</div><div className="attendance-summary">{(["present", "absent", "excused", "unmarked"] as AttendanceStatus[]).map((status) => <span key={status} className={status}><strong>{filteredMembers.filter((member) => (attendanceMap.get(`${activeSession.id}:${member.id}`)?.status ?? "unmarked") === status).length}</strong> {attendanceLabel[status]}</span>)}</div><div className="attendance-rows">{filteredMembers.map((member) => { const key = `attendance-${activeSession.id}-${member.id}`; const current = attendanceMap.get(`${activeSession.id}:${member.id}`)?.status ?? "unmarked"; return <div className="attendance-row" key={member.id}><div className="avatar small">{initials(member.name)}</div><div className="member-meta"><strong>{member.name}</strong><span>{member.rank}</span></div><div className="attendance-options" role="group" aria-label={`${member.name} attendance`}>{attendanceOrder.slice(1).map((status) => <button key={status} disabled={saving === key} className={`${status} ${current === status ? "active" : ""}`} onClick={() => updateAttendance(activeSession.id, member.id, current === status ? "unmarked" : status)}>{attendanceLabel[status]}</button>)}</div></div>; })}</div></> : <div className="empty-state large"><strong>Select or create a meeting</strong><p>The register will appear here.</p></div>}</article>
        </section>}
      </main>

      {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowAdd(false); setEditingMember(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{editingMember ? "EDIT PROFILE" : "NEW PROFILE"}</p><h2 id="add-title">{editingMember ? "Member details" : "Add a Senior member"}</h2></div><button onClick={() => { setShowAdd(false); setEditingMember(null); }} aria-label="Close">×</button></div><form key={editingMember?.id ?? "new"} onSubmit={saveMember}><label>Full name<input name="name" required autoFocus placeholder="e.g. Michelle Tan" defaultValue={editingMember?.name ?? ""} /></label><div className="form-row"><label>Rank<select name="rank" defaultValue={editingMember?.rank ?? "Private"}><option>Private</option><option>Lance Corporal</option><option>Corporal</option><option>Sergeant</option><option>Staff Sergeant</option></select></label><label>Squad<select name="squad" defaultValue={editingMember?.squad ?? "Alpha"}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label></div><div className="form-row"><label>Joined on<input name="joinedAt" type="month" defaultValue={editingMember?.joined_at.slice(0, 7) ?? new Date().toISOString().slice(0, 7)} /></label><label>Service years<input name="serviceYears" type="number" min="0" defaultValue={editingMember?.service_years ?? 0} /></label></div><div className="form-row"><label>School<input name="school" defaultValue={editingMember?.school ?? ""} /></label><label>Email<input name="email" type="email" defaultValue={editingMember?.email ?? ""} /></label></div><div className="form-row"><label>Contact Number<input name="contactNumber" type="tel" defaultValue={editingMember?.contact_number ?? ""} /></label><label>Emergency Contact Number<input name="emergencyContactNumber" type="tel" defaultValue={editingMember?.emergency_contact_number ?? ""} /></label></div><label>Parents Name<input name="parentsName" defaultValue={editingMember?.parents_name ?? ""} /></label><button className="primary submit" disabled={Boolean(saving)}>{saving ? "Saving…" : editingMember ? "Save details" : "Add member"}</button></form></section></div>}

      {showSession && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSession(false)}><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="session-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">NEW REGISTER</p><h2 id="session-title">Create a meeting</h2></div><button onClick={() => setShowSession(false)} aria-label="Close">×</button></div><form onSubmit={createAttendanceSession}><label>Meeting name<input name="title" required defaultValue="Weekly Parade" /></label><label>Meeting date<input name="meetingDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><button className="primary submit" disabled={saving === "new-session"}>{saving === "new-session" ? "Creating…" : "Create register"}</button></form></section></div>}
    </div>
  );
}
