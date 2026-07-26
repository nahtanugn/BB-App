"use client";

import { useState } from "react";
import AwardSubmissions from "./AwardSubmissions";
import AppNavigation from "./AppNavigation";

type User = {
  name: string;
  email: string;
  role:
    | "admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "viewer"
    | "member";
  temporary_access_role: string;
  access_expires_at: string | null;
  custom_permissions?: string[];
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
  const hasTemporaryAdminAccess = Boolean(
    user.role !== "viewer" &&
      user.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const canReviewAll =
    ["admin", "officer", "viewer"].includes(user.role) ||
    hasTemporaryAdminAccess ||
    Boolean(
      user.custom_permissions?.some((permission) =>
        ["submissions.view", "submissions.review"].includes(permission),
      ),
    );
  return (
    <main className="resources-shell submissions-page">
      <AppNavigation
        section="Award Submissions"
        userName={user.name}
        userDescription={user.role.replace("_", " ")}
        onBack={onBack}
        backLabel={
          user.role === "member" && !hasTemporaryAdminAccess
            ? "Back to resources"
            : "Back to tracker"
        }
        onLogout={onLogout}
      />
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
            {["member", "nco", "squad_leader"].includes(user.role) &&
            !hasTemporaryAdminAccess
              ? "Apply for an award and follow its review status."
              : "Review all member applications, edit decisions when needed, and update the Award Matrix automatically."}
          </p>
        </div>
      </section>
      <AwardSubmissions user={user} section={section} />
    </main>
  );
}
