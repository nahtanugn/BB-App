"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { brandingLogoStyle, useBranding } from "./BrandingContext";

export type AppRoute =
  | "home"
  | "manage"
  | "exports"
  | "company-statistics"
  | "operations"
  | "company-overview"
  | "awards"
  | "members"
  | "officers"
  | "associates"
  | "attendance"
  | "subscriptions"
  | "submissions"
  | "resources"
  | "uniforms"
  | "stock"
  | "announcements"
  | "admin"
  | "onboarding"
  | "automation"
  | "events"
  | "journey"
  | "parades"
  | "duties"
  | "committees"
  | "leave"
  | "promotion"
  | "service"
  | "band";

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
  category: "Home" | "People & Progress" | "Programme & Events" | "Requests & Operations" | "Communication" | "Administration";
  label: string;
  description: string;
  icon: string;
  badge?: number;
};

export type AppHub = "home" | "people" | "programme" | "manage";

const routeHub: Record<AppRoute, AppHub> = {
  home: "home",
  operations: "home",
  "company-overview": "home",
  awards: "people",
  members: "people",
  officers: "people",
  associates: "people",
  attendance: "people",
  subscriptions: "people",
  journey: "people",
  leave: "people",
  promotion: "people",
  service: "people",
  events: "programme",
  parades: "programme",
  duties: "programme",
  committees: "programme",
  band: "programme",
  resources: "programme",
  announcements: "programme",
  manage: "manage",
  submissions: "manage",
  uniforms: "manage",
  stock: "manage",
  admin: "manage",
  onboarding: "manage",
  automation: "manage",
  exports: "manage",
  "company-statistics": "manage",
};

