"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  name: string;
  role: "admin" | "officer" | "nco" | "squad_leader" | "member";
};
type Award = {
  code: string;
  name: string;
  category: string;
  basic_available: number;
  advanced_available: number;
};
type Submission = {
  id: number;
  member_id: number;
  submitted_by_email: string;
  member_name: string;
  award_name: string;
  level: string;
  evidence_url: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export default function AwardSubmissions({
  user,
  memberId,
  onChanged,
}: {
  user: User;
  memberId?: number;
  onChanged?: () => void | Promise<void>;
}) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [awardCode, setAwardCode] = useState("");
  const [level, setLevel] = useState("basic");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isOfficerPortal =
    (user.role === "admin" || user.role === "officer") && !memberId;
  const endpoint =
    user.role === "member"
      ? "/api/submissions"
      : isOfficerPortal
        ? "/api/submissions?all=1"
        : `/api/submissions?memberId=${memberId ?? ""}`;

  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = (await response.json()) as {
      awards?: Award[];
      submissions?: Submission[];
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to load award submissions");
    setAwards(result.awards ?? []);
    setSubmissions(result.submissions ?? []);
    setAwardCode((current) => current || result.awards?.[0]?.code || "");
  }

  useEffect(() => {
    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          awards?: Award[];
          submissions?: Submission[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load award submissions");
        return result;
      })
      .then((result) => {
        setAwards(result.awards ?? []);
        setSubmissions(result.submissions ?? []);
        setAwardCode(result.awards?.[0]?.code ?? "");
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load award submissions",
        ),
      );
  }, [endpoint]);

  const selectedAward = useMemo(
    () => awards.find((award) => award.code === awardCode),
    [awardCode, awards],
  );
  const categories = useMemo(() => {
    const grouped = new Map<string, Award[]>();
    awards.forEach((award) =>
      grouped.set(award.category, [
        ...(grouped.get(award.category) ?? []),
        award,
      ]),
    );
    return [...grouped.entries()];
  }, [awards]);
  const visibleSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return submissions.filter(
      (submission) =>
        (statusFilter === "all" || submission.status === statusFilter) &&
        (!term ||
          `${submission.member_name} ${submission.award_name} ${submission.submitted_by_email}`
            .toLowerCase()
            .includes(term)),
    );
  }, [search, statusFilter, submissions]);

  function selectAward(code: string) {
    setAwardCode(code);
    const award = awards.find((item) => item.code === code);
    if (level === "advanced" && award && !award.advanced_available)
      setLevel("basic");
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("submit");
    setError("");
    setMessage("");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_submission",
        memberName: form.get("memberName"),
        awardCode,
        level,
        evidenceUrl: form.get("evidenceUrl"),
        notes: form.get("notes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok)
      return setError(result.error ?? "Unable to submit application");
    event.currentTarget.reset();
    setMessage("Your award application has been submitted for officer review.");
    await load();
  }

  async function review(
    submission: Submission,
    status: "approved" | "rejected",
  ) {
    setBusy(`${submission.id}:${status}`);
    setError("");
    setMessage("");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review_submission",
        submissionId: submission.id,
        status,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok)
      return setError(result.error ?? "Unable to review submission");
    setMessage(
      status === "approved"
        ? `${submission.member_name}'s ${submission.award_name} was verified. Their Award Matrix is now marked Verified, awaiting award.`
        : `${submission.member_name}'s submission was rejected.`,
    );
    await load();
    await onChanged?.();
  }

  if (user.role === "nco") return null;

  return (
    <section className="submission-section">
      <div className="submission-heading">
        <div>
          <p className="eyebrow">AWARD SUBMISSIONS</p>
          <h2>
            {user.role === "member"
              ? "Apply for an award"
              : isOfficerPortal
                ? "Officer Submission Portal"
              : user.role === "squad_leader"
                ? "Member applications"
                : "Review member applications"}
          </h2>
          <p>
            {user.role === "member"
              ? "Send your completed work to an officer for review."
              : isOfficerPortal
                ? "Review every member application. Verification automatically updates the Award Matrix to Verified, awaiting award."
              : user.role === "squad_leader"
                ? "View submitted applications and their review status."
                : "Approve or reject award applications submitted by members."}
          </p>
        </div>
        <span>
          {submissions.filter((item) => item.status === "pending").length}{" "}
          pending
        </span>
      </div>
      {user.role === "member" && (
        <form className="submission-form panel" onSubmit={submitApplication}>
          <div className="form-row">
            <label>
              Member name
              <input name="memberName" readOnly value={user.name} />
            </label>
            <label>
              Award
              <select
                value={awardCode}
                onChange={(event) => selectAward(event.target.value)}
                required
              >
                {categories.map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((award) => (
                      <option key={award.code} value={award.code}>
                        {award.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Level
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              >
                <option
                  value="basic"
                  disabled={
                    selectedAward ? !selectedAward.basic_available : false
                  }
                >
                  Basic
                </option>
                <option
                  value="advanced"
                  disabled={
                    selectedAward ? !selectedAward.advanced_available : false
                  }
                >
                  Advanced
                </option>
              </select>
            </label>
            <label>
              Evidence link (optional)
              <input name="evidenceUrl" type="url" placeholder="https://…" />
            </label>
          </div>
          <label>
            Notes for the reviewing officer
            <textarea
              name="notes"
              rows={4}
              placeholder="Describe the work completed or where the evidence can be found."
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          <button
            className="primary"
            disabled={busy === "submit" || !awardCode}
          >
            {busy === "submit" ? "Submitting…" : "Submit application"}
          </button>
        </form>
      )}
      {error && user.role !== "member" && (
        <p className="form-error submission-error">{error}</p>
      )}
      {message && user.role !== "member" && (
        <p className="form-success submission-message">{message}</p>
      )}
      {isOfficerPortal && (
        <div className="submission-portal-toolbar panel">
          <label>
            Search submissions
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Member, award or email"
            />
          </label>
          <label>
            Review status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All submissions</option>
              <option value="pending">Pending review</option>
              <option value="approved">Verified · awaiting award</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <div className="submission-portal-counts">
            <span><strong>{submissions.length}</strong>Total</span>
            <span><strong>{submissions.filter((item) => item.status === "pending").length}</strong>Pending</span>
            <span><strong>{submissions.filter((item) => item.status === "approved").length}</strong>Verified</span>
          </div>
        </div>
      )}
      <div className="submission-list">
        {visibleSubmissions.length ? (
          visibleSubmissions.map((submission) => (
            <article className="submission-card panel" key={submission.id}>
              <div className="submission-card-top">
                <span className={`submission-status ${submission.status}`}>
                  {submission.status === "approved"
                    ? "Verified · awaiting award"
                    : submission.status}
                </span>
                <small>
                  {new Date(submission.submitted_at).toLocaleDateString(
                    "en-MY",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </small>
              </div>
              <h3>
                {submission.award_name} · {submission.level}
              </h3>
              <p className="submission-member">
                {submission.member_name}
                {user.role !== "member"
                  ? ` · ${submission.submitted_by_email}`
                  : ""}
              </p>
              {submission.notes && <p>{submission.notes}</p>}
              {submission.evidence_url && (
                <a
                  href={submission.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open evidence →
                </a>
              )}
              {submission.reviewed_by && (
                <small className="review-note">
                  Reviewed by {submission.reviewed_by}
                </small>
              )}
              {(user.role === "admin" || user.role === "officer") &&
                submission.status === "pending" && (
                  <div className="submission-actions">
                    <button
                      className="approve"
                      disabled={Boolean(busy)}
                      onClick={() => review(submission, "approved")}
                    >
                      {busy === `${submission.id}:approved`
                        ? "Verifying…"
                        : "Verify & update matrix"}
                    </button>
                    <button
                      className="reject"
                      disabled={Boolean(busy)}
                      onClick={() => review(submission, "rejected")}
                    >
                      {busy === `${submission.id}:rejected`
                        ? "Rejecting…"
                        : "Reject"}
                    </button>
                  </div>
                )}
            </article>
          ))
        ) : (
          <div className="submission-empty">
            <strong>
              {submissions.length
                ? "No submissions match these filters"
                : "No award submissions yet"}
            </strong>
            <p>
              {user.role === "member"
                ? "Your applications will appear here after you submit them."
                : "Member applications will appear here for review."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
