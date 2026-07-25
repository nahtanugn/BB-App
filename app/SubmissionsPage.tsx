"use client";

import { useState } from "react";
import AwardSubmissions from "./AwardSubmissions";

type User = {
  name: string;
  email: string;
  role:
    | "admin"
    | "temporary_admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "member";
};

export default function SubmissionsPage({
  user,
  initialSection = "senior",
  onBack,
  onLogout,
}: {
  user: User;
  initialSection?: "senior" | "junior";
  onBack: () => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<"senior" | "junior">(
    initialSection,
  );
  const canReviewAll = ["admin", "temporary_admin", "officer"].includes(
    user.role,
  );
  return (
    <main className="resources-shell submissions-page">
      <header className="resources-topbar">
        <div className="resource-brand">
          <div
            className="brand-mark app-photo"
            role="img"
            aria-label="11th Kuching Company"
          />
          <div>
            <strong>11KCHBB App</strong>
            <span>Award submissions</span>
          </div>
        </div>
        <div className="resource-user">
          <span>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
          <button onClick={onBack}>
            {user.role === "member" ? "Back to resources" : "Back to tracker"}
          </button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <section className="resources-hero submissions-hero">
        <div>
          {canReviewAll && (
            <div
              className="section-switch"
              role="group"
              aria-label="Submission section"
            >
              <button
                className={section === "senior" ? "active" : ""}
                onClick={() => setSection("senior")}
              >
                Senior
              </button>
              <button
                className={section === "junior" ? "active" : ""}
                onClick={() => setSection("junior")}
              >
                Junior
              </button>
            </div>
          )}
          <p className="eyebrow">11TH KUCHING COMPANY</p>
          <h1>
            {canReviewAll
              ? `${section === "junior" ? "Junior" : "Senior"} Submission Portal`
              : "Award submissions"}
          </h1>
          <p>
            {user.role === "member"
              ? "Apply for an award and follow its review status."
              : user.role === "squad_leader"
                ? "View applications submitted by members."
                : "Review all member applications, edit decisions when needed, and update the Award Matrix automatically."}
          </p>
        </div>
      </section>
      <AwardSubmissions user={user} section={section} />
    </main>
  );
}
