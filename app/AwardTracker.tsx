"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AwardSubmissions from "./AwardSubmissions";
import ExportCentre from "./ExportCentre";

type Member = {
  id: number;
  name: string;
  rank: string;
  squad: string;
  joined_at: string;
  service_years: number;
  service_award_count: number;
  band_member: number;
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
};

type Status =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "verified"
  | "awarded";
type AttendanceStatus = "unmarked" | "present" | "absent" | "excused";
type AttendanceSession = {
  id: number;
  meeting_date: string;
  title: string;
  created_at: string;
};
type AttendanceRecord = {
  session_id: number;
  member_id: number;
  status: AttendanceStatus;
};
type SubscriptionRecord = {
  member_id: number;
  year: number;
  paid: number;
};
type BandSubscriptionRecord = {
  member_id: number;
  year: number;
  status: "unpaid" | "paid" | "exempt";
};
type SubmissionNotification = {
  member_id: number;
  member_name: string;
  pending_count: number;
  latest_submitted_at: string;
};
type TrackerData = {
  members: Member[];
  awards: Award[];
  progress: Progress[];
  attendanceSessions: AttendanceSession[];
  attendance: AttendanceRecord[];
  subscriptions: SubscriptionRecord[];
  bandSubscriptions: BandSubscriptionRecord[];
  submissionNotifications: SubmissionNotification[];
  syllabus: string;
  section: "senior" | "junior";
};

const statusOrder: Status[] = [
  "not_started",
  "in_progress",
  "submitted",
  "verified",
  "awarded",
];
const statusLabel: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
  awarded: "Awarded",
};
const attendanceOrder: AttendanceStatus[] = [
  "unmarked",
  "present",
  "absent",
  "excused",
];
const attendanceLabel: Record<AttendanceStatus, string> = {
  unmarked: "Unmarked",
  present: "Present",
  absent: "Absent",
  excused: "Excused",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function joinedYear(value: string) {
  return /^(\d{4})/.exec(value)?.[1] ?? value;
}

function serviceYearsFromJoined(value: string) {
  const match = /^(\d{4})/.exec(value);
  if (!match) return 0;
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Kuching",
      year: "numeric",
    }).format(new Date()),
  );
  return Math.max(0, currentYear - Number(match[1]));
}

function malaysiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

type AwardTrackerProps = {
  user?: {
    name: string;
    email: string;
    role:
      | "admin"
      | "officer"
      | "nco"
      | "squad_leader"
      | "viewer"
      | "member";
    squad: string;
    temporary_access_role: string;
    access_expires_at: string | null;
    member_section?: string;
    custom_permissions?: string[];
  };
  onLogout?: () => void;
  onManageAccount?: () => void;
  onOpenResources?: () => void;
  onOpenStock?: () => void;
  onOpenUniformRequests?: () => void;
  onOpenAnnouncements?: () => void;
  announcementSummary?: {
    unreadCount: number;
    latest: { title: string; body: string; priority: string } | null;
  };
  onOpenAdminCentre?: () => void;
  onOpenSubmissions?: (section: "senior" | "junior") => void;
};

