"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import AwardTracker from "./AwardTracker";
import ActionCentre from "./ActionCentre";
import Announcements from "./Announcements";
import AdminCentre from "./AdminCentre";
import AppShell, { type AppRoute } from "./AppShell";
import AutomationCentre from "./AutomationCentre";
import CustomRoleManager from "./CustomRoleManager";
import ResourceLibrary from "./ResourceLibrary";
import StockCentre from "./StockCentre";
import SubmissionsPage from "./SubmissionsPage";
import UniformRequests from "./UniformRequests";
import OnboardingFlow from "./OnboardingFlow";
import OnboardingCentre from "./OnboardingCentre";
import MemberProgress from "./MemberProgress";
import EventCentre from "./EventCentre";
import MemberJourney from "./MemberJourney";
import ManageHub from "./ManageHub";
import NotificationCentre from "./NotificationCentre";
import ExportCentre from "./ExportCentre";
import ManagedSchoolSelect from "./ManagedSchoolSelect";
import PublicInformation from "./PublicInformation";
import CompanyStatisticsCentre from "./CompanyStatisticsCentre";
import OfficerSection from "./OfficerSection";
import CompanyOperationsCentre, { type OperationsModule } from "./CompanyOperationsCentre";
import { brandingLogoStyle, useBranding } from "./BrandingContext";

type User = {
  id: number;
  email: string;
  name: string;
  role:
    | "admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "viewer"
    | "member";
  squad: string;
  member_section: string;
  temporary_access_role: string;
  access_expires_at: string | null;
  custom_permissions: string[];
  account_status: "pending" | "active" | "rejected";
  must_change_password: number;
  onboarding_completed_at: string | null;
  profile_confirmed_at: string | null;
  tour_completed_at: string | null;
  privacy_notice_version: number;
  current_privacy_version: number;
  onboarding_required: boolean;
};
type ManagedUser = User & {
  active: number;
  created_at: string;
};
type PendingMember = {
  id: number;
  email: string;
  name: string;
  squad: string;
  section: "senior" | "junior";
  created_at: string;
};
type AuthState = {
  user: User | null;
  setupRequired: boolean;
  adminEmail?: string;
};

