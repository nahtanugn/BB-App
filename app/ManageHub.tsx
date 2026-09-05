"use client";

import { useEffect, useState } from "react";
import type { AppRoute, ShellUser } from "./AppShell";
import ExpansionCentre from "./ExpansionCentre";

type Tool = { route: AppRoute; label: string; description: string; icon: string };
type CountRow = { rule_key?: string; total?: number };
type PersonalRequestSummary = { awards: { pending: number; total: number }; uniforms: { active: number; total: number } };

export default function ManageHub({
  user,
  stockAccess,
  activeSection,
  onOpen,
}: {
  user: ShellUser;
  stockAccess: boolean;
  activeSection: "senior" | "junior";
  onOpen: (route: AppRoute) => void;
}) {
  const [workCounts, setWorkCounts] = useState<Record<string, number>>({});
  const [personalRequests, setPersonalRequests] = useState<PersonalRequestSummary | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const counts: Record<string, number> = {};
      try {
        const response = await fetch("/api/automation", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { counts?: CountRow[] };
          (result.counts ?? []).forEach((row) => { if (row.rule_key) counts[row.rule_key] = Number(row.total ?? 0); });
        }
        if (stockAccess) {
          const response = await fetch("/api/stock?dashboard=1", { cache: "no-store" });
          if (response.ok) {
            const result = await response.json() as { dashboard?: { requests?: Array<{ status: string }>; lowStock?: unknown[] } };
            const requests = result.dashboard?.requests ?? [];
            counts.uniform_requests = requests.filter((request) => ["pending", "approved", "ready"].includes(request.status)).length;
            counts.low_stock = result.dashboard?.lowStock?.length ?? 0;
          }
        }
      } catch { /* Work counts are supplemental; keep the hub usable when they are unavailable. */ }
      if (active) setWorkCounts(counts);
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [stockAccess]);
  useEffect(() => {
    if (!["member", "nco", "squad_leader"].includes(user.role)) return;
    let active = true;
    Promise.all([
      fetch("/api/submissions", { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as { submissions?: Array<{ status: string }> } : { submissions: [] }),
      fetch("/api/uniform-requests", { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as { ownRequests?: Array<{ status: string }> } : { ownRequests: [] }),
    ]).then(([awards, uniforms]) => {
      if (!active) return;
      const awardRows = awards.submissions ?? [];
      const uniformRows = uniforms.ownRequests ?? [];
      setPersonalRequests({
        awards: { total: awardRows.length, pending: awardRows.filter((row) => row.status === "pending").length },
        uniforms: { total: uniformRows.length, active: uniformRows.filter((row) => ["pending", "approved", "ready"].includes(row.status)).length },
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user.role]);
  const temporaryAdmin = Boolean(
    user.role !== "viewer" &&
      user.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const operational = ["admin", "officer", "viewer"].includes(user.role) || temporaryAdmin;
  const staff = operational || ["nco", "squad_leader"].includes(user.role) || user.custom_permissions.some((permission) =>
    ["members.", "attendance.", "awards.", "subscriptions.", "exports."].some((prefix) => permission.startsWith(prefix)),
  );
  const mayReviewSubmissions = operational || user.custom_permissions.some((permission) => ["submissions.view", "submissions.review"].includes(permission));
  const maySubmit = activeSection !== "junior" && (["member", "nco", "squad_leader"].includes(user.role) || mayReviewSubmissions);
  const mayExport = operational || user.custom_permissions.includes("exports.full");

  const requestTools: Tool[] = [
    ...(maySubmit ? [{ route: "submissions" as const, label: mayReviewSubmissions ? "Award submissions" : "My award submissions", description: mayReviewSubmissions ? "Review applications and decisions" : "Submit and track award applications", icon: "◆" }] : []),
  ];
  const stockTools: Tool[] = [
    { route: "uniforms", label: user.role === "member" ? "My uniform requests" : "Uniform requests", description: user.role === "member" ? "Request and track uniform parts" : "Review, prepare and issue requests", icon: "▤" },
    ...(stockAccess ? [{ route: "stock" as const, label: "Stock Centre", description: "Uniform and award inventory", icon: "▣" }] : []),
  ];
  const adminTools: Tool[] = [
    ...(["admin", "officer", "viewer"].includes(user.role) ? [{ route: "admin" as const, label: user.role === "officer" ? "Junior rank review" : "Accounts and roles", description: user.role === "officer" ? "Review Junior member ranks" : "Accounts, access and school directory", icon: "⚙" }] : []),
    ...(staff ? [{ route: "onboarding" as const, label: "Onboarding", description: "Registrations and profile corrections", icon: "◎" }] : []),
    ...(["admin", "viewer"].includes(user.role) ? [{ route: "automation" as const, label: "Automation", description: "Rules, reminders and run history", icon: "↻" }] : []),
    ...(mayExport ? [{ route: "exports" as const, label: "Export Centre", description: "School reports and secure backups", icon: "↓" }] : []),
    ...(["admin", "officer", "viewer"].includes(user.role) ? [{ route: "company-statistics" as const, label: "Company Statistics", description: "Annual form and locked snapshots", icon: "▤" }] : []),
    ...(["admin", "officer", "viewer"].includes(user.role) ? [{ route: "storage-usage" as const, label: "Storage & usage", description: "D1 and private document safeguards", icon: "◫" }] : []),
  ];
  const groups = [
    { title: "Requests", description: "Applications and items waiting for action", tools: requestTools },
    { title: "Stock", description: "Uniform requests, inventory and issued items", tools: stockTools },
    { title: "Administration", description: "Accounts, data and company controls", tools: adminTools },
  ].filter((group) => group.tools.length);
  const countFor = (route: AppRoute) => route === "submissions" ? (workCounts.award_reviews ?? 0) : route === "uniforms" ? (workCounts.uniform_requests ?? 0) : route === "stock" ? (workCounts.low_stock ?? 0) : route === "onboarding" ? (workCounts.incomplete_onboarding ?? 0) + (workCounts.data_quality ?? 0) : 0;
  const openTool = (route: AppRoute) => {
    if (route === "storage-usage" || route === "presidents-badge") { window.location.assign(`/?open=${route}&section=${activeSection}`); return; }
    onOpen(route);
  };

  return <main className="manage-hub-page">
    <header className="category-page-header"><div><p className="eyebrow">MANAGE</p><h1>{staff ? "Manage" : "My requests"}</h1><p>{staff ? "Requests, stock and administration are grouped by purpose." : "Submit requests and follow their progress from one place."}</p></div></header>
    <div className="manage-group-grid">
      {personalRequests && <section className="panel personal-request-summary"><div className="panel-heading"><div><p className="eyebrow">MY REQUESTS</p><h2>Request status</h2><p>A quick view of your award and uniform applications.</p></div><span>{personalRequests.uniforms.total + (activeSection === "junior" ? 0 : personalRequests.awards.total)}</span></div><div className="personal-request-cards">{activeSection !== "junior" && <button type="button" onClick={() => onOpen("submissions")}><strong>Award submissions</strong><span>{personalRequests.awards.pending ? `${personalRequests.awards.pending} awaiting review` : `${personalRequests.awards.total} submitted`}</span><b>›</b></button>}<button type="button" onClick={() => onOpen("uniforms")}><strong>Uniform requests</strong><span>{personalRequests.uniforms.active ? `${personalRequests.uniforms.active} active` : `${personalRequests.uniforms.total} submitted`}</span><b>›</b></button></div></section>}
      {groups.map((group) => <section className="panel manage-group" key={group.title}>
        <div className="panel-heading"><div><p className="eyebrow">{group.title.toUpperCase()}</p><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.tools.reduce((total, tool) => total + countFor(tool.route), 0) || group.tools.length}</span></div>
        <div className="manage-tool-list">
          {group.tools.map((tool) => {
            const count = countFor(tool.route);
            return <button type="button" onClick={() => openTool(tool.route)} key={tool.route}>
            <span aria-hidden="true">{tool.icon}</span><div><strong>{tool.label}</strong><small>{tool.description}</small></div>{count > 0 && <em aria-label={`${count} pending`}>{count}</em>}<b>›</b>
          </button>;
          })}
        </div>
      </section>)}
    </div>
    {staff && <ExpansionCentre user={user} />}
  </main>;
}
