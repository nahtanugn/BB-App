"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type AppRoute =
  | "home"
  | "company-overview"
  | "awards"
  | "members"
  | "attendance"
  | "subscriptions"
  | "submissions"
  | "resources"
  | "uniforms"
  | "stock"
  | "announcements"
  | "admin"
  | "onboarding"
  | "automation";

export type ShellUser = {
  name: string;
  email: string;
  role: "admin" | "officer" | "nco" | "squad_leader" | "viewer" | "member";
  squad: string;
  member_section: string;
  temporary_access_role: string;
  access_expires_at: string | null;
  custom_permissions: string[];
};

type NavItem = {
  route: AppRoute;
  label: string;
  description: string;
  icon: string;
  badge?: number;
};

export default function AppShell({
  user,
  route,
  onNavigate,
  onAccount,
  onLogout,
  stockAccess,
  announcementCount = 0,
  onboardingCount = 0,
  actionCount = 0,
  children,
}: {
  user: ShellUser;
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onAccount: () => void;
  onLogout: () => void;
  stockAccess: boolean;
  announcementCount?: number;
  onboardingCount?: number;
  actionCount?: number;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const temporaryAdmin = Boolean(
    user.role !== "viewer" &&
      user.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const operational = ["admin", "officer", "viewer"].includes(user.role) || temporaryAdmin;
  const customTrackerAccess = user.custom_permissions.some((permission) =>
    ["members.", "attendance.", "awards.", "subscriptions.", "exports."]
      .some((prefix) => permission.startsWith(prefix)),
  );
  const staff = operational || ["nco", "squad_leader"].includes(user.role) || customTrackerAccess;
  const seniorApplicant =
    user.member_section !== "junior" &&
    ["member", "nco", "squad_leader"].includes(user.role);
  const mayReviewSubmissions =
    operational ||
    user.custom_permissions.some((permission) =>
      ["submissions.view", "submissions.review"].includes(permission),
    );

  const items = useMemo(() => {
    const values: NavItem[] = [
      {
        route: "home",
        label: ["member", "nco", "squad_leader"].includes(user.role) ? "Home" : "Overview",
        description: "Tasks and company priorities",
        icon: "⌂",
        badge: actionCount,
      },
    ];
    if (staff) {
      values.push(
        { route: "awards", label: "Awards", description: "Award matrix and progress", icon: "▦" },
        { route: "members", label: "Members", description: "Member profiles and details", icon: "♙" },
        { route: "attendance", label: "Attendance", description: "Parade registers", icon: "✓" },
      );
    } else {
      values.push(
        { route: "awards", label: "My progress", description: "My attendance and awards", icon: "▦" },
        { route: "resources", label: "Resources", description: "Member resources", icon: "↗" },
        { route: "uniforms", label: "Requests", description: "Uniform and award requests", icon: "▤" },
      );
    }
    if (staff)
      values.push({ route: "subscriptions", label: "Subscriptions", description: "Yearly payment status", icon: "◇" });
    if (staff)
      values.push({ route: "company-overview", label: "Company overview", description: "Company dashboard", icon: "◫" });
    if ((seniorApplicant || mayReviewSubmissions) && user.member_section !== "junior")
      values.push({ route: "submissions", label: mayReviewSubmissions ? "Submission portal" : "My submissions", description: "Award applications and decisions", icon: "◆" });
    if (staff)
      values.push({ route: "resources", label: "Resources", description: "Company materials", icon: "↗" });
    if (!values.some((item) => item.route === "uniforms"))
      values.push({ route: "uniforms", label: "Uniform requests", description: "Request and issue uniform parts", icon: "▤" });
    if (stockAccess)
      values.push({ route: "stock", label: "Stock Centre", description: "Uniform and award inventory", icon: "▣" });
    values.push({
      route: "announcements",
      label: "Announcements",
      description: "Company-wide notices",
      icon: "◉",
      badge: announcementCount,
    });
    if (["admin", "viewer"].includes(user.role))
      values.push({ route: "admin", label: "Admin Centre", description: "Accounts, roles and access", icon: "⚙" });
    if (staff)
      values.push({
        route: "onboarding",
        label: "Onboarding",
        description: "Registrations and corrections",
        icon: "◎",
        badge: onboardingCount,
      });
    if (["admin", "viewer"].includes(user.role))
      values.push({ route: "automation", label: "Automation", description: "Rules, runs and reminders", icon: "↻" });
    return values;
  }, [
    actionCount,
    announcementCount,
    mayReviewSubmissions,
    onboardingCount,
    seniorApplicant,
    staff,
    stockAccess,
    user.member_section,
    user.role,
  ]);

  const primary = items.slice(0, 4);
  const secondary = items.filter(
    (item) => !primary.some((primaryItem) => primaryItem.route === item.route),
  );

  useEffect(() => {
    if (!moreOpen) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [moreOpen]);

  function navigate(next: AppRoute) {
    setMoreOpen(false);
    onNavigate(next);
  }

  return (
    <div className="unified-app-shell">
      <aside className="unified-sidebar">
        <div className="unified-brand">
          <div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" />
          <div><strong>11KCHBB App</strong><span>{user.role.replaceAll("_", " ")} access</span></div>
        </div>
        <nav aria-label="Application navigation">
          {items.map((item) => (
            <button
              type="button"
              className={route === item.route ? "active" : ""}
              aria-current={route === item.route ? "page" : undefined}
              onClick={() => navigate(item.route)}
              key={item.route}
            >
              <span aria-hidden="true">{item.icon}</span>
              <div><strong>{item.label}</strong><small>{item.description}</small></div>
              {Boolean(item.badge) && <b>{item.badge! > 99 ? "99+" : item.badge}</b>}
            </button>
          ))}
        </nav>
        <div className="unified-user">
          <button type="button" onClick={onAccount}>
            <span>{user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
          </button>
          <button type="button" className="unified-signout" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <div className="unified-app-content">{children}</div>

      <nav className="unified-mobile-nav" aria-label="Mobile application navigation">
        {primary.map((item) => (
          <button
            type="button"
            className={route === item.route ? "active" : ""}
            aria-current={route === item.route ? "page" : undefined}
            onClick={() => navigate(item.route)}
            key={item.route}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
            {Boolean(item.badge) && <b>{item.badge! > 99 ? "99+" : item.badge}</b>}
          </button>
        ))}
        <button
          type="button"
          className={moreOpen || secondary.some((item) => item.route === route) ? "active" : ""}
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-controls="unified-more-menu"
        >
          <span aria-hidden="true">•••</span><small>More</small>
        </button>
      </nav>

      {moreOpen && (
        <div className="unified-more-backdrop" role="presentation" onMouseDown={() => setMoreOpen(false)}>
          <section
            id="unified-more-menu"
            className="unified-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><p className="eyebrow">NAVIGATION</p><h2>More</h2></div>
              <button ref={closeButton} type="button" onClick={() => setMoreOpen(false)} aria-label="Close navigation">×</button>
            </header>
            <div className="unified-more-list">
              {secondary.map((item) => (
                <button type="button" className={route === item.route ? "active" : ""} onClick={() => navigate(item.route)} key={item.route}>
                  <span aria-hidden="true">{item.icon}</span>
                  <div><strong>{item.label}</strong><small>{item.description}</small></div>
                  {Boolean(item.badge) ? <b>{item.badge}</b> : <b>›</b>}
                </button>
              ))}
              <button type="button" onClick={() => { setMoreOpen(false); onAccount(); }}>
                <span aria-hidden="true">♙</span><div><strong>My account</strong><small>Password and account details</small></div><b>›</b>
              </button>
              <button type="button" className="danger" onClick={onLogout}>
                <span aria-hidden="true">↪</span><div><strong>Sign out</strong><small>End this session safely</small></div><b>›</b>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