export default function AwardTracker({
  user,
  onLogout,
  onManageAccount,
  onOpenResources,
  onOpenStock,
  onOpenUniformRequests,
  onOpenAnnouncements,
  announcementSummary,
  onOpenAdminCentre,
  onOpenSubmissions,
}: AwardTrackerProps) {
  const hasTemporaryAdminAccess = Boolean(
    user?.role !== "viewer" &&
      user?.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const isNco = user?.role === "nco" && !hasTemporaryAdminAccess;
  const isSquadLeader =
    user?.role === "squad_leader" && !hasTemporaryAdminAccess;
  const isViewer = user?.role === "viewer";
  const hasPermission = (permission: string) =>
    user?.custom_permissions?.includes(permission) ?? false;
  const baseOperationalAccess =
    ["admin", "officer"].includes(user?.role ?? "") ||
    hasTemporaryAdminAccess;
  const baseNcoAccess =
    ["nco", "squad_leader"].includes(user?.role ?? "") &&
    !hasTemporaryAdminAccess;
  const canManageAwards =
    baseOperationalAccess || hasPermission("awards.manage");
  const canAddMembers =
    baseOperationalAccess || baseNcoAccess || hasPermission("members.create");
  const canEditMembers =
    baseOperationalAccess || baseNcoAccess || hasPermission("members.edit");
  const canManageAttendance =
    baseOperationalAccess || baseNcoAccess || hasPermission("attendance.manage");
  const canManageSubscriptions =
    baseOperationalAccess || hasPermission("subscriptions.company.manage");
  const canManageBandSubscriptions =
    baseOperationalAccess || hasPermission("subscriptions.band.manage");
  const roleCanViewSubmissions =
    !isNco || hasPermission("submissions.view");
  const hasOperationalAdminAccess =
    ["admin", "officer"].includes(user?.role ?? "") ||
    hasTemporaryAdminAccess;
  const canReviewSubmissions = hasOperationalAdminAccess;
  const canSubmitPersonalAwards = isNco || isSquadLeader;
  const canUseExportCentre =
    hasOperationalAdminAccess || isViewer || hasPermission("exports.full");
  const canOverrideMemberDetails = hasOperationalAdminAccess;
  const [section, setSection] = useState<"senior" | "junior">("senior");
  const canViewSubmissions =
    section === "senior" && roleCanViewSubmissions;
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Compulsory");
  const [level, setLevel] = useState<"basic" | "advanced">("basic");
  const [view, setView] = useState<
    "dashboard" | "matrix" | "members" | "attendance" | "subscriptions"
  >(isNco ? "attendance" : "dashboard");
  const currentSubscriptionYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Kuching",
      year: "numeric",
    }).format(new Date()),
  );
  const [subscriptionYear, setSubscriptionYear] = useState(
    currentSubscriptionYear,
  );
  const [subscriptionType, setSubscriptionType] = useState<"company" | "band">(
    "company",
  );
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<number | null>(null);
  const [overrideMemberDetails, setOverrideMemberDetails] = useState(false);
  const [joinedAtDraft, setJoinedAtDraft] = useState(
    String(currentSubscriptionYear),
  );
  const [submissionMember, setSubmissionMember] = useState<Member | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [showExportCentre, setShowExportCentre] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [saving, setSaving] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/tracker?section=${section}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as TrackerData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to load the tracker");
      setData(result);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load the tracker",
      );
    }
  }

  useEffect(() => {
    fetch(`/api/tracker?section=${section}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as TrackerData & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load the tracker");
        setData(result);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Unable to load the tracker",
        );
      });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [section]);

  function switchSection(next: "senior" | "junior") {
    setData(null);
    setSection(next);
    setCategory(next === "junior" ? "Junior Awards" : "Compulsory");
    setLevel("basic");
    setQuery("");
    setActiveSessionId(null);
    setView("dashboard");
  }

  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>();
    data?.progress.forEach((item) =>
      map.set(`${item.member_id}:${item.award_code}:${item.level}`, item),
    );
    return map;
  }, [data]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    data?.attendance.forEach((item) =>
      map.set(`${item.session_id}:${item.member_id}`, item),
    );
    return map;
  }, [data]);

  const subscriptionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    data?.subscriptions.forEach((item) =>
      map.set(`${item.member_id}:${item.year}`, Boolean(item.paid)),
    );
    return map;
  }, [data]);
  const bandSubscriptionMap = useMemo(() => {
    const map = new Map<string, BandSubscriptionRecord["status"]>();
    data?.bandSubscriptions.forEach((item) =>
      map.set(`${item.member_id}:${item.year}`, item.status),
    );
    return map;
  }, [data]);

  const orderedAttendanceSessions = useMemo(
    () =>
      [...(data?.attendanceSessions ?? [])].sort(
        (a, b) =>
          a.meeting_date.localeCompare(b.meeting_date) || a.id - b.id,
      ),
    [data?.attendanceSessions],
  );
  const closestAttendanceSession = useMemo(() => {
    const today = malaysiaDateKey();
    const todayTime = Date.parse(`${today}T00:00:00Z`);
    return orderedAttendanceSessions.reduce<AttendanceSession | null>(
      (closest, session) => {
        if (!closest) return session;
        const sessionDistance = Math.abs(
          Date.parse(`${session.meeting_date}T00:00:00Z`) - todayTime,
        );
        const closestDistance = Math.abs(
          Date.parse(`${closest.meeting_date}T00:00:00Z`) - todayTime,
        );
        if (sessionDistance < closestDistance) return session;
        if (
          sessionDistance === closestDistance &&
          session.meeting_date >= today &&
          closest.meeting_date < today
        )
          return session;
        return closest;
      },
      null,
    );
  }, [orderedAttendanceSessions]);

  const activeSession =
    orderedAttendanceSessions.find(
      (session) => session.id === activeSessionId,
    ) ??
    closestAttendanceSession ??
    null;

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.members ?? []).filter(
      (member) =>
        !term ||
        `${member.name} ${member.rank} ${member.squad}`
          .toLowerCase()
          .includes(term),
    );
  }, [data, query]);

  const attendanceMembers = useMemo(
    () =>
      isNco || isSquadLeader
        ? filteredMembers.filter((member) => member.squad === user?.squad)
        : filteredMembers,
    [filteredMembers, isNco, isSquadLeader, user?.squad],
  );

  const viewingMember =
    data?.members.find((member) => member.id === viewingMemberId) ?? null;
  const viewingMemberIndex = viewingMember
    ? filteredMembers.findIndex((member) => member.id === viewingMember.id)
    : -1;

  const visibleAwards = useMemo(
    () =>
      (data?.awards ?? []).filter(
        (award) =>
          award.category === category &&
          (category !== "Service" || award.code === "one_year_service") &&
          (level === "basic"
            ? award.basic_available
            : award.advanced_available),
      ),
    [data, category, level],
  );

  function memberStats(member: Member) {
    const rows = (data?.progress ?? []).filter(
      (item) =>
        item.member_id === member.id &&
        ![
          "one_year_service",
          "three_year_service",
          "long_year_service",
        ].includes(item.award_code),
    );
    const awarded =
      rows.filter((item) => item.status === "awarded").length +
      member.service_award_count;
    const active = rows.filter((item) =>
      ["in_progress", "submitted", "verified"].includes(item.status),
    ).length;
    return { awarded, active };
  }

  function memberAttendance(member: Member) {
    const records = (data?.attendance ?? []).filter(
      (item) => item.member_id === member.id,
    );
    const present = records.filter((item) => item.status === "present").length;
    const absent = records.filter((item) => item.status === "absent").length;
    const excused = records.filter((item) => item.status === "excused").length;
    const unmarked =
      records.filter((item) => item.status === "unmarked").length +
      Math.max(0, (data?.attendanceSessions.length ?? 0) - records.length);
    const total = data?.attendanceSessions.length ?? 0;
    return {
      present,
      absent,
      excused,
      unmarked,
      total,
      percentage: total ? Math.round((present / total) * 100) : 0,
    };
  }

  function presidentReadiness(member: Member) {
    const isAwarded = (code: string, awardLevel: string) =>
      progressMap.get(`${member.id}:${code}:${awardLevel}`)?.status ===
      "awarded";
    if (section === "junior") {
      const checks = [
        "white",
        "green",
        "purple",
        "blue",
        "red",
        "silver",
        "gold",
      ].map((colour) => isAwarded(`junior_${colour}`, "basic"));
      const complete = checks.filter(Boolean).length;
      return {
        complete,
        total: checks.length,
        percent: Math.round((complete / checks.length) * 100),
      };
    }
    const checks = [
      isAwarded("nco_proficiency", "advanced"),
      isAwarded("christian_education", "advanced"),
      isAwarded("drill", "advanced"),
      isAwarded("recruitment", "basic"),
      member.service_award_count >= 3,
    ];
    const groupAwards = (data?.awards ?? []).filter((award) =>
      /^[A-D] ·/.test(award.category),
    );
    const best = groupAwards
      .map((award) => ({
        category: award.category[0],
        level: isAwarded(award.code, "advanced")
          ? "advanced"
          : isAwarded(award.code, "basic")
            ? "basic"
            : null,
      }))
      .filter((item) => item.level);
    const categories = new Set(best.map((item) => item.category));
    checks.push(
      best.length >= 6,
      categories.size === 4,
      best.filter((item) => item.level === "basic").length >= 2,
      best.filter((item) => item.level === "advanced").length >= 4,
    );
    const complete = checks.filter(Boolean).length;
    return {
      complete,
      total: checks.length,
      percent: Math.round((complete / checks.length) * 100),
    };
  }

  async function updateAward(
    memberId: number,
    awardCode: string,
    next: Status,
  ) {
    const key = `${memberId}:${awardCode}:${level}`;
    setSaving(key);
    setActionError("");
    setData((existing) =>
      existing
        ? {
            ...existing,
            progress: [
              ...existing.progress.filter(
                (item) =>
                  `${item.member_id}:${item.award_code}:${item.level}` !== key,
              ),
              {
                member_id: memberId,
                award_code: awardCode,
                level,
                status: next,
              },
            ],
          }
        : existing,
    );
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_award",
        section,
        memberId,
        awardCode,
        level,
        status: next,
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      await load();
      setActionError(result.error ?? "Unable to update the award");
    }
    setSaving("");
  }

  async function updateServiceAwardCount(member: Member, count: number) {
    const nextCount = Math.max(0, Math.min(20, count));
    const key = `service-awards-${member.id}`;
    setSaving(key);
    setNotice("");
    setActionError("");
    setData((existing) =>
      existing
        ? {
            ...existing,
            members: existing.members.map((item) =>
              item.id === member.id
                ? { ...item, service_award_count: nextCount }
                : item,
            ),
          }
        : existing,
    );
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_service_award_count",
        section,
        memberId: member.id,
        count: nextCount,
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      await load();
      setActionError(result.error ?? "Unable to update the service award count");
      setSaving("");
      return;
    }
    setNotice("Service award count updated successfully.");
    setSaving("");
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const wasEditing = Boolean(editingMember);
    setNotice("");
    setActionError("");
    setSaving(editingMember ? `member-${editingMember.id}` : "new-member");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingMember ? "update_member" : "create_member",
        section,
        memberId: editingMember?.id,
        name: form.get("name"),
        rank: form.get("rank"),
        squad: form.get("squad"),
        joinedAt: form.get("joinedAt"),
        school: form.get("school"),
        contactNumber: form.get("contactNumber"),
        emergencyContactNumber: form.get("emergencyContactNumber"),
        email: form.get("email"),
        parentsName: form.get("parentsName"),
        bandMember: form.get("bandMember") === "on",
        overrideRequiredDetails:
          canOverrideMemberDetails && overrideMemberDetails,
      }),
    });
    if (response.ok) {
      setShowAdd(false);
      setEditingMember(null);
      await load();
      setNotice(
        wasEditing
          ? "Member details updated successfully."
          : "Member created successfully.",
      );
      setSaving("");
    } else {
      const result = (await response.json()) as { error?: string };
      setActionError(result.error ?? "Unable to save member details");
      setSaving("");
    }
  }

  function openAddMember() {
    setEditingMember(null);
    setOverrideMemberDetails(false);
    setJoinedAtDraft(String(currentSubscriptionYear));
    setShowAdd(true);
  }

  function openEditMember(member: Member) {
    setEditingMember(member);
    setOverrideMemberDetails(false);
    setJoinedAtDraft(joinedYear(member.joined_at));
    setShowAdd(true);
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} and their award records?`))
      return;
    setSaving(`delete-member-${member.id}`);
    setActionError("");
    setNotice("");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_member",
        section,
        memberId: member.id,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(result.error ?? "Unable to remove member");
      setSaving("");
      return;
    }
    await load();
    setNotice(`${member.name} was removed successfully.`);
    setSaving("");
  }

  async function createAttendanceSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice("");
    setActionError("");
    setSaving("new-session");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_attendance_session",
        section,
        meetingDate: form.get("meetingDate"),
        title: form.get("title"),
      }),
    });
    if (response.ok) {
      setShowSession(false);
      await load();
      setActiveSessionId(null);
      setNotice("Attendance meeting created successfully.");
      setSaving("");
    } else {
      const result = (await response.json()) as { error?: string };
      setActionError(result.error ?? "Unable to create attendance meeting");
      setSaving("");
    }
  }

  async function updateAttendance(
    sessionId: number,
    memberId: number,
    status: AttendanceStatus,
  ) {
    const key = `attendance-${sessionId}-${memberId}`;
    setSaving(key);
    setActionError("");
    setData((existing) =>
      existing
        ? {
            ...existing,
            attendance: [
              ...existing.attendance.filter(
                (item) =>
                  !(
                    item.session_id === sessionId && item.member_id === memberId
                  ),
              ),
              { session_id: sessionId, member_id: memberId, status },
            ],
          }
        : existing,
    );
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_attendance",
        section,
        sessionId,
        memberId,
        status,
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      await load();
      setActionError(result.error ?? "Unable to update attendance");
    }
    setSaving("");
  }

  async function updateSubscription(memberId: number, paid: boolean) {
    const key = `subscription-${subscriptionYear}-${memberId}`;
    setSaving(key);
    setNotice("");
    setActionError("");
    setData((existing) =>
      existing
        ? {
            ...existing,
            subscriptions: [
              ...existing.subscriptions.filter(
                (item) =>
                  !(item.member_id === memberId && item.year === subscriptionYear),
              ),
              { member_id: memberId, year: subscriptionYear, paid: paid ? 1 : 0 },
            ],
          }
        : existing,
    );
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_subscription",
        section,
        memberId,
        year: subscriptionYear,
        paid,
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      await load();
      setActionError(result.error ?? "Unable to update subscription");
      setSaving("");
      return;
    }
    setNotice("Yearly subscription updated successfully.");
    setSaving("");
  }

  async function updateBandSubscription(
    memberId: number,
    status: BandSubscriptionRecord["status"],
  ) {
    const key = `band-subscription-${subscriptionYear}-${memberId}`;
    setSaving(key);
    setNotice("");
    setActionError("");
    setData((existing) =>
      existing
        ? {
            ...existing,
            bandSubscriptions: [
              ...existing.bandSubscriptions.filter(
                (item) =>
                  !(item.member_id === memberId && item.year === subscriptionYear),
              ),
              { member_id: memberId, year: subscriptionYear, status },
            ],
          }
        : existing,
    );
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_band_subscription",
        section,
        memberId,
        year: subscriptionYear,
        status,
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      await load();
      setActionError(result.error ?? "Unable to update band subscription");
      setSaving("");
      return;
    }
    setNotice("Band subscription updated successfully.");
    setSaving("");
  }

  async function deleteAttendanceSession(session: AttendanceSession) {
    if (
      !window.confirm(
        `Delete attendance for ${session.title} on ${session.meeting_date}?`,
      )
    )
      return;
    setSaving(`delete-session-${session.id}`);
    setActionError("");
    setNotice("");
    const response = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_attendance_session",
        section,
        sessionId: session.id,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(result.error ?? "Unable to delete attendance meeting");
      setSaving("");
      return;
    }
    setActiveSessionId(null);
    await load();
    setNotice("Attendance meeting deleted successfully.");
    setSaving("");
  }

  async function exportCsv() {
    if (!data || saving === "export") return;
    setSaving("export");
    setNotice("");
    try {
      const datasets = await Promise.all(
        (["senior", "junior"] as const).map(async (exportSection) => {
          const response = await fetch(
            `/api/tracker?section=${exportSection}`,
            { cache: "no-store" },
          );
          const result = (await response.json()) as TrackerData & {
            error?: string;
          };
          if (!response.ok)
            throw new Error(result.error ?? "Unable to prepare the export");
          return result;
        }),
      );

      const awardColumns = datasets.flatMap((dataset) =>
        dataset.awards
          .filter((award) => award.code !== "one_year_service")
          .flatMap((award) =>
            (["basic", "advanced"] as const)
              .filter((awardLevel) =>
                awardLevel === "basic"
                  ? Boolean(award.basic_available)
                  : Boolean(award.advanced_available),
              )
              .map((awardLevel) => ({
                key: `${dataset.section}:${award.code}:${awardLevel}`,
                section: dataset.section,
                code: award.code,
                level: awardLevel,
                label: `${dataset.section === "senior" ? "Senior" : "Junior"} Award · ${award.category} · ${award.name} · ${awardLevel === "basic" ? "Basic" : "Advanced"}`,
              })),
          ),
      );
      const attendanceColumns = datasets.flatMap((dataset) =>
        dataset.attendanceSessions.map((session) => ({
          key: `${dataset.section}:${session.id}`,
          section: dataset.section,
          session,
          label: `${dataset.section === "senior" ? "Senior" : "Junior"} Attendance · ${session.meeting_date} · ${session.title}`,
        })),
      );
      const subscriptionYears = [
        ...new Set([
          currentSubscriptionYear,
          ...datasets.flatMap((dataset) =>
            dataset.subscriptions.map((item) => item.year),
          ),
        ]),
      ].sort((a, b) => b - a);
      const headers = [
        "Member ID",
        "Section",
        "Syllabus",
        "Full Name",
        "Rank",
        "Squad",
        "Joined Year",
        "Service Years",
        "One-Year Service Awards",
        "School",
        "Contact Number",
        "Emergency Contact Number",
        "Email",
        "Parents Name",
        "Demo Record",
        "Awards Earned",
        "Awards In Progress or Review",
        "Pathway Checks Completed",
        "Pathway Checks Total",
        "Pathway Readiness Percentage",
        "Attendance Meetings",
        "Attendance Present",
        "Attendance Absent",
        "Attendance Excused",
        "Attendance Unmarked",
        "Attendance Percentage",
        "Pending Award Submissions",
        "Latest Pending Submission",
        ...subscriptionYears.map((year) => `Subscription ${year}`),
        ...awardColumns.map((column) => column.label),
        ...attendanceColumns.map((column) => column.label),
      ];
      const lines: Array<Array<string | number>> = [headers];

      datasets.forEach((dataset) => {
        const datasetProgress = new Map(
          dataset.progress.map((item) => [
            `${item.member_id}:${item.award_code}:${item.level}`,
            item,
          ]),
        );
        const datasetAttendance = new Map(
          dataset.attendance.map((item) => [
            `${item.session_id}:${item.member_id}`,
            item.status,
          ]),
        );
        const datasetSubscriptions = new Map(
          dataset.subscriptions.map((item) => [
            `${item.member_id}:${item.year}`,
            Boolean(item.paid),
          ]),
        );
        const pendingByMember = new Map(
          dataset.submissionNotifications.map((item) => [
            item.member_id,
            item,
          ]),
        );

        dataset.members.forEach((member) => {
          const isAwarded = (code: string, awardLevel: string) =>
            datasetProgress.get(`${member.id}:${code}:${awardLevel}`)
              ?.status === "awarded";
          const memberProgress = dataset.progress.filter(
            (item) => item.member_id === member.id,
          );
          const awarded =
            memberProgress.filter((item) => item.status === "awarded").length +
            member.service_award_count;
          const active = memberProgress.filter((item) =>
            ["in_progress", "submitted", "verified"].includes(item.status),
          ).length;
          let pathwayChecks: boolean[];
          if (dataset.section === "junior") {
            pathwayChecks = [
              "white",
              "green",
              "purple",
              "blue",
              "red",
              "silver",
              "gold",
            ].map((colour) => isAwarded(`junior_${colour}`, "basic"));
          } else {
            pathwayChecks = [
              isAwarded("nco_proficiency", "advanced"),
              isAwarded("christian_education", "advanced"),
              isAwarded("drill", "advanced"),
              isAwarded("recruitment", "basic"),
              member.service_award_count >= 3,
            ];
            const best = dataset.awards
              .filter((award) => /^[A-D] ·/.test(award.category))
              .map((award) => ({
                category: award.category[0],
                level: isAwarded(award.code, "advanced")
                  ? "advanced"
                  : isAwarded(award.code, "basic")
                    ? "basic"
                    : null,
              }))
              .filter((item) => item.level);
            pathwayChecks.push(
              best.length >= 6,
              new Set(best.map((item) => item.category)).size === 4,
              best.filter((item) => item.level === "basic").length >= 2,
              best.filter((item) => item.level === "advanced").length >= 4,
            );
          }
          const pathwayComplete = pathwayChecks.filter(Boolean).length;
          const attendanceStatuses = dataset.attendanceSessions.map(
            (session) =>
              datasetAttendance.get(`${session.id}:${member.id}`) ??
              "unmarked",
          );
          const present = attendanceStatuses.filter(
            (status) => status === "present",
          ).length;
          const absent = attendanceStatuses.filter(
            (status) => status === "absent",
          ).length;
          const excused = attendanceStatuses.filter(
            (status) => status === "excused",
          ).length;
          const unmarked = attendanceStatuses.filter(
            (status) => status === "unmarked",
          ).length;
          const pending = pendingByMember.get(member.id);

          lines.push([
            member.id,
            dataset.section === "senior" ? "Senior" : "Junior",
            dataset.syllabus,
            member.name,
            member.rank,
            member.squad,
            joinedYear(member.joined_at),
            member.service_years,
            member.service_award_count,
            member.school,
            member.contact_number,
            member.emergency_contact_number,
            member.email,
            member.parents_name,
            member.is_demo ? "Yes" : "No",
            awarded,
            active,
            pathwayComplete,
            pathwayChecks.length,
            Math.round((pathwayComplete / pathwayChecks.length) * 100),
            attendanceStatuses.length,
            present,
            absent,
            excused,
            unmarked,
            attendanceStatuses.length
              ? Math.round((present / attendanceStatuses.length) * 100)
              : 0,
            pending?.pending_count ?? 0,
            pending?.latest_submitted_at ?? "",
            ...subscriptionYears.map((year) =>
              datasetSubscriptions.get(`${member.id}:${year}`)
                ? "Paid"
                : "Unpaid",
            ),
            ...awardColumns.map((column) =>
              column.section === dataset.section
                ? statusLabel[
                    datasetProgress.get(
                      `${member.id}:${column.code}:${column.level}`,
                    )?.status ?? "not_started"
                  ]
                : "",
            ),
            ...attendanceColumns.map((column) =>
              column.section === dataset.section
                ? attendanceLabel[
                    datasetAttendance.get(
                      `${column.session.id}:${member.id}`,
                    ) ?? "unmarked"
                  ]
                : "",
            ),
          ]);
        });
      });

      const csv = lines
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
      );
      link.download = `11kchbb-all-member-records-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setNotice("All Senior and Junior member records exported successfully.");
    } catch (cause) {
      window.alert(
        cause instanceof Error ? cause.message : "Unable to export records",
      );
    } finally {
      setSaving("");
    }
  }

  if (error)
    return (
      <main className="loading-state">
        <div
          className="brand-mark app-photo"
          role="img"
          aria-label="11th Kuching Company"
        />
        <h1>11KCHBB App</h1>
        <p>{error}</p>
        <button onClick={load}>Try again</button>
      </main>
    );
  if (!data)
    return (
      <main className="loading-state">
        <div
          className="brand-mark app-photo pulse"
          role="img"
          aria-label="11th Kuching Company"
        />
        <p>Preparing your award records…</p>
      </main>
    );

  const awardedTotal =
    data.progress.filter(
      (item) =>
        item.status === "awarded" &&
        ![
          "one_year_service",
          "three_year_service",
          "long_year_service",
        ].includes(item.award_code),
    ).length +
    data.members.reduce(
      (total, member) => total + member.service_award_count,
      0,
    );
  const pendingTotal = data.progress.filter((item) =>
    ["submitted", "verified"].includes(item.status),
  ).length;
  const submissionPendingTotal = data.submissionNotifications.reduce(
    (total, item) => total + item.pending_count,
    0,
  );
  const submissionByMember = new Map(
    data.submissionNotifications.map((item) => [item.member_id, item]),
  );
  const categories = [...new Set(data.awards.map((award) => award.category))];

  return (
    <div className="app-shell">
      {notice && (
        <div className="action-toast" role="status">
          <span>✓</span>
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss confirmation"
          >
            ×
          </button>
        </div>
      )}
      {actionError && (
        <div className="action-toast error" role="alert">
          <span>!</span>
          {actionError}
          <button
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {announcementSummary && announcementSummary.unreadCount > 0 && announcementSummary.latest && (
        <button className={`announcement-alert ${announcementSummary.latest.priority}`} onClick={onOpenAnnouncements}>
          <span>!</span>
          <div>
            <strong>{announcementSummary.latest.title}</strong>
            <small>{announcementSummary.latest.body}</small>
          </div>
          <b>{announcementSummary.unreadCount} new</b>
        </button>
      )}
      <aside className="sidebar">
        <div className="brand">
          <div
            className="brand-mark app-photo"
            role="img"
            aria-label="11th Kuching Company"
          />
          <div>
            <strong>11KCHBB App</strong>
            <span>
              {isNco
                ? "NCO attendance"
                : isSquadLeader
                  ? `${user?.squad} Squad`
                  : `${section === "junior" ? "Junior" : "Senior"} Section tracker`}
            </span>
          </div>
        </div>
        <nav
          className={
            isNco ? "nco-nav" : isSquadLeader ? "squad-leader-nav" : ""
          }
          aria-label="Primary navigation"
        >
          {!isNco && (
            <button
              className={`nav-primary ${view === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setView("dashboard");
                setShowMobileMenu(false);
              }}
            >
              <span>⌂</span> Overview
            </button>
          )}
          <button
            className={`nav-primary ${view === "matrix" ? "active" : ""}`}
            onClick={() => {
              setView("matrix");
              setShowMobileMenu(false);
            }}
          >
            <span>▦</span> Award matrix
          </button>
          <button
            className={`nav-primary ${view === "members" ? "active" : ""}`}
            onClick={() => {
              setView("members");
              setShowMobileMenu(false);
            }}
          >
            <span>♙</span> Members
            {canViewSubmissions && submissionPendingTotal > 0 && (
              <b
                className="nav-badge"
                aria-label={`${submissionPendingTotal} pending award submissions`}
              >
                {submissionPendingTotal}
              </b>
            )}
          </button>
          <button
            className={`nav-primary ${view === "attendance" ? "active" : ""}`}
            onClick={() => {
              setView("attendance");
              setShowMobileMenu(false);
            }}
          >
            <span>✓</span> Attendance
          </button>
          <button
            className={`nav-secondary ${view === "subscriptions" ? "active" : ""}`}
            onClick={() => setView("subscriptions")}
          >
            <span>◇</span> Subscription
          </button>
          {section === "senior" &&
            (canReviewSubmissions || canSubmitPersonalAwards || isViewer) && (
            <button
              className="nav-secondary"
              onClick={() => onOpenSubmissions?.(section)}
            >
              <span>◆</span>{" "}
              {canReviewSubmissions || isViewer
                ? "Submission portal"
                : "My submissions"}
              {canReviewSubmissions && submissionPendingTotal > 0 && (
                <b
                  className="nav-badge"
                  aria-label={`${submissionPendingTotal} submissions awaiting officer review`}
                >
                  {submissionPendingTotal}
                </b>
              )}
            </button>
          )}
          <button className="nav-secondary" onClick={onOpenResources}>
            <span>↗</span> Resources
          </button>
          {onOpenStock && (
            <button className="nav-secondary" onClick={onOpenStock}>
              <span>▣</span> Stock Centre
            </button>
          )}
          {onOpenUniformRequests && (
            <button className="nav-secondary" onClick={onOpenUniformRequests}>
              <span>▤</span> Uniform requests
            </button>
          )}
          {onOpenAnnouncements && (
            <button className="nav-secondary" onClick={onOpenAnnouncements}>
              <span>◉</span> Announcements
              {announcementSummary && announcementSummary.unreadCount > 0 && (
                <b className="nav-badge">{announcementSummary.unreadCount}</b>
              )}
            </button>
          )}
          {onOpenAdminCentre && (
            <button className="nav-secondary" onClick={onOpenAdminCentre}>
              <span>⚙</span> Admin Centre
            </button>
          )}
          <button
            className={`mobile-more ${showMobileMenu || view === "subscriptions" ? "active" : ""}`}
            onClick={() => setShowMobileMenu((current) => !current)}
            aria-expanded={showMobileMenu}
            aria-controls="mobile-more-menu"
          >
            <span>•••</span> More
          </button>
        </nav>
        <div className="sidebar-note">
          <span>SYLLABUS</span>
          <strong>August 2024</strong>
          <small>
            BB Malaysia {section === "junior" ? "Junior" : "Senior"} Section
          </small>
        </div>
        <div className="open-source">
          <span>◈</span>
          <div>
            <strong>Open source</strong>
            <small>MIT licensed</small>
          </div>
        </div>
      </aside>

      {showMobileMenu && (
        <div
          className="mobile-nav-menu-backdrop"
          role="presentation"
          onMouseDown={() => setShowMobileMenu(false)}
        >
          <section
            id="mobile-more-menu"
            className="mobile-nav-menu"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-nav-menu-heading">
              <div>
                <p className="eyebrow">MORE</p>
                <strong>Company tools</strong>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close more menu"
              >
                ×
              </button>
            </div>
            <button
              className={view === "subscriptions" ? "active" : ""}
              onClick={() => {
                setView("subscriptions");
                setShowMobileMenu(false);
              }}
            >
              <span>◇</span>
              <div>
                <strong>Subscription</strong>
                <small>View yearly payment status</small>
              </div>
              <b>›</b>
            </button>
            {section === "senior" &&
              (canReviewSubmissions || canSubmitPersonalAwards || isViewer) && (
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenSubmissions?.(section);
                }}
              >
                <span>◆</span>
                <div>
                  <strong>
                    {canReviewSubmissions || isViewer
                      ? "Submission portal"
                      : "My submissions"}
                  </strong>
                  <small>
                    {canReviewSubmissions || isViewer
                      ? isViewer
                        ? "View award applications"
                        : "Review award applications"
                      : "Apply for your own awards"}
                  </small>
                </div>
                {canReviewSubmissions && submissionPendingTotal > 0 ? (
                  <b className="menu-count">{submissionPendingTotal}</b>
                ) : (
                  <b>›</b>
                )}
              </button>
            )}
            <button
              onClick={() => {
                setShowMobileMenu(false);
                onOpenResources?.();
              }}
            >
              <span>↗</span>
              <div>
                <strong>Resources</strong>
                <small>Open company materials</small>
              </div>
              <b>›</b>
            </button>
            {onOpenStock && (
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenStock();
                }}
              >
                <span>▣</span>
                <div>
                  <strong>Stock Centre</strong>
                  <small>Uniforms, awards and issue history</small>
                </div>
                <b>›</b>
              </button>
            )}
            {onOpenUniformRequests && (
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenUniformRequests();
                }}
              >
                <span>▤</span>
                <div>
                  <strong>Uniform requests</strong>
                  <small>Request parts or review member requests</small>
                </div>
                <b>›</b>
              </button>
            )}
            {onOpenAnnouncements && (
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenAnnouncements();
                }}
              >
                <span>◉</span>
                <div>
                  <strong>Announcements</strong>
                  <small>Company-wide notices</small>
                </div>
                {announcementSummary && announcementSummary.unreadCount > 0 ? (
                  <b className="menu-count">{announcementSummary.unreadCount}</b>
                ) : (
                  <b>›</b>
                )}
              </button>
            )}
            {onOpenAdminCentre && (
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenAdminCentre();
                }}
              >
                <span>⚙</span>
                <div>
                  <strong>Admin Centre</strong>
                  <small>Roles, access and membership accounts</small>
                </div>
                <b>›</b>
              </button>
            )}
          </section>
        </div>
      )}

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="section-switch" role="group" aria-label="Section">
              <button
                className={section === "senior" ? "active" : ""}
                onClick={() => switchSection("senior")}
              >
                Senior
              </button>
              <button
                className={section === "junior" ? "active" : ""}
                onClick={() => switchSection("junior")}
              >
                Junior
              </button>
            </div>
            <p className="eyebrow">
              {view === "dashboard"
                ? "COMPANY OVERVIEW"
                : view === "matrix"
                  ? "AWARD PROGRESS"
                  : view === "members"
                    ? "MEMBER DIRECTORY"
                    : view === "attendance"
                      ? "PARADE REGISTER"
                      : "YEARLY SUBSCRIPTION"}
            </p>
            <h1>
              {view === "dashboard"
                ? "Shalom"
                : view === "matrix"
                  ? "Award matrix"
                  : view === "members"
                    ? "Members"
                    : view === "attendance"
                      ? "Attendance"
                      : "Subscription"}
            </h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <span>⌕</span>
              <input
                aria-label="Search members"
                placeholder="Search members"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {user && (
              <button
                className="account-chip"
                onClick={onManageAccount}
                title={user.email}
              >
                {initials(user.name)}
                <span>{user.name.split(" ")[0]}</span>
              </button>
            )}
            {onLogout && (
              <button className="sign-out" onClick={onLogout}>
                Sign out
              </button>
            )}
            {view === "attendance" && canManageAttendance ? (
              <button className="primary" onClick={() => setShowSession(true)}>
                ＋ New meeting
              </button>
            ) : view !== "subscriptions" && canAddMembers ? (
              <button className="primary" onClick={openAddMember}>
                ＋ Add member
              </button>
            ) : null}
          </div>
        </header>

        {view === "dashboard" && (
          <>
            <section className="stat-grid" aria-label="Company statistics">
              <article className="stat-card blue">
                <div>
                  <span>ACTIVE MEMBERS</span>
                  <strong>{data.members.length}</strong>
                  <small>
                    Across{" "}
                    {new Set(data.members.map((member) => member.squad)).size}{" "}
                    squads
                  </small>
                </div>
                <div className="stat-icon">♙</div>
              </article>
              <article className="stat-card gold">
                <div>
                  <span>AWARDS EARNED</span>
                  <strong>{awardedTotal}</strong>
                  <small>Recorded completions</small>
                </div>
                <div className="stat-icon">✦</div>
              </article>
              <article className="stat-card green">
                <div>
                  <span>AWAITING REVIEW</span>
                  <strong>{pendingTotal + submissionPendingTotal}</strong>
                  <small>
                    {submissionPendingTotal} member submission
                    {submissionPendingTotal === 1 ? "" : "s"}
                  </small>
                </div>
                <div className="stat-icon">✓</div>
              </article>
              <article className="stat-card navy">
                <div>
                  <span>SYLLABUS AWARDS</span>
                  <strong>{data.awards.length}</strong>
                  <small>Including service & special</small>
                </div>
                <div className="stat-icon">▤</div>
              </article>
            </section>
            <section
              className={`panel submission-alert-panel ${submissionPendingTotal ? "has-pending" : ""}`}
              aria-label="Award submission notifications"
            >
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SUBMISSION NOTIFICATIONS</p>
                  <h2>
                    {submissionPendingTotal
                      ? `${submissionPendingTotal} award application${submissionPendingTotal === 1 ? "" : "s"} awaiting review`
                      : "No new award applications"}
                  </h2>
                </div>
                {submissionPendingTotal > 0 && (
                  <span className="notification-total">New</span>
                )}
              </div>
              {data.submissionNotifications.length ? (
                <div className="notification-list">
                  {data.submissionNotifications.map((notification) => {
                    const member = data.members.find(
                      (item) => item.id === notification.member_id,
                    );
                    return (
                      <button
                        key={notification.member_id}
                        disabled={!member}
                        onClick={() => member && setSubmissionMember(member)}
                      >
                        <div className="avatar">
                          {initials(notification.member_name)}
                        </div>
                        <span>
                          <strong>{notification.member_name}</strong>
                          <small>
                            {notification.pending_count} pending · Latest{" "}
                            {new Date(
                              notification.latest_submitted_at,
                            ).toLocaleDateString("en-MY", {
                              day: "numeric",
                              month: "short",
                            })}
                          </small>
                        </span>
                        <b className="new-marker">New</b>
                        <i>›</i>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="notification-empty">
                  You’re all caught up. New member applications will appear
                  here.
                </p>
              )}
            </section>
            <section className="dashboard-grid">
              <article className="panel member-progress">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">MEMBER PROGRESS</p>
                    <h2>
                      {section === "junior"
                        ? "Junior Gold Award pathway"
                        : "President’s Award pathway"}
                    </h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("members")}
                  >
                    View all →
                  </button>
                </div>
                <div className="progress-list">
                  {filteredMembers.slice(0, 5).map((member) => {
                    const readiness = presidentReadiness(member);
                    return (
                      <div className="progress-row" key={member.id}>
                        <div className="avatar">{initials(member.name)}</div>
                        <div className="member-meta">
                          <strong>{member.name}</strong>
                          <span>{member.rank}</span>
                        </div>
                        <div className="progress-track">
                          <div style={{ width: `${readiness.percent}%` }} />
                        </div>
                        <strong className="percent">
                          {readiness.percent}%
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </article>
              <article className="panel quick-actions">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">QUICK ACTIONS</p>
                    <h2>Keep parade moving</h2>
                  </div>
                </div>
                <button onClick={() => setView("matrix")}>
                  <span className="action-icon">▦</span>
                  <span>
                    <strong>
                      {canManageAwards
                        ? "Update award progress"
                        : "View award progress"}
                    </strong>
                    <small>
                      {canManageAwards
                        ? "Tap through member statuses"
                        : "Review recorded member awards"}
                    </small>
                  </span>
                  <b>›</b>
                </button>
                {canAddMembers && (
                  <button onClick={openAddMember}>
                    <span className="action-icon">＋</span>
                    <span>
                      <strong>Register a member</strong>
                      <small>Add rank, squad and service</small>
                    </span>
                    <b>›</b>
                  </button>
                )}
                <button onClick={() => setView("attendance")}>
                  <span className="action-icon">✓</span>
                  <span>
                    <strong>
                      {canManageAttendance
                        ? "Take attendance"
                        : "View attendance"}
                    </strong>
                    <small>
                      {canManageAttendance
                        ? "Open the latest parade register"
                        : "Review parade attendance records"}
                    </small>
                  </span>
                  <b>›</b>
                </button>
                {canUseExportCentre && (
                  <button onClick={() => setShowExportCentre(true)}>
                    <span className="action-icon">↓</span>
                    <span>
                      <strong>Open Export Centre</strong>
                      <small>Excel workbooks, PDF reports & CSV backups</small>
                    </span>
                    <b>›</b>
                  </button>
                )}
              </article>
            </section>
          </>
        )}

        {view === "matrix" && (
          <section className="panel matrix-panel">
            <div className="matrix-toolbar">
              <div className="category-tabs" role="tablist">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => {
                      setCategory(item);
                      if (item === "Service") setLevel("basic");
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <label className="category-select">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => {
                    const nextCategory = event.target.value;
                    setCategory(nextCategory);
                    if (nextCategory === "Service") setLevel("basic");
                  }}
                  aria-label="Award category"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              {section === "senior" && category !== "Service" && (
                <div className="level-toggle">
                  <button
                    className={level === "basic" ? "active" : ""}
                    onClick={() => setLevel("basic")}
                  >
                    Basic
                  </button>
                  <button
                    className={level === "advanced" ? "active" : ""}
                    onClick={() => setLevel("advanced")}
                  >
                    Advanced
                  </button>
                </div>
              )}
            </div>
            <div className="matrix-help">
              <span>
                {category === "Service"
                  ? canManageAwards
                    ? "Use + or − to record how many One-Year Service Awards each member has"
                    : "Service award counts are shown in read-only mode"
                  : canManageAwards
                    ? "Choose an award status from each dropdown"
                    : "Awards are shown in read-only mode"}
              </span>
              {category !== "Service" && <div>
                {statusOrder.slice(1).map((status) => (
                  <span key={status} className={`legend ${status}`}>
                    {statusLabel[status]}
                  </span>
                ))}
              </div>}
            </div>
            <div className="table-scroll">
              <table
                className={`award-matrix${category === "Service" ? " service-matrix" : ""}`}
              >
                <thead>
                  <tr>
                    <th>Member</th>
                    {visibleAwards.map((award) => (
                      <th key={award.code}>{award.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <th>
                        <div className="table-member">
                          <div className="avatar small">
                            {initials(member.name)}
                          </div>
                          <div>
                            <strong>{member.name}</strong>
                            <span>{member.rank}</span>
                          </div>
                        </div>
                      </th>
                      {visibleAwards.map((award) => {
                        if (award.code === "one_year_service") {
                          const serviceKey = `service-awards-${member.id}`;
                          return (
                            <td key={award.code}>
                              <div
                                className="service-count-control"
                                aria-label={`${member.name}: ${member.service_award_count} One-Year Service Awards`}
                              >
                                <button
                                  type="button"
                                  disabled={
                                    !canManageAwards ||
                                    saving === serviceKey ||
                                    member.service_award_count === 0
                                  }
                                  onClick={() =>
                                    updateServiceAwardCount(
                                      member,
                                      member.service_award_count - 1,
                                    )
                                  }
                                  aria-label={`Remove one service award from ${member.name}`}
                                >
                                  −
                                </button>
                                <strong>{member.service_award_count}</strong>
                                <button
                                  type="button"
                                  disabled={
                                    !canManageAwards ||
                                    saving === serviceKey ||
                                    member.service_award_count === 20
                                  }
                                  onClick={() =>
                                    updateServiceAwardCount(
                                      member,
                                      member.service_award_count + 1,
                                    )
                                  }
                                  aria-label={`Add one service award to ${member.name}`}
                                >
                                  ＋
                                </button>
                              </div>
                            </td>
                          );
                        }
                        const key = `${member.id}:${award.code}:${level}`;
                        const status =
                          progressMap.get(key)?.status ?? "not_started";
                        return (
                          <td key={award.code}>
                            <select
                              disabled={!canManageAwards || saving === key}
                              className={`status-select ${status}`}
                              value={status}
                              onChange={(event) =>
                                updateAward(
                                  member.id,
                                  award.code,
                                  event.target.value as Status,
                                )
                              }
                              aria-label={`${member.name}, ${award.name}: ${statusLabel[status]}`}
                              aria-busy={saving === key}
                            >
                              {statusOrder.map((option) => (
                                <option key={option} value={option}>
                                  {statusLabel[option]}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === "members" && (
          <section className="member-grid">
            {filteredMembers.map((member) => {
              const stats = memberStats(member);
              const readiness = presidentReadiness(member);
              const notification = submissionByMember.get(member.id);
              return (
                <article className="member-card" key={member.id}>
                  <div className="member-card-top">
                    <div className="avatar large">{initials(member.name)}</div>
                    <div className="card-actions">
                      {canViewSubmissions && notification && (
                        <span className="member-new-marker">
                          New · {notification.pending_count}
                        </span>
                      )}
                      {canViewSubmissions && (
                        <button
                          className="edit-member"
                          onClick={() => setSubmissionMember(member)}
                        >
                          Submissions
                        </button>
                      )}
                      <button
                        className="edit-member"
                        aria-label={`View ${member.name}'s profile`}
                        onClick={() => setViewingMemberId(member.id)}
                      >
                        View profile
                      </button>
                      {canEditMembers && (
                        <button
                          className="edit-member"
                          aria-label={`Edit ${member.name}`}
                          onClick={() => openEditMember(member)}
                        >
                          Edit details
                        </button>
                      )}
                      {canManageAwards && (
                        <button
                          className="more"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => deleteMember(member)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <h2>{member.name}</h2>
                  <p>
                    {member.rank} · Joined {joinedYear(member.joined_at)}
                  </p>
                  <div className="member-numbers">
                    <div>
                      <strong>{stats.awarded}</strong>
                      <span>Awards</span>
                    </div>
                    <div>
                      <strong>{stats.active}</strong>
                      <span>Active</span>
                    </div>
                    <div>
                      <strong>{member.service_years}</strong>
                      <span>Years</span>
                    </div>
                  </div>
                  <div className="readiness">
                    <div>
                      <span>
                        {section === "junior"
                          ? "Junior Gold Award"
                          : "President’s Award"}
                      </span>
                      <strong>
                        {readiness.complete}/{readiness.total}
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div style={{ width: `${readiness.percent}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {view === "attendance" && (
          <section className="attendance-layout">
            <aside className="panel session-list">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">MEETINGS</p>
                  <h2>Attendance dates</h2>
                  {(isNco || isSquadLeader) && (
                    <small>
                      {user?.squad
                        ? `${user.squad} Squad only`
                        : "Ask an administrator to assign your squad"}
                    </small>
                  )}
                </div>
              </div>
              {orderedAttendanceSessions.length && activeSession ? (
                <div className="attendance-session-picker">
                  <label>
                    Select meeting
                    <select
                      aria-label="Attendance meeting date"
                      value={String(activeSession.id)}
                      onChange={(event) =>
                        setActiveSessionId(Number(event.target.value))
                      }
                    >
                      {orderedAttendanceSessions.map((session) => {
                        const meetingDate = new Date(
                          `${session.meeting_date}T00:00:00`,
                        );
                        return (
                          <option value={session.id} key={session.id}>
                            {meetingDate.toLocaleDateString("en-MY", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            — {session.title}
                          </option>
                        );
                      })}
                    </select>
                    <small>
                      Earliest to latest · closest meeting selected automatically
                    </small>
                  </label>
                  <div className="selected-session-card">
                    {(() => {
                      const meetingDate = new Date(
                        `${activeSession.meeting_date}T00:00:00`,
                      );
                      const present = data.attendance.filter(
                        (item) =>
                          item.session_id === activeSession.id &&
                          item.status === "present",
                      ).length;
                      return (
                        <>
                          <time
                            className="session-date"
                            dateTime={activeSession.meeting_date}
                          >
                            <span>
                              {meetingDate
                                .toLocaleDateString("en-MY", { month: "short" })
                                .toUpperCase()}
                            </span>
                            <strong>
                              {meetingDate.toLocaleDateString("en-MY", {
                                day: "2-digit",
                              })}
                            </strong>
                            <small>
                              {meetingDate.toLocaleDateString("en-MY", {
                                weekday: "short",
                              })}
                            </small>
                          </time>
                          <span className="session-info">
                            <strong>{activeSession.title}</strong>
                            <small>
                              {meetingDate.toLocaleDateString("en-MY", {
                                year: "numeric",
                              })}
                            </small>
                          </span>
                          <span className="session-count">
                            <strong>
                              {present}/{attendanceMembers.length}
                            </strong>
                            <small>Present</small>
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <strong>No meetings yet</strong>
                  <p>Create your first meeting to start taking attendance.</p>
                  {canManageAttendance && (
                    <button
                      className="primary"
                      onClick={() => setShowSession(true)}
                    >
                      New meeting
                    </button>
                  )}
                </div>
              )}
            </aside>
            <article className="panel attendance-register">
              {activeSession ? (
                <>
                  <div className="panel-heading attendance-heading">
                    <div>
                      <p className="eyebrow">ATTENDANCE REGISTER</p>
                      <h2>{activeSession.title}</h2>
                      <small>
                        {new Date(
                          `${activeSession.meeting_date}T00:00:00`,
                        ).toLocaleDateString("en-MY", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </small>
                    </div>
                    {canManageAwards && (
                      <button
                        className="danger-link"
                        onClick={() => deleteAttendanceSession(activeSession)}
                      >
                        Delete meeting
                      </button>
                    )}
                  </div>
                  <div className="attendance-summary">
                    {(
                      [
                        "present",
                        "absent",
                        "excused",
                        "unmarked",
                      ] as AttendanceStatus[]
                    ).map((status) => (
                      <span key={status} className={status}>
                        <strong>
                          {
                            attendanceMembers.filter(
                              (member) =>
                                (attendanceMap.get(
                                  `${activeSession.id}:${member.id}`,
                                )?.status ?? "unmarked") === status,
                            ).length
                          }
                        </strong>{" "}
                        {attendanceLabel[status]}
                      </span>
                    ))}
                  </div>
                  <div className="attendance-rows">
                    {attendanceMembers.map((member) => {
                      const key = `attendance-${activeSession.id}-${member.id}`;
                      const current =
                        attendanceMap.get(`${activeSession.id}:${member.id}`)
                          ?.status ?? "unmarked";
                      return (
                        <div className="attendance-row" key={member.id}>
                          <div className="avatar small">
                            {initials(member.name)}
                          </div>
                          <div className="member-meta">
                            <strong>{member.name}</strong>
                            <span>{member.rank}</span>
                          </div>
                          <div
                            className="attendance-options"
                            role="group"
                            aria-label={`${member.name} attendance`}
                          >
                            {attendanceOrder.slice(1).map((status) => (
                              <button
                                key={status}
                                disabled={
                                  !canManageAttendance || saving === key
                                }
                                className={`${status} ${current === status ? "active" : ""}`}
                                onClick={() =>
                                  updateAttendance(
                                    activeSession.id,
                                    member.id,
                                    current === status ? "unmarked" : status,
                                  )
                                }
                              >
                                {attendanceLabel[status]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="empty-state large">
                  <strong>Select or create a meeting</strong>
                  <p>The register will appear here.</p>
                </div>
              )}
            </article>
          </section>
        )}

        {view === "subscriptions" && (
          <section className="panel subscription-panel">
            <div className="subscription-heading">
              <div>
                <p className="eyebrow">SUBSCRIPTION REGISTER</p>
                <h2>
                  {subscriptionYear} {subscriptionType === "band" ? "band" : "company"} subscription
                </h2>
                <p>
                  {(subscriptionType === "band"
                    ? canManageBandSubscriptions
                    : canManageSubscriptions)
                    ? subscriptionType === "band"
                      ? "Track only members who participate in band. No fee amount is recorded."
                      : "Mark each member as paid when their yearly subscription is received."
                    : "Subscription records are shown in read-only mode."}
                </p>
              </div>
              <div className="subscription-controls">
                <div className="section-switch" aria-label="Subscription type">
                  <button
                    type="button"
                    className={subscriptionType === "company" ? "active" : ""}
                    onClick={() => setSubscriptionType("company")}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    className={subscriptionType === "band" ? "active" : ""}
                    onClick={() => setSubscriptionType("band")}
                  >
                    Band
                  </button>
                </div>
                <label>
                  Year
                  <select
                    value={subscriptionYear}
                    onChange={(event) =>
                      setSubscriptionYear(Number(event.target.value))
                    }
                  >
                    {Array.from(
                      { length: currentSubscriptionYear - 1998 },
                      (_, index) => currentSubscriptionYear + 1 - index,
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="subscription-summary">
              <span className="paid">
                <strong>
                  {
                    filteredMembers.filter((member) =>
                      subscriptionType === "band"
                        ? Boolean(member.band_member) &&
                          bandSubscriptionMap.get(`${member.id}:${subscriptionYear}`) === "paid"
                        : subscriptionMap.get(`${member.id}:${subscriptionYear}`),
                    ).length
                  }
                </strong>{" "}
                Paid
              </span>
              <span>
                <strong>
                  {
                    filteredMembers.filter(
                      (member) =>
                        subscriptionType === "band"
                          ? Boolean(member.band_member) &&
                            (bandSubscriptionMap.get(`${member.id}:${subscriptionYear}`) ?? "unpaid") === "unpaid"
                          : !subscriptionMap.get(`${member.id}:${subscriptionYear}`),
                    ).length
                  }
                </strong>{" "}
                Unpaid
              </span>
              {subscriptionType === "band" && (
                <span>
                  <strong>
                    {filteredMembers.filter(
                      (member) =>
                        Boolean(member.band_member) &&
                        bandSubscriptionMap.get(`${member.id}:${subscriptionYear}`) === "exempt",
                    ).length}
                  </strong>{" "}
                  Exempt
                </span>
              )}
            </div>
            <div className="subscription-rows">
              {filteredMembers
                .filter((member) => subscriptionType === "company" || Boolean(member.band_member))
                .map((member) => {
                const key =
                  subscriptionType === "band"
                    ? `band-subscription-${subscriptionYear}-${member.id}`
                    : `subscription-${subscriptionYear}-${member.id}`;
                const paid =
                  subscriptionMap.get(`${member.id}:${subscriptionYear}`) ??
                  false;
                const bandStatus =
                  bandSubscriptionMap.get(`${member.id}:${subscriptionYear}`) ??
                  "unpaid";
                return (
                  <div className="subscription-row" key={member.id}>
                    <div className="avatar small">{initials(member.name)}</div>
                    <div className="member-meta">
                      <strong>{member.name}</strong>
                      <span>
                        {member.rank} · {member.squad}
                      </span>
                    </div>
                    {subscriptionType === "band" ? (
                      <select
                        className={`subscription-status ${bandStatus}`}
                        value={bandStatus}
                        disabled={!canManageBandSubscriptions || saving === key}
                        onChange={(event) =>
                          updateBandSubscription(
                            member.id,
                            event.target.value as BandSubscriptionRecord["status"],
                          )
                        }
                        aria-label={`${member.name} band subscription for ${subscriptionYear}`}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    ) : (
                      <button
                        type="button"
                        className={paid ? "paid" : "unpaid"}
                        disabled={!canManageSubscriptions || saving === key}
                        onClick={() => updateSubscription(member.id, !paid)}
                        aria-label={`${member.name} subscription for ${subscriptionYear}: ${paid ? "Paid" : "Unpaid"}`}
                      >
                        {saving === key ? "Saving…" : paid ? "✓ Paid" : "Unpaid"}
                      </button>
                    )}
                  </div>
                );
              })}
              {subscriptionType === "band" &&
                !filteredMembers.some((member) => Boolean(member.band_member)) && (
                  <div className="empty-state large">
                    <strong>No band members in this section</strong>
                    <p>Edit a member profile and turn on Band member.</p>
                  </div>
                )}
            </div>
          </section>
        )}
      </main>

      {viewingMember &&
        (() => {
          const stats = memberStats(viewingMember);
          const attendance = memberAttendance(viewingMember);
          const awardRows = data.progress.filter(
            (item) =>
              item.member_id === viewingMember.id &&
              item.status !== "not_started",
          );
          return (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={() => setViewingMemberId(null)}
            >
              <section
                className="modal member-profile-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="member-profile-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-heading member-profile-heading">
                  <div className="member-profile-identity">
                    <div className="avatar large">
                      {initials(viewingMember.name)}
                    </div>
                    <div>
                      <p className="eyebrow">MEMBER PROFILE</p>
                      <h2 id="member-profile-title">{viewingMember.name}</h2>
                      <small>
                        {viewingMember.rank} · {viewingMember.squad} Squad
                      </small>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingMemberId(null)}
                    aria-label="Close member profile"
                  >
                    ×
                  </button>
                </div>

                <div className="member-profile-body">
                  <div className="member-profile-stats">
                    <span>
                      <strong>{attendance.percentage}%</strong>
                      <small>Attendance</small>
                    </span>
                    <span>
                      <strong>{stats.awarded}</strong>
                      <small>Awards</small>
                    </span>
                    <span>
                      <strong>{stats.active}</strong>
                      <small>In progress</small>
                    </span>
                    <span>
                      <strong>{viewingMember.service_years}</strong>
                      <small>Service years</small>
                    </span>
                  </div>

                  <section className="member-profile-section">
                    <div className="member-profile-section-heading">
                      <div>
                        <p className="eyebrow">PERSONAL DETAILS</p>
                        <h3>Member information</h3>
                      </div>
                      {canEditMembers && (
                        <button
                          className="edit-member"
                          onClick={() => {
                            setViewingMemberId(null);
                            openEditMember(viewingMember);
                          }}
                        >
                          Edit details
                        </button>
                      )}
                    </div>
                    <dl className="member-profile-details">
                      <div>
                        <dt>School</dt>
                        <dd>{viewingMember.school || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Joined year</dt>
                        <dd>{joinedYear(viewingMember.joined_at)}</dd>
                      </div>
                      <div>
                        <dt>Contact number</dt>
                        <dd>{viewingMember.contact_number || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Emergency contact</dt>
                        <dd>
                          {viewingMember.emergency_contact_number ||
                            "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{viewingMember.email || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Parent or guardian</dt>
                        <dd>{viewingMember.parents_name || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Service awards</dt>
                        <dd>{viewingMember.service_award_count}</dd>
                      </div>
                      <div>
                        <dt>{subscriptionYear} subscription</dt>
                        <dd>
                          {subscriptionMap.get(
                            `${viewingMember.id}:${subscriptionYear}`,
                          )
                            ? "Paid"
                            : "Not paid"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="member-profile-section">
                    <div className="member-profile-section-heading">
                      <div>
                        <p className="eyebrow">ATTENDANCE</p>
                        <h3>
                          {attendance.present} of {attendance.total} meetings
                        </h3>
                      </div>
                    </div>
                    <div className="member-profile-attendance">
                      <span className="present">
                        <strong>{attendance.present}</strong> Present
                      </span>
                      <span className="absent">
                        <strong>{attendance.absent}</strong> Absent
                      </span>
                      <span className="excused">
                        <strong>{attendance.excused}</strong> Excused
                      </span>
                      <span>
                        <strong>{attendance.unmarked}</strong> Unmarked
                      </span>
                    </div>
                  </section>

                  <section className="member-profile-section">
                    <div className="member-profile-section-heading">
                      <div>
                        <p className="eyebrow">AWARD RECORD</p>
                        <h3>Awards with recorded progress</h3>
                      </div>
                    </div>
                    {awardRows.length || viewingMember.service_award_count ? (
                      <div className="member-profile-awards">
                        {viewingMember.service_award_count > 0 && (
                          <div>
                            <span>One-Year Service Award</span>
                            <strong className="progress-status awarded">
                              {viewingMember.service_award_count} awarded
                            </strong>
                          </div>
                        )}
                        {awardRows.map((item) => {
                          const award = data.awards.find(
                            (entry) => entry.code === item.award_code,
                          );
                          return (
                            <div
                              key={`${item.award_code}:${item.level}`}
                            >
                              <span>
                                {award?.name ?? item.award_code}
                                <small>
                                  {item.level === "advanced"
                                    ? "Advanced"
                                    : "Basic"}
                                </small>
                              </span>
                              <strong
                                className={`progress-status ${item.status}`}
                              >
                                {statusLabel[item.status]}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="member-profile-empty">
                        No award progress has been recorded yet.
                      </p>
                    )}
                  </section>
                </div>

                <footer className="member-profile-footer">
                  <button
                    type="button"
                    disabled={viewingMemberIndex <= 0}
                    onClick={() =>
                      setViewingMemberId(
                        filteredMembers[viewingMemberIndex - 1]?.id ?? null,
                      )
                    }
                  >
                    ← Previous
                  </button>
                  <span>
                    {viewingMemberIndex + 1} of {filteredMembers.length}
                  </span>
                  <button
                    type="button"
                    disabled={
                      viewingMemberIndex < 0 ||
                      viewingMemberIndex >= filteredMembers.length - 1
                    }
                    onClick={() =>
                      setViewingMemberId(
                        filteredMembers[viewingMemberIndex + 1]?.id ?? null,
                      )
                    }
                  >
                    Next →
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}

      {submissionMember && user && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSubmissionMember(null)}
        >
          <section
            className="modal account-modal member-submission-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-member-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">AWARD SUBMISSIONS</p>
                <h2 id="submission-member-title">{submissionMember.name}</h2>
                <small>
                  {submissionMember.rank} · {submissionMember.squad}
                </small>
              </div>
              <button
                onClick={() => setSubmissionMember(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AwardSubmissions
              user={user}
              memberId={submissionMember.id}
              onChanged={load}
            />
          </section>
        </div>
      )}

      {showAdd && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            setShowAdd(false);
            setEditingMember(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {editingMember ? "EDIT PROFILE" : "NEW PROFILE"}
                </p>
                <h2 id="add-title">
                  {editingMember
                    ? "Member details"
                    : `Add a ${section === "junior" ? "Junior" : "Senior"} member`}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setEditingMember(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form key={editingMember?.id ?? "new"} onSubmit={saveMember}>
              <label>
                Full name
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="e.g. Michelle Tan"
                  defaultValue={editingMember?.name ?? ""}
                />
              </label>
              <div className="form-row">
                <label>
                  Rank
                  <select
                    name="rank"
                    defaultValue={editingMember?.rank ?? "Private"}
                  >
                    <option>Private</option>
                    {section === "junior" ? (
                      <>
                        <option>Assistant Leading Boy</option>
                        <option>Leading Boy</option>
                      </>
                    ) : (
                      <>
                        <option>Lance Corporal</option>
                        <option>Corporal</option>
                        <option>Sergeant</option>
                        <option>Staff Sergeant</option>
                      </>
                    )}
                  </select>
                </label>
                <label>
                  Squad
                  <select
                    name="squad"
                    defaultValue={editingMember?.squad ?? "Alpha"}
                  >
                    <option>Alpha</option>
                    <option>Bravo</option>
                    <option>Charlie</option>
                    <option>Delta</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Joined year
                  <input
                    name="joinedAt"
                    type="number"
                    min="1900"
                    max={currentSubscriptionYear}
                    inputMode="numeric"
                    required
                    value={joinedAtDraft}
                    onChange={(event) => setJoinedAtDraft(event.target.value)}
                  />
                </label>
                <label>
                  Service years
                  <input
                    name="serviceYears"
                    type="number"
                    readOnly
                    value={serviceYearsFromJoined(joinedAtDraft)}
                  />
                  <small>Calculated automatically from joining year</small>
                </label>
              </div>
              <div className="form-row">
                <label>
                  School
                  <input
                    name="school"
                    required={!overrideMemberDetails}
                    defaultValue={editingMember?.school ?? ""}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required={!overrideMemberDetails}
                    defaultValue={editingMember?.email ?? ""}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Contact Number
                  <input
                    name="contactNumber"
                    type="tel"
                    required={!overrideMemberDetails}
                    defaultValue={editingMember?.contact_number ?? ""}
                  />
                </label>
                <label>
                  Emergency Contact Number
                  <input
                    name="emergencyContactNumber"
                    type="tel"
                    required={!overrideMemberDetails}
                    defaultValue={editingMember?.emergency_contact_number ?? ""}
                  />
                </label>
              </div>
              <label>
                Parents Name
                <input
                  name="parentsName"
                  required={!overrideMemberDetails}
                  defaultValue={editingMember?.parents_name ?? ""}
                />
              </label>
              <label className="override-details band-member-field">
                <input
                  name="bandMember"
                  type="checkbox"
                  defaultChecked={Boolean(editingMember?.band_member)}
                />
                <span>
                  Band member
                  <small>
                    Include this member in the separate band subscription register
                  </small>
                </span>
              </label>
              {canOverrideMemberDetails && (
                <label className="override-details">
                  <input
                    type="checkbox"
                    checked={overrideMemberDetails}
                    onChange={(event) =>
                      setOverrideMemberDetails(event.target.checked)
                    }
                  />
                  <span>
                    Allow incomplete profile
                    <small>Admin and Officer override only</small>
                  </span>
                </label>
              )}
              <button className="primary submit" disabled={Boolean(saving)}>
                {saving
                  ? "Saving…"
                  : editingMember
                    ? "Save details"
                    : "Add member"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showSession && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowSession(false)}
        >
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NEW REGISTER</p>
                <h2 id="session-title">Create a meeting</h2>
              </div>
              <button onClick={() => setShowSession(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={createAttendanceSession}>
              <label>
                Meeting name
                <input name="title" required defaultValue="Weekly Parade" />
              </label>
              <label>
                Meeting date
                <input
                  name="meetingDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <button
                className="primary submit"
                disabled={saving === "new-session"}
              >
                {saving === "new-session" ? "Creating…" : "Create register"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showExportCentre && (
        <ExportCentre
          currentYear={currentSubscriptionYear}
          onClose={() => setShowExportCentre(false)}
          onComplete={setNotice}
          onLegacyCsv={exportCsv}
        />
      )}
    </div>
  );
}
