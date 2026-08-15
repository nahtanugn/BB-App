"use client";

import type { AppRoute, ShellUser } from "./AppShell";

type Tool = { route: AppRoute; label: string; description: string; icon: string };

export default function ManageHub({
  user,
  stockAccess,
  onOpen,
}: {
  user: ShellUser;
  stockAccess: boolean;
  onOpen: (route: AppRoute) => void;
}) {
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
  const maySubmit = user.member_section !== "junior" && (["member", "nco", "squad_leader"].includes(user.role) || mayReviewSubmissions);
  const mayExport = operational || user.custom_permissions.includes("exports.full");

  const requestTools: Tool[] = [
    ...(maySubmit ? [{ route: "submissions" as const, label: mayReviewSubmissions ? "Award submissions" : "My award submissions", description: mayReviewSubmissions ? "Review applications and decisions" : "Submit and track award applications", icon: "◆" }] : []),
    { route: "uniforms", label: user.role === "member" ? "My uniform requests" : "Uniform requests", description: user.role === "member" ? "Request and track uniform parts" : "Review, prepare and issue requests", icon: "▤" },
  ];
  const stockTools: Tool[] = stockAccess ? [
    { route: "stock", label: "Stock Centre", description: "Uniform and award inventory", icon: "▣" },
  ] : [];
  const adminTools: Tool[] = [
    ...(["admin", "officer", "viewer"].includes(user.role) ? [{ route: "admin" as const, label: user.role === "officer" ? "Junior rank review" : "Accounts & roles", description: user.role === "officer" ? "Review Junior member ranks" : "Accounts, access and school directory", icon: "⚙" }] : []),
    ...(staff ? [{ route: "onboarding" as const, label: "Onboarding", description: "Registrations and profile corrections", icon: "◎" }] : []),
    ...(["admin", "viewer"].includes(user.role) ? [{ route: "automation" as const, label: "Automation", description: "Rules, reminders and run history", icon: "↻" }] : []),
    ...(mayExport ? [{ route: "exports" as const, label: "Export Centre", description: "School reports and secure backups", icon: "↓" }] : []),
  ];
  const groups = [
    { title: "Requests", description: "Applications and items waiting for action", tools: requestTools },
    { title: "Stock", description: "Inventory and issued items", tools: stockTools },
    { title: "Administration", description: "Accounts, data and company controls", tools: adminTools },
  ].filter((group) => group.tools.length);

  return <main className="manage-hub-page">
    <header className="category-page-header"><div><p className="eyebrow">MANAGE</p><h1>{staff ? "Company tools" : "My requests"}</h1><p>{staff ? "Open the area you need without searching through a long menu." : "Submit requests and follow their progress from one place."}</p></div></header>
    <div className="manage-group-grid">
      {groups.map((group) => <section className="panel manage-group" key={group.title}>
        <div className="panel-heading"><div><p className="eyebrow">{group.title.toUpperCase()}</p><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.tools.length}</span></div>
        <div className="manage-tool-list">
          {group.tools.map((tool) => <button type="button" onClick={() => onOpen(tool.route)} key={tool.route}>
            <span aria-hidden="true">{tool.icon}</span><div><strong>{tool.label}</strong><small>{tool.description}</small></div><b>›</b>
          </button>)}
        </div>
      </section>)}
    </div>
  </main>;
}
