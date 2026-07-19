"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

type User = { email: string; role: "admin" | "officer" | "nco" | "squad_leader" | "member" };
type Award = { code: string; name: string; category: string; basic_available: number; advanced_available: number };
type Progress = { award_code: string; level: string; status: string; awarded_at: string | null };
type ProgressData = {
  linked: boolean;
  accountEmail?: string;
  member?: { id: number; name: string; rank: string; squad: string; service_award_count: number };
  awards?: Award[];
  progress?: Progress[];
  attendance?: { total: number; present: number; absent: number; excused: number; unmarked: number; percentage: number };
};

const statusLabels: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
  awarded: "Awarded",
};

export default function MemberProgress({ user }: { user: User }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user.role !== "member") return;
    fetch("/api/member-progress", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ProgressData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load your progress");
        setData(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load your progress"));
  }, [user.email, user.role]);

  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>();
    data?.progress?.forEach((item) => map.set(`${item.award_code}:${item.level}`, item));
    return map;
  }, [data]);

  if (user.role !== "member") return null;
  if (error) return <section className="member-progress-section"><p className="form-error">{error}</p></section>;
  if (!data) return <section className="member-progress-section panel progress-loading">Loading your attendance and awards…</section>;
  if (!data.linked) return <section className="member-progress-section panel progress-unlinked"><p className="eyebrow">MY PROGRESS</p><h2>Connect your member profile</h2><p>Ask an administrator to enter <strong>{data.accountEmail}</strong> as the Email on your member profile. Your attendance and awards will then appear here automatically.</p></section>;

  const attendance = data.attendance!;
  const awarded =
    (data.progress?.filter(
      (item) =>
        item.status === "awarded" &&
        ![
          "one_year_service",
          "three_year_service",
          "long_year_service",
        ].includes(item.award_code),
    ).length ?? 0) + (data.member?.service_award_count ?? 0);
  return (
    <section className="member-progress-section">
      <div className="member-progress-heading">
        <div>
          <p className="eyebrow">MY PROGRESS</p>
          <h2>{data.member?.name}</h2>
          <p>
            {data.member?.rank} · {data.member?.squad} Squad · Read-only
          </p>
        </div>
      </div>
      <div className="personal-stat-grid">
        <article className="panel attendance-percentage">
          <div
            className="percentage-ring"
            style={
              {
                "--attendance": `${attendance.percentage * 3.6}deg`,
              } as CSSProperties
            }
          >
            <span>{attendance.percentage}%</span>
          </div>
          <div>
            <p className="eyebrow">ATTENDANCE</p>
            <h3>
              {attendance.present} of {attendance.total} meetings
            </h3>
            <small>Percentage is based on all recorded meetings.</small>
          </div>
        </article>
        <article className="panel personal-award-total">
          <p className="eyebrow">AWARDS EARNED</p>
          <strong>{awarded}</strong>
          <small>
            Includes {data.member?.service_award_count ?? 0} service award
            {data.member?.service_award_count === 1 ? "" : "s"}
          </small>
        </article>
        <article className="panel attendance-breakdown">
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
        </article>
      </div>
      <div className="panel personal-award-matrix">
        <div className="personal-matrix-heading">
          <div>
            <p className="eyebrow">AWARDS MATRIX</p>
            <h3>Your award record</h3>
          </div>
          <span>View only</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Award</th>
                <th>Basic</th>
                <th>Advanced</th>
              </tr>
            </thead>
            <tbody>
              {data.awards?.map((award) =>
                award.code === "one_year_service" ? (
                  <tr key={award.code}>
                    <td>{award.category}</td>
                    <th>{award.name}</th>
                    <td colSpan={2}>
                      <span className="progress-status awarded">
                        {data.member?.service_award_count ?? 0} awarded
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={award.code}>
                    <td>{award.category}</td>
                    <th>{award.name}</th>
                    <td>
                      {award.basic_available ? (
                        <span
                          className={`progress-status ${progressMap.get(`${award.code}:basic`)?.status ?? "not_started"}`}
                        >
                          {
                            statusLabels[
                              progressMap.get(`${award.code}:basic`)?.status ??
                                "not_started"
                            ]
                          }
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {award.advanced_available ? (
                        <span
                          className={`progress-status ${progressMap.get(`${award.code}:advanced`)?.status ?? "not_started"}`}
                        >
                          {
                            statusLabels[
                              progressMap.get(`${award.code}:advanced`)
                                ?.status ?? "not_started"
                            ]
                          }
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