export default function StandaloneApp() {
  const branding = useBranding();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [route, setRoute] = useState<AppRoute>("home");
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [showPublicInformation, setShowPublicInformation] = useState(() => typeof window !== "undefined" && new URL(window.location.href).searchParams.get("public") === "1");
  const [accessRequestNotice, setAccessRequestNotice] = useState("");
  const [onboardingPendingCount, setOnboardingPendingCount] = useState(0);
  const [announcementSummary, setAnnouncementSummary] = useState<{
    unreadCount: number;
    latest: { title: string; body: string; priority: string } | null;
  }>({ unreadCount: 0, latest: null });
  // `null` means the permission check is still in flight. Keeping that state
  // distinct from a genuine denial prevents a valid Stock Centre deep link
  // from being replaced with Home before the server has answered.
  const [stockAccess, setStockAccess] = useState<boolean | null>(null);
  const [actionCount, setActionCount] = useState(0);
  const [submissionSection, setSubmissionSection] = useState<
    "senior" | "junior"
  >("senior");
  const [activeSection, setActiveSection] = useState<"senior" | "junior">(() => {
    if (typeof window === "undefined") return "senior";
    const requested = new URL(window.location.href).searchParams.get("section");
    if (requested === "junior" || requested === "senior") return requested;
    return window.localStorage.getItem("bb-company-app-active-section") === "junior" ? "junior" : "senior";
  });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingAccountMember, setPendingAccountMember] =
    useState<PendingMember | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [newUserRole, setNewUserRole] = useState<User["role"]>("officer");
  const [newTemporaryAccessRole, setNewTemporaryAccessRole] = useState("");
  const hasTemporaryAdminAccess = Boolean(
    auth?.user?.role !== "viewer" &&
      auth?.user?.temporary_access_role === "temporary_admin" &&
      auth.user.access_expires_at &&
      auth.user.access_expires_at > new Date().toISOString(),
  );
  const signedInUserId = auth?.user?.id ?? null;
  const hasCustomTrackerAccess = Boolean(
    auth?.user?.custom_permissions?.some((permission) =>
      [
        "members.",
        "attendance.",
        "awards.",
        "subscriptions.",
        "exports.",
      ].some((prefix) => permission.startsWith(prefix)),
    ),
  );
  const isStaff = Boolean(
    auth?.user &&
      (["admin", "officer", "nco", "squad_leader", "viewer"].includes(auth.user.role) ||
        hasTemporaryAdminAccess ||
        hasCustomTrackerAccess),
  );

  const navigate = useCallback((next: AppRoute, replace = false) => {
    if (!auth?.user) return;
    const requested: AppRoute = ["operations", "company-overview"].includes(next) ? "home" : next;
    const operational =
      ["admin", "officer", "viewer"].includes(auth.user.role) ||
      hasTemporaryAdminAccess;
    const staff =
      operational ||
      ["nco", "squad_leader"].includes(auth.user.role) ||
      hasCustomTrackerAccess;
    const allowed =
      ["home", "manage"].includes(requested) ||
      ["resources", "uniforms", "announcements"].includes(requested) ||
      requested === "events" ||
      (["parades", "duties", "committees", "promotion", "service", "leave", "band"].includes(requested) &&
        (staff || ["member", "nco", "squad_leader"].includes(auth.user.role) ||
          auth.user.custom_permissions.some((permission) => ["programme.", "leave.", "promotion.", "service.", "band."].some((prefix) => permission.startsWith(prefix))))) ||
      (requested === "journey" &&
        ["member", "nco", "squad_leader"].includes(auth.user.role)) ||
      (requested === "stock" && stockAccess) ||
      (["members", "attendance", "subscriptions"].includes(requested) && staff) ||
      (requested === "officers" && ["admin", "officer", "viewer"].includes(auth.user.role)) ||
      (requested === "awards" && (staff || auth.user.role === "member")) ||
      (requested === "submissions" &&
        activeSection !== "junior" &&
        (["member", "nco", "squad_leader"].includes(auth.user.role) ||
          operational ||
          auth.user.custom_permissions.some((permission) =>
            ["submissions.view", "submissions.review"].includes(permission),
          ))) ||
      (requested === "onboarding" && staff) ||
      (requested === "admin" && ["admin", "officer", "viewer"].includes(auth.user.role)) ||
      (requested === "automation" && ["admin", "viewer"].includes(auth.user.role)) ||
      (requested === "exports" && (operational || auth.user.custom_permissions.includes("exports.full"))) ||
      (requested === "company-statistics" && ["admin", "officer", "viewer"].includes(auth.user.role));

    const safeRoute = allowed ? requested : "home";
    setRoute(safeRoute);
    const params = new URLSearchParams();
    if (safeRoute !== "home") params.set("open", safeRoute);
    params.set("section", activeSection);
    const url = `/?${params.toString()}`;
    window.history[replace ? "replaceState" : "pushState"]({ route: safeRoute }, "", url);
  }, [activeSection, auth, hasCustomTrackerAccess, hasTemporaryAdminAccess, stockAccess]);

  const switchActiveSection = useCallback((next: "senior" | "junior") => {
    setActiveSection(next);
    setSubmissionSection(next);
    window.localStorage.setItem("bb-company-app-active-section", next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState({ route }, "", `${url.pathname}${url.search}`);
  }, [route]);

  async function refreshAuth() {
    const response = await fetch("/api/auth", { cache: "no-store" });
    const result = (await response.json()) as AuthState & { error?: string };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to check sign-in");
    setAuth(result);
  }

  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AuthState & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to check sign-in");
        setAuth(result);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to check sign-in",
        ),
      );
  }, []);

  useEffect(() => {
    if (!signedInUserId) return;
    fetch("/api/stock?access=1", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { canOpen?: boolean };
        setStockAccess(response.ok && Boolean(result.canOpen));
      })
      .catch(() => setStockAccess(false));
  }, [signedInUserId]);

  useEffect(() => {
    if (!signedInUserId || auth?.user?.onboarding_required) return;
    let cancelled = false;
    const refreshActionCount = () => {
      void fetch("/api/automation", { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as { items?: unknown[] };
          if (!cancelled && response.ok) setActionCount(result.items?.length ?? 0);
        })
        .catch(() => undefined);
    };
    refreshActionCount();
    const interval = window.setInterval(refreshActionCount, 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [auth?.user?.onboarding_required, signedInUserId]);

  useEffect(() => {
    if (!auth?.user || auth.user.onboarding_required) return;
    const target = new URL(window.location.href).searchParams.get("open") as AppRoute | null;
    if (!target) return;
    if (target === "stock" && stockAccess === null) return;
    const timer = window.setTimeout(() => {
      const aliases: Record<string, AppRoute> = {
        "uniform-requests": "uniforms",
        submissions: "submissions",
        onboarding: "onboarding",
        attendance: "attendance",
        members: "members",
        officers: "officers",
        stock: "stock",
        events: "events",
        journey: "journey",
        subscriptions: "subscriptions",
        home: "home",
        admin: "admin",
        operations: "home",
        "company-overview": "home",
        manage: "manage",
        exports: "exports",
        "company-statistics": "company-statistics",
        parades: "parades",
        duties: "duties",
        committees: "committees",
        leave: "leave",
        promotion: "promotion",
        service: "service",
        band: "band",
      };
      navigate(aliases[target] ?? target, true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auth?.user, navigate, stockAccess]);

  useEffect(() => {
    const onPopState = () => {
      const target = new URL(window.location.href).searchParams.get("open") as AppRoute | null;
      navigate(target ?? "home", true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);

  useEffect(() => {
    if (!auth?.user || !["admin", "officer", "nco", "squad_leader", "viewer"].includes(auth.user.role)) return;
    fetch("/api/onboarding?management=1", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as {
          requests?: Array<{ account_status: string }>;
          corrections?: Array<{ status: string }>;
        };
        setOnboardingPendingCount(
          (result.requests ?? []).filter((item) => item.account_status === "pending").length +
          (result.corrections ?? []).filter((item) => item.status === "pending").length,
        );
      })
      .catch(() => undefined);
  }, [signedInUserId, auth?.user]);

  const refreshAnnouncementSummary = useCallback(async () => {
    if (!signedInUserId) return;
    const response = await fetch("/api/announcements/?summary=1", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const result = (await response.json()) as {
      unreadCount?: number;
      latest?: { title: string; body: string; priority: string } | null;
    };
    setAnnouncementSummary({
      unreadCount: Number(result.unreadCount ?? 0),
      latest: result.latest ?? null,
    });
  }, [signedInUserId]);

  const handleAnnouncementsRead = useCallback(() => {
    setAnnouncementSummary({ unreadCount: 0, latest: null });
  }, []);

  useEffect(() => {
    if (!signedInUserId) return;
    const checkAnnouncements = () => {
      fetch("/api/announcements/?summary=1", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const result = (await response.json()) as {
            unreadCount?: number;
            latest?: { title: string; body: string; priority: string } | null;
          };
          setAnnouncementSummary({
            unreadCount: Number(result.unreadCount ?? 0),
            latest: result.latest ?? null,
          });
        })
        .catch(() => undefined);
    };
    checkAnnouncements();
    const announcementTimer = window.setInterval(checkAnnouncements, 60_000);
    return () => window.clearInterval(announcementTimer);
  }, [signedInUserId]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = auth?.setupRequired ? "setup" : "login";
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
        setupToken: form.get("setupToken"),
      }),
    });
    const result = (await response.json()) as { error?: string; status?: string };
    setBusy(false);
    if (result.status === "pending") {
      setAccessRequestNotice(result.error ?? "Your request is awaiting review.");
      return;
    }
    if (!response.ok) return setError(result.error ?? "Unable to sign in");
    await refreshAuth();
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setAccessRequestNotice("");
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request_access",
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        section: form.get("section"),
        squad: form.get("squad"),
        joinedYear: form.get("joinedYear"),
        school: form.get("school"),
        contactNumber: form.get("contactNumber"),
        emergencyContactNumber: form.get("emergencyContactNumber"),
        parentsName: form.get("parentsName"),
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to request access");
    formElement.reset();
    setRequestingAccess(false);
    setAccessRequestNotice(result.message ?? "Access request submitted.");
  }

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setShowAccount(false);
    setRoute("home");
    setStockAccess(null);
    setAnnouncementSummary({ unreadCount: 0, latest: null });
    setAuth((current) => (current ? { ...current, user: null } : current));
  }

  async function loadUsers() {
    const response = await fetch("/api/auth?users=1", { cache: "no-store" });
    const result = (await response.json()) as {
      users?: ManagedUser[];
      pendingMembers?: PendingMember[];
      error?: string;
    };
    if (response.ok) {
      setUsers(result.users ?? []);
      setPendingMembers(result.pendingMembers ?? []);
    }
  }

  async function openAccount() {
    setShowAccount(true);
    setEditingUser(null);
    setPendingAccountMember(null);
    setNewTemporaryAccessRole("");
    setError("");
    setNotice("");
    if (auth?.user?.role === "admin") await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        squad: form.get("squad"),
        temporaryAccessRole: form.get("temporaryAccessRole"),
        accessExpiresOn: form.get("accessExpiresOn"),
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to create account");
    }
    formElement.reset();
    setNewUserRole("officer");
    setNewTemporaryAccessRole("");
    setPendingAccountMember(null);
    setError("");
    await loadUsers();
    setNotice("Account created successfully.");
    setBusy(false);
  }

  async function setUserActive(user: ManagedUser) {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_user_active",
        userId: user.id,
        active: !user.active,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to update account");
    }
    await loadUsers();
    setNotice(`Account ${user.active ? "disabled" : "enabled"} successfully.`);
    setBusy(false);
  }

  async function deleteUser(user: ManagedUser) {
    if (
      !window.confirm(
        `Delete the login account for ${user.name}? Their member profile, attendance, and awards will be preserved.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", userId: user.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to delete account");
    }
    if (editingUser?.id === user.id) setEditingUser(null);
    await loadUsers();
    setNotice("Account deleted successfully. Member records were preserved.");
    setBusy(false);
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_user",
        userId: editingUser.id,
        name: form.get("name"),
        email: form.get("email"),
        role:
          editingUser.id === auth?.user?.id
            ? editingUser.role
            : form.get("role"),
        squad: form.get("squad"),
        temporaryAccessRole:
          editingUser.id === auth?.user?.id
            ? editingUser.temporary_access_role
            : form.get("temporaryAccessRole"),
        accessExpiresOn: form.get("accessExpiresOn"),
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to update account");
    }
    const editedCurrentUser = editingUser.id === auth?.user?.id;
    setEditingUser(null);
    await loadUsers();
    if (editedCurrentUser) await refreshAuth();
    setNotice("Account updated successfully.");
    setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("newPasswordConfirm") ?? "");
    if (confirmation && newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok)
      return setError(result.error ?? "Unable to change password");
    formElement.reset();
    setNotice("Password updated successfully.");
  }

  if (!auth)
    return (
      <main className="loading-state">
        <div className="brand-mark app-photo pulse" style={brandingLogoStyle(branding)} />
        <p>{error || `Opening ${branding.appName}…`}</p>
      </main>
    );

  if (!auth.user && showPublicInformation) return <PublicInformation onBack={() => { setShowPublicInformation(false); window.history.replaceState({}, "", "/"); }} />;

  if (!auth.user)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark app-photo" style={brandingLogoStyle(branding)} />
            <div>
              <strong>{branding.appName}</strong>
              <span>{branding.companyName}</span>
            </div>
          </div>
          <p className="eyebrow">
            {auth.setupRequired ? "FIRST-TIME SETUP" : "ACCOUNT SIGN IN"}
          </p>
          <h1>
            {auth.setupRequired
              ? "Create your administrator account"
              : "Welcome back."}
          </h1>
          <p className="auth-copy">
            {auth.setupRequired
              ? "Use the one-time setup code supplied during deployment."
              : "Sign in to open the areas available to your account."}
          </p>
          {!requestingAccess ? <form onSubmit={submitAuth}>
            {auth.setupRequired && (
              <label>
                Your name
                <input name="name" required autoComplete="name" />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={auth.adminEmail ?? ""}
                readOnly={auth.setupRequired && Boolean(auth.adminEmail)}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete={
                  auth.setupRequired ? "new-password" : "current-password"
                }
              />
            </label>
            {auth.setupRequired && (
              <label>
                One-time setup code
                <input
                  name="setupToken"
                  type="password"
                  required
                  autoComplete="off"
                />
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            {accessRequestNotice && <p className="form-success" role="status">{accessRequestNotice}</p>}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : auth.setupRequired
                  ? "Create administrator"
                  : "Sign in"}
            </button>
          </form> : (
            <form className="access-request-form" onSubmit={requestAccess}>
              <div className="access-request-heading"><div><p className="eyebrow">MEMBER ACCESS</p><h2>Request an account</h2></div><button type="button" className="text-button" onClick={() => { setRequestingAccess(false); setError(""); }}>Back to sign in</button></div>
              <p className="auth-copy">Submit your details for administrator approval. This request does not grant access automatically.</p>
              <label>Full name<input name="name" required autoComplete="name" /></label>
              <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
              <label>Request password<input name="password" type="password" minLength={10} required autoComplete="new-password" /><small>You will replace this after approval.</small></label>
              <div className="form-row"><label>Section<select name="section" defaultValue="senior"><option value="senior">Senior</option><option value="junior">Junior</option></select></label><label>Squad<select name="squad" defaultValue="Alpha"><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label></div>
              <label>Joined year<input name="joinedYear" type="number" min="1950" max={new Date().getFullYear()} required /></label>
              <ManagedSchoolSelect />
              <label>Contact number<input name="contactNumber" type="tel" required /></label>
              <label>Emergency contact number<input name="emergencyContactNumber" type="tel" required /></label>
              <label>Parent / guardian name<input name="parentsName" required /></label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary auth-submit" disabled={busy}>{busy ? "Submitting…" : "Submit access request"}</button>
            </form>
          )}
          {!auth.setupRequired && !requestingAccess && <><button className="request-access-button" onClick={() => { setRequestingAccess(true); setError(""); setAccessRequestNotice(""); }}>Request member access</button><button type="button" className="text-button" onClick={() => { setShowPublicInformation(true); window.history.pushState({}, "", "/?public=1"); }}>Public information</button></>}
          <small>Private by default</small>
        </section>
      </main>
    );

  if (auth.user.onboarding_required)
    return <OnboardingFlow user={auth.user} onComplete={refreshAuth} onLogout={logout} />;
  const currentUser = auth.user;

  const trackerViews: Partial<Record<AppRoute, "matrix" | "members" | "attendance" | "subscriptions">> = {
    awards: "matrix",
    members: "members",
    attendance: "attendance",
    subscriptions: "subscriptions",
  };
  const openTarget = (targetUrl: string) => {
    const target = new URL(targetUrl, window.location.origin).searchParams.get("open");
    const aliases: Record<string, AppRoute> = {
      "uniform-requests": "uniforms",
      submissions: "submissions",
      onboarding: "onboarding",
      attendance: "attendance",
      members: "members",
      officers: "officers",
      stock: "stock",
      events: "events",
      journey: "journey",
      subscriptions: "subscriptions",
      admin: "admin",
      exports: "exports",
      "company-statistics": "company-statistics",
      parades: "parades",
      duties: "duties",
      committees: "committees",
      leave: "leave",
      promotion: "promotion",
      service: "service",
      band: "band",
      manage: "manage",
      home: "home",
    };
    navigate(aliases[target ?? ""] ?? "home");
  };

  let page: ReactNode;
  if (route === "home")
    page = <ActionCentre userName={currentUser.name} userRole={currentUser.role} readOnly={currentUser.role === "viewer"} onOpen={openTarget} onCountChange={setActionCount} announcementSummary={announcementSummary} onAnnouncements={() => navigate("announcements")} />;
  else if (route === "manage")
    page = <ManageHub user={currentUser} stockAccess={Boolean(stockAccess)} activeSection={activeSection} onOpen={navigate} />;
  else if (route === "exports")
    page = <ExportCentre currentYear={new Date().getFullYear()} presentation="page" onComplete={setNotice} />;
  else if (route === "company-statistics" && ["admin", "officer", "viewer"].includes(currentUser.role))
    page = <CompanyStatisticsCentre user={currentUser} currentYear={new Date().getFullYear()} />;
  else if (route === "officers" && ["admin", "officer", "viewer"].includes(currentUser.role))
    page = <OfficerSection role={currentUser.role} />;
  else if (route === "submissions")
    page = <SubmissionsPage user={currentUser} initialSection={submissionSection} onLogout={logout} onBack={() => navigate("home")} />;
  else if (route === "stock")
    page = <StockCentre userName={currentUser.name} onLogout={logout} onBack={() => navigate("home")} />;
  else if (route === "uniforms")
    page = <UniformRequests userName={currentUser.name} onLogout={logout} onBack={() => navigate("home")} />;
  else if (route === "announcements")
    page = <Announcements userName={currentUser.name} onLogout={logout} onBack={() => { navigate("home"); void refreshAnnouncementSummary(); }} onRead={handleAnnouncementsRead} />;
  else if (route === "admin" && ["admin", "officer", "viewer"].includes(currentUser.role))
    page = <AdminCentre currentUser={currentUser} onLogout={logout} onBack={() => { navigate("home"); void refreshAuth(); }} />;
  else if (route === "onboarding" && isStaff)
    page = <OnboardingCentre currentUser={currentUser} onLogout={logout} onBack={() => navigate("home")} />;
  else if (route === "automation" && ["admin", "viewer"].includes(currentUser.role))
    page = <AutomationCentre readOnly={currentUser.role === "viewer"} />;
  else if (route === "resources")
    page = <ResourceLibrary user={currentUser} />;
  else if (route === "awards" && currentUser.role === "member")
    page = <main className="member-progress-page"><MemberProgress user={currentUser} /></main>;
  else if (route === "events")
    page = <EventCentre />;
  else if (["parades", "duties", "committees", "leave", "promotion", "service", "band"].includes(route))
    page = <CompanyOperationsCentre module={route as OperationsModule} activeSection={activeSection} />;
  else if (route === "journey" && ["member", "nco", "squad_leader"].includes(currentUser.role))
    page = <MemberJourney />;
  else {
    const activeView = trackerViews[route] ?? (isStaff ? "members" : "matrix");
    page = (
      <AwardTracker
        key={activeSection}
        embedded
        activeView={activeView}
        user={currentUser}
        onLogout={logout}
        onManageAccount={openAccount}
        announcementSummary={announcementSummary}
        onboardingPendingCount={onboardingPendingCount}
        onOpenSubmissions={(section) => { setSubmissionSection(section); navigate("submissions"); }}
        selectedSection={activeSection}
        onSectionChange={switchActiveSection}
      />
    );
  }

  return <NotificationCentre>{({ open: openNotifications, unreadCount: notificationCount }) => (
    <>
      {!showAccount && notice && <div className="action-toast" role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
      <AppShell
        user={currentUser}
        route={route}
        onNavigate={navigate}
        onAccount={openAccount}
        onLogout={logout}
        stockAccess={Boolean(stockAccess)}
        announcementCount={announcementSummary.unreadCount}
        onboardingCount={onboardingPendingCount}
        actionCount={actionCount}
        notificationCount={notificationCount}
        onNotifications={openNotifications}
        activeSection={isStaff ? activeSection : undefined}
        onSectionChange={isStaff ? switchActiveSection : undefined}
      >
        {page}
      </AppShell>
      {showAccount && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowAccount(false)}
        >
          <section
            className="modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">SIGNED IN</p>
                <h2 id="account-title">{currentUser.name}</h2>
                <small>
                  {currentUser.email} · {currentUser.role}
                </small>
              </div>
              <button onClick={() => setShowAccount(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="account-content">
              <section>
                <h3>Change my password</h3>
                <form className="inline-form" onSubmit={changePassword}>
                  <label>
                    Current password
                    <input name="currentPassword" type="password" required />
                  </label>
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      minLength={10}
                      required
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input name="newPasswordConfirm" type="password" minLength={10} required autoComplete="new-password" />
                  </label>
                  <button className="primary" disabled={busy}>
                    Update password
                  </button>
                </form>
              </section>
              {currentUser.role === "admin" && (
                <section>
                  <div className="account-section-heading">
                    <div>
                      <h3>User accounts</h3>
                      <p>
                        Create accounts or edit existing names, emails and
                        roles.
                      </p>
                    </div>
                  </div>
                  <div className="user-list">
                    {users.map((user) => (
                      <div key={user.id}>
                        <span>
                          <strong>{user.name}</strong>
                          <small>
                            {user.email} · {user.role}
                            {["nco", "squad_leader", "member"].includes(
                              user.role,
                            ) &&
                            user.squad
                              ? ` · ${user.squad}`
                              : ""}
                            {user.temporary_access_role ===
                              "temporary_admin" && user.access_expires_at
                              ? ` · Temporary Admin until ${new Date(user.access_expires_at).toLocaleDateString("en-MY")}`
                              : ""}
                          </small>
                        </span>
                        <div className="user-actions">
                          <button
                            className="text-button"
                            onClick={() => setEditingUser(user)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={user.id === auth.user?.id}
                            className={
                              user.active ? "danger-link" : "text-button"
                            }
                            onClick={() => setUserActive(user)}
                          >
                            {user.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            disabled={user.id === auth.user?.id || busy}
                            className="danger-link"
                            onClick={() => deleteUser(user)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingMembers.map((member) => (
                      <div key={`pending-member-${member.id}`}>
                        <span>
                          <strong>{member.name}</strong>
                          <small>
                            {member.email} · Member · {member.squad} · Login not
                            created
                          </small>
                        </span>
                        <div className="user-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setPendingAccountMember(member);
                              setNewUserRole("member");
                              setNewTemporaryAccessRole("");
                            }}
                          >
                            Create login
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {editingUser && (
                    <form
                      key={editingUser.id}
                      className="create-user-form edit-user-form"
                      onSubmit={updateUser}
                    >
                      <div className="account-section-heading">
                        <h3>Edit account</h3>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setEditingUser(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="form-row">
                        <label>
                          Name
                          <input
                            name="name"
                            required
                            defaultValue={editingUser.name}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            required
                            defaultValue={editingUser.email}
                          />
                        </label>
                      </div>
                      <label>
                        Role
                        <select
                          name="role"
                          value={editingUser.role}
                          onChange={(event) =>
                            setEditingUser({
                              ...editingUser,
                              role: event.target.value as User["role"],
                            })
                          }
                          disabled={editingUser.id === auth.user?.id}
                        >
                          <option value="officer">Officer</option>
                          <option value="nco">
                            NCO · attendance & member details
                          </option>
                          <option value="squad_leader">
                            Squad Leader · full view & NCO controls
                          </option>
                          <option value="viewer">
                            Viewer · full read-only access
                          </option>
                          <option value="member">
                            Member · resources only
                          </option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      <label>
                        Temporary access
                        <select
                          name="temporaryAccessRole"
                          value={editingUser.temporary_access_role}
                          disabled={editingUser.id === auth.user?.id}
                          onChange={(event) =>
                            setEditingUser({
                              ...editingUser,
                              temporary_access_role: event.target.value,
                              access_expires_at:
                                event.target.value === "temporary_admin"
                                  ? editingUser.access_expires_at
                                  : null,
                            })
                          }
                        >
                          <option value="">None</option>
                          <option value="temporary_admin">
                            Temporary Admin · operational access
                          </option>
                        </select>
                        <small>
                          This is additional access and does not change the
                          account’s normal role.
                        </small>
                      </label>
                      {editingUser.temporary_access_role ===
                        "temporary_admin" && (
                        <label>
                          Access expires on
                          <input
                            name="accessExpiresOn"
                            type="date"
                            required
                            min={new Intl.DateTimeFormat("en-CA", {
                              timeZone: "Asia/Kuching",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            }).format(new Date())}
                            defaultValue={
                              editingUser.access_expires_at?.slice(0, 10) ?? ""
                            }
                          />
                          <small>
                            Access ends at midnight Malaysia time on this date.
                          </small>
                        </label>
                      )}
                      {["nco", "squad_leader", "member"].includes(
                        editingUser.role,
                      ) && (
                        <label>
                          Assigned squad
                          <select
                            name="squad"
                            defaultValue={editingUser.squad || "Alpha"}
                          >
                            <option>Alpha</option>
                            <option>Bravo</option>
                            <option>Charlie</option>
                            <option>Delta</option>
                          </select>
                        </label>
                      )}
                      {editingUser.role === "member" && (
                        <label>
                          Member section
                          <select name="memberSection" defaultValue="senior">
                            <option value="senior">Senior</option>
                            <option value="junior">Junior</option>
                          </select>
                        </label>
                      )}
                      {editingUser.id === auth.user?.id && (
                        <small>
                          Your administrator role cannot be changed while you
                          are signed in.
                        </small>
                      )}
                      <button className="primary" disabled={busy}>
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                    </form>
                  )}
                  <form
                    key={pendingAccountMember?.id ?? "new-account"}
                    className="create-user-form"
                    onSubmit={createUser}
                  >
                    <div className="account-section-heading">
                      <div>
                        <h3>
                          {pendingAccountMember
                            ? `Create login for ${pendingAccountMember.name}`
                            : "Add an account"}
                        </h3>
                        {pendingAccountMember && (
                          <p>
                            Set a temporary password to activate this member’s
                            login.
                          </p>
                        )}
                      </div>
                      {pendingAccountMember && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setPendingAccountMember(null);
                            setNewUserRole("officer");
                            setNewTemporaryAccessRole("");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <div className="form-row">
                      <label>
                        Name
                        <input
                          name="name"
                          required
                          readOnly={Boolean(pendingAccountMember)}
                          defaultValue={pendingAccountMember?.name ?? ""}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          name="email"
                          type="email"
                          required
                          readOnly={Boolean(pendingAccountMember)}
                          defaultValue={pendingAccountMember?.email ?? ""}
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Temporary password
                        <input
                          name="password"
                          type="password"
                          minLength={10}
                          required
                        />
                      </label>
                      <label>
                        Role
                        <select
                          name="role"
                          value={newUserRole}
                          disabled={Boolean(pendingAccountMember)}
                          onChange={(event) =>
                            setNewUserRole(event.target.value as User["role"])
                          }
                        >
                          <option value="officer">Officer</option>
                          <option value="nco">
                            NCO · attendance & member details
                          </option>
                          <option value="squad_leader">
                            Squad Leader · full view & NCO controls
                          </option>
                          <option value="viewer">
                            Viewer · full read-only access
                          </option>
                          <option value="member">
                            Member · resources only
                          </option>
                          <option value="admin">Administrator</option>
                        </select>
                        {pendingAccountMember && (
                          <input type="hidden" name="role" value="member" />
                        )}
                      </label>
                    </div>
                    <label>
                      Temporary access
                      <select
                        name="temporaryAccessRole"
                        value={newTemporaryAccessRole}
                        onChange={(event) =>
                          setNewTemporaryAccessRole(event.target.value)
                        }
                      >
                        <option value="">None</option>
                        <option value="temporary_admin">
                          Temporary Admin · operational access
                        </option>
                      </select>
                      <small>
                        Optional additional access. The normal role above is
                        retained.
                      </small>
                    </label>
                    {newTemporaryAccessRole === "temporary_admin" && (
                      <label>
                        Access expires on
                        <input
                          name="accessExpiresOn"
                          type="date"
                          required
                          min={new Intl.DateTimeFormat("en-CA", {
                            timeZone: "Asia/Kuching",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(new Date())}
                        />
                        <small>
                          Access ends at midnight Malaysia time on this date.
                        </small>
                      </label>
                    )}
                    {["nco", "squad_leader", "member"].includes(
                      newUserRole,
                    ) && (
                      <label>
                        Assigned squad
                        <select
                          name="squad"
                          defaultValue={pendingAccountMember?.squad ?? "Alpha"}
                        >
                          <option>Alpha</option>
                          <option>Bravo</option>
                          <option>Charlie</option>
                          <option>Delta</option>
                        </select>
                      </label>
                    )}
                    {newUserRole === "member" && (
                      <label>
                        Member section
                        <select
                          name="memberSection"
                          defaultValue={
                            pendingAccountMember?.section ?? "senior"
                          }
                        >
                          <option value="senior">Senior</option>
                          <option value="junior">Junior</option>
                        </select>
                      </label>
                    )}
                    <button className="primary" disabled={busy}>
                      {busy
                        ? "Creating…"
                        : pendingAccountMember
                          ? "Create member login"
                          : "Create account"}
                    </button>
                  </form>
                  <CustomRoleManager users={users} />
                </section>
              )}
              {notice && (
                <p className="form-success account-notice" role="status">
                  {notice}
                </p>
              )}
              {error && <p className="form-error">{error}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  )}</NotificationCentre>;
}
