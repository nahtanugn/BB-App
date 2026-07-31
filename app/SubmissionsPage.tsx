"use client";

import AwardSubmissions from "./AwardSubmissions";

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
}: {
  user: User;
  initialSection?: "senior" | "junior";
  onBack: () => void;
  onLogout: () => void;
}) {
  const section = "senior" as const;
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
      <section className="resources-hero submissions-hero">
        <div>
          <p className="eyebrow">11TH KUCHING COMPANY</p>
          <h1>
            {canReviewAll
              ? "Senior Submission Portal"
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