export function hubForRoute(route: AppRoute): AppHub {
  return routeHub[route];
}

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
  notificationCount = 0,
  onNotifications,
  activeSection,
  onSectionChange,
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
  notificationCount?: number;
  onNotifications: () => void;
  activeSection?: "senior" | "junior";
  onSectionChange?: (section: "senior" | "junior") => void;
  children: ReactNode;
}) {
  const branding = useBranding();
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
        category: "Home",
        label: ["member", "nco", "squad_leader"].includes(user.role) ? "Home" : "Overview",
        description: "Tasks and company priorities",
        icon: "⌂",
        badge: actionCount,
      },
    ];
    if (staff) {
      values.push(
        { route: "awards", category: "People & Progress", label: "Awards", description: "Award matrix and progress", icon: "▦" },
        { route: "members", category: "People & Progress", label: "Members", description: "Member profiles and details", icon: "♙" },
        { route: "attendance", category: "People & Progress", label: "Attendance", description: "Parade registers", icon: "✓" },
        { route: "subscriptions", category: "People & Progress", label: "Subscriptions", description: "Yearly payment status", icon: "◇" },
      );
      if (["admin", "officer", "viewer"].includes(user.role))
        values.push(
          { route: "officers", category: "People & Progress", label: "Officers", description: "Officer Section and statistics details", icon: "♜" },
          { route: "associates", category: "People & Progress", label: "Associates & Alumni", description: "Associate Members, Instructors, Helpers and Alumni", icon: "♧" },
        );
    } else {
      values.push(
        { route: "awards", category: "People & Progress", label: "My progress", description: "My attendance and awards", icon: "▦" },
        { route: "resources", category: "Programme & Events", label: "Resources", description: "Member resources", icon: "↗" },
        { route: "uniforms", category: "Requests & Operations", label: "Requests", description: "Uniform and award requests", icon: "▤" },
      );
    }
    values.push({ route: "events", category: "Programme & Events", label: "Meetings and events", description: "Programme, RSVPs and registers", icon: "◫" });
    if (user.role === "member") values.push({ route: "duties", category: "Programme & Events", label: "My duties", description: "Assignments and availability", icon: "✓" });
    if (staff) values.push(
      { route: "parades", category: "Programme & Events", label: "Parade planner", description: "Templates and published programmes", icon: "▤" },
      { route: "duties", category: "Programme & Events", label: "Duty roster", description: "Assignments and substitutions", icon: "✓" },
      { route: "committees", category: "Programme & Events", label: "Committees", description: "Event teams and tasks", icon: "◎" },
    );
    if (operational || user.custom_permissions.some((permission) => permission.startsWith("band.")))
      values.push({ route: "band", category: "Programme & Events", label: "Band Centre", description: "Members, instruments and programme", icon: "♫" });
    if (["member", "nco", "squad_leader"].includes(user.role) || operational || user.custom_permissions.some((permission) => permission.startsWith("leave.")))
      values.push({ route: "leave", category: "People & Progress", label: "Leave", description: "Event absence requests", icon: "↪" });
    if (staff) values.push(
      { route: "promotion", category: "People & Progress", label: "Promotion readiness", description: "Requirements and advisory progress", icon: "↑" },
      { route: "service", category: "People & Progress", label: "Service hours", description: "Submission and verification", icon: "◷" },
    );
    else values.push({ route: "service", category: "People & Progress", label: "My service", description: "Submit and track service hours", icon: "◷" });
    if (["member", "nco", "squad_leader"].includes(user.role))
      values.push({ route: "journey", category: "People & Progress", label: "My journey", description: "Your goals and progress", icon: "◎" });
    if ((seniorApplicant || mayReviewSubmissions) && (activeSection ?? user.member_section) !== "junior")
      values.push({ route: "submissions", category: "Requests & Operations", label: mayReviewSubmissions ? "Submission portal" : "My submissions", description: "Award applications and decisions", icon: "◆" });
    if (staff)
      values.push({ route: "resources", category: "Programme & Events", label: "Resources", description: "Company materials", icon: "↗" });
    if (!values.some((item) => item.route === "uniforms"))
      values.push({ route: "uniforms", category: "Requests & Operations", label: "Uniform requests", description: "Request and issue uniform parts", icon: "▤" });
    if (stockAccess)
      values.push({ route: "stock", category: "Requests & Operations", label: "Stock Centre", description: "Uniform and award inventory", icon: "▣" });
    values.push({
      route: "announcements",
      category: "Programme & Events",
      label: "Announcements",
      description: "Company-wide notices",
      icon: "◉",
      badge: announcementCount,
    });
    if (["admin", "officer", "viewer"].includes(user.role))
      values.push({ route: "admin", category: "Administration", label: user.role === "officer" ? "Junior rank review" : "Admin Centre", description: user.role === "officer" ? "Review Junior member ranks" : "Accounts, roles and access", icon: "⚙" });
    if (staff)
      values.push({
        route: "onboarding",
        category: "Administration",
        label: "Onboarding",
        description: "Registrations and corrections",
        icon: "◎",
        badge: onboardingCount,
      });
    if (["admin", "viewer"].includes(user.role))
      values.push({ route: "automation", category: "Administration", label: "Automation", description: "Rules, runs and reminders", icon: "↻" });
    if (operational || user.custom_permissions.includes("exports.full"))
      values.push({ route: "exports", category: "Administration", label: "Export Centre", description: "Reports and secure backups", icon: "↓" });
    if (["admin", "officer", "viewer"].includes(user.role))
      values.push({ route: "company-statistics", category: "Administration", label: "Company Statistics", description: "Annual form and snapshots", icon: "▤" });
    return values;
  }, [
    actionCount,
    activeSection,
    announcementCount,
    mayReviewSubmissions,
    onboardingCount,
    seniorApplicant,
    staff,
    stockAccess,
    operational,
    user.custom_permissions,
    user.member_section,
    user.role,
  ]);

  const activeHub = hubForRoute(route);
  const orderedItems = (routes: AppRoute[]) => routes.map((itemRoute) => items.find((item) => item.route === itemRoute)).filter((item): item is NavItem => Boolean(item));
  const hubItems = {
    home: items.filter((item) => hubForRoute(item.route) === "home"),
    people: orderedItems(["members", "officers", "associates", "awards", "attendance", "subscriptions", "leave", "promotion", "service", "journey"]),
    programme: orderedItems(["events", "parades", "duties", "committees", "band", "resources", "announcements"]),
    manage: items.filter((item) => hubForRoute(item.route) === "manage"),
  } satisfies Record<AppHub, NavItem[]>;
  const hubDefinitions: Array<{ hub: AppHub; label: string; memberLabel?: string; description: string; icon: string; route: AppRoute; badge?: number }> = [
    { hub: "home", label: "Home", description: "Priorities and updates", icon: "⌂", route: "home", badge: actionCount },
    { hub: "people", label: "People", memberLabel: "Progress", description: staff ? "Members, awards and attendance" : "My progress", icon: "♙", route: staff ? "members" : "awards" },
    { hub: "programme", label: "Programme", description: "Meetings, resources and notices", icon: "◫", route: "events" },
    { hub: "manage", label: staff ? "Manage" : "Requests", description: staff ? "Requests, stock and administration" : "My requests", icon: "◆", route: "manage" },
  ];
  const contextItems = activeHub === "people" || activeHub === "programme" ? hubItems[activeHub] : [];

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
          <div className="brand-mark app-photo" style={brandingLogoStyle(branding)} role="img" aria-label={branding.companyName} />
          <div><strong>{branding.appName}</strong><span>{user.role.replaceAll("_", " ")} access</span></div>
        </div>
        {activeSection && onSectionChange && <div className="unified-section-control" role="group" aria-label="Working section">
          <span>WORKING SECTION</span>
          <div>
            <button type="button" className={activeSection === "senior" ? "active" : ""} aria-pressed={activeSection === "senior"} onClick={() => onSectionChange("senior")}>Senior</button>
            <button type="button" className={activeSection === "junior" ? "active" : ""} aria-pressed={activeSection === "junior"} onClick={() => onSectionChange("junior")}>Junior</button>
          </div>
        </div>}
        <nav aria-label="Application navigation">
          <p className="unified-hub-caption">WORK HUBS</p>
          {hubDefinitions.map((item) => (
            <button type="button" className={activeHub === item.hub ? "active" : ""} aria-current={activeHub === item.hub ? "page" : undefined} onClick={() => navigate(item.route)} key={item.hub}>
              <span aria-hidden="true">{item.icon}</span><div><strong>{item.memberLabel && !staff ? item.memberLabel : item.label}</strong><small>{item.description}</small></div>{Boolean(item.badge) && <b>{item.badge! > 99 ? "99+" : item.badge}</b>}
            </button>
          ))}
        </nav>
        <div className="unified-user">
          <button type="button" className="unified-notifications" onClick={onNotifications}>
            <span aria-hidden="true">♢</span><div><strong>Notifications</strong><small>{notificationCount ? `${notificationCount} unread` : "No unread updates"}</small></div>{notificationCount > 0 && <b>{notificationCount > 99 ? "99+" : notificationCount}</b>}
          </button>
          <button type="button" onClick={onAccount}>
            <span>{user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
          </button>
          <button type="button" className="unified-signout" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <div className="unified-app-content">
        {activeSection && onSectionChange && <header className="unified-mobile-header">
          <strong>{branding.shortName}</strong>
          <div className="unified-mobile-section-control" role="group" aria-label="Working section">
            <button type="button" className={activeSection === "senior" ? "active" : ""} aria-pressed={activeSection === "senior"} onClick={() => onSectionChange("senior")}>Senior</button>
            <button type="button" className={activeSection === "junior" ? "active" : ""} aria-pressed={activeSection === "junior"} onClick={() => onSectionChange("junior")}>Junior</button>
          </div>
          <button type="button" className="unified-mobile-notifications" onClick={onNotifications} aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}>♢{notificationCount > 0 && <b>{notificationCount > 99 ? "99+" : notificationCount}</b>}</button>
        </header>}
        {contextItems.length > 1 && <div className="unified-context-nav">
          <div className="unified-context-tabs" role="tablist" aria-label={`${activeHub} sections`}>
            {contextItems.map((item) => <button type="button" role="tab" aria-selected={route === item.route} className={route === item.route ? "active" : ""} onClick={() => navigate(item.route)} key={item.route}>{item.label}</button>)}
          </div>
          <label className="unified-context-select"><span>{activeHub === "people" ? "People section" : "Programme section"}</span><select value={route} onChange={(event) => navigate(event.target.value as AppRoute)}>{contextItems.map((item) => <option value={item.route} key={item.route}>{item.label}</option>)}</select></label>
        </div>}
        {activeHub === "manage" && route !== "manage" && <button type="button" className="unified-manage-return" onClick={() => navigate("manage")}>← Back to Manage</button>}
        {children}
      </div>

      <nav className="unified-mobile-nav" aria-label="Mobile application navigation">
        {hubDefinitions.map((item) => (
          <button
            type="button"
            className={activeHub === item.hub ? "active" : ""}
            aria-current={activeHub === item.hub ? "page" : undefined}
            onClick={() => navigate(item.route)}
            key={item.hub}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.memberLabel && !staff ? item.memberLabel : item.label}</small>
            {Boolean(item.badge) && <b>{item.badge! > 99 ? "99+" : item.badge}</b>}
          </button>
        ))}
        <button
          type="button"
          className={moreOpen ? "active" : ""}
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
              <button type="button" onClick={() => { setMoreOpen(false); onNotifications(); }}>
                <span aria-hidden="true">♢</span><div><strong>Notifications</strong><small>{notificationCount ? `${notificationCount} unread updates` : "You’re all caught up"}</small></div>{notificationCount ? <b>{notificationCount}</b> : <b>›</b>}
              </button>
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
