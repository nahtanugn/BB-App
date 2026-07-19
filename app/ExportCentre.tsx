"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "verified"
  | "awarded";
type AttendanceStatus = "unmarked" | "present" | "absent" | "excused";
type Member = {
  id: number;
  name: string;
  rank: string;
  squad: string;
  joined_at: string;
  service_years: number;
  service_award_count: number;
  school: string;
  contact_number: string;
  emergency_contact_number: string;
  email: string;
  parents_name: string;
  is_demo: number;
};
type TrackerData = {
  members: Member[];
  awards: Array<{
    code: string;
    name: string;
    category: string;
    basic_available: number;
    advanced_available: number;
  }>;
  progress: Array<{
    member_id: number;
    award_code: string;
    level: string;
    status: Status;
  }>;
  attendanceSessions: Array<{
    id: number;
    meeting_date: string;
    title: string;
  }>;
  attendance: Array<{
    session_id: number;
    member_id: number;
    status: AttendanceStatus;
  }>;
  subscriptions: Array<{ member_id: number; year: number; paid: number }>;
  syllabus: string;
  section: "senior" | "junior";
};
type Submission = {
  id: number;
  member_id: number;
  submitted_by_email: string;
  member_name: string;
  award_code: string;
  award_name: string;
  level: string;
  evidence_url: string;
  notes: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
type SheetData = {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const statusLabels: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
  awarded: "Awarded",
};
const attendanceLabels: Record<AttendanceStatus, string> = {
  unmarked: "Unmarked",
  present: "Present",
  absent: "Absent",
  excused: "Excused",
};

function sectionLabel(section: string) {
  return section === "senior" ? "Senior" : "Junior";
}

function joinedYear(value: string) {
  return /^(\d{4})/.exec(value)?.[1] ?? value;
}

function pathwayFor(
  dataset: TrackerData,
  member: Member,
  progressMap: Map<string, Status>,
) {
  const awarded = (code: string, level: string) =>
    progressMap.get(`${member.id}:${code}:${level}`) === "awarded";
  if (dataset.section === "junior") {
    const checks = ["White", "Green", "Purple", "Blue", "Red", "Silver", "Gold"].map(
      (colour) => ({
        label: `${colour} Award`,
        complete: awarded(`junior_${colour.toLowerCase()}`, "basic"),
      }),
    );
    return {
      checks,
      pathway: "Junior Gold Award pathway",
    };
  }

  const interestAwards = dataset.awards
    .filter((award) => /^[A-D] ·/.test(award.category))
    .map((award) => ({
      category: award.category[0],
      level: awarded(award.code, "advanced")
        ? "advanced"
        : awarded(award.code, "basic")
          ? "basic"
          : null,
    }))
    .filter((award) => award.level);
  return {
    pathway: "President's Award pathway",
    checks: [
      {
        label: "NCO Proficiency Star · Advanced",
        complete: awarded("nco_proficiency", "advanced"),
      },
      {
        label: "Christian Education · Advanced",
        complete: awarded("christian_education", "advanced"),
      },
      { label: "Drill · Advanced", complete: awarded("drill", "advanced") },
      {
        label: "Recruitment · Basic",
        complete: awarded("recruitment", "basic"),
      },
      {
        label: "At least 3 One-Year Service Awards",
        complete: member.service_award_count >= 3,
      },
      {
        label: "At least 6 Interest awards",
        complete: interestAwards.length >= 6,
      },
      {
        label: "Interest awards cover groups A, B, C and D",
        complete:
          new Set(interestAwards.map((award) => award.category)).size === 4,
      },
      {
        label: "At least 2 Basic Interest awards",
        complete:
          interestAwards.filter((award) => award.level === "basic").length >= 2,
      },
      {
        label: "At least 4 Advanced Interest awards",
        complete:
          interestAwards.filter((award) => award.level === "advanced").length >=
          4,
      },
    ],
  };
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ExportCentre({
  currentYear,
  onClose,
  onComplete,
  onLegacyCsv,
}: {
  currentYear: number;
  onClose: () => void;
  onComplete: (message: string) => void;
  onLegacyCsv: () => Promise<void>;
}) {
  const [datasets, setDatasets] = useState<TrackerData[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("both");
  const [squad, setSquad] = useState("all");
  const [member, setMember] = useState("all");
  const [reportYear, setReportYear] = useState(String(currentYear));
  const [format, setFormat] = useState<"xlsx" | "print">("xlsx");
  const [included, setIncluded] = useState({
    members: true,
    awards: true,
    attendance: true,
    subscriptions: true,
    submissions: true,
    requirements: true,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      ...(["senior", "junior"] as const).map(async (item) => {
        const response = await fetch(`/api/tracker?section=${item}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as TrackerData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load records");
        return result;
      }),
      fetch("/api/submissions?all=1", { cache: "no-store" }).then(
        async (response) => {
          const result = (await response.json()) as {
            submissions?: Submission[];
            error?: string;
          };
          if (!response.ok)
            throw new Error(result.error ?? "Unable to load submissions");
          return result.submissions ?? [];
        },
      ),
    ])
      .then(([senior, junior, allSubmissions]) => {
        if (!active) return;
        setDatasets([senior as TrackerData, junior as TrackerData]);
        setSubmissions(allSubmissions as Submission[]);
      })
      .catch((error) => {
        if (active)
          window.alert(
            error instanceof Error ? error.message : "Unable to open Export Centre",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableMembers = useMemo(
    () =>
      datasets.flatMap((dataset) =>
        dataset.members
          .filter(() => section === "both" || dataset.section === section)
          .filter((item) => squad === "all" || item.squad === squad)
          .map((item) => ({
            key: `${dataset.section}:${item.id}`,
            label: `${item.name} · ${sectionLabel(dataset.section)} · ${item.squad}`,
          })),
      ),
    [datasets, section, squad],
  );

  const years = useMemo(
    () =>
      [
        ...new Set([
          currentYear,
          ...datasets.flatMap((dataset) => [
            ...dataset.subscriptions.map((item) => item.year),
            ...dataset.attendanceSessions.map((item) =>
              Number(item.meeting_date.slice(0, 4)),
            ),
          ]),
        ]),
      ]
        .filter(Boolean)
        .sort((a, b) => b - a),
    [currentYear, datasets],
  );

  function makeSheets() {
    const selectedDatasets = datasets.filter(
      (dataset) => section === "both" || dataset.section === section,
    );
    const selected = selectedDatasets.flatMap((dataset) => {
      const progressMap = new Map(
        dataset.progress.map((item) => [
          `${item.member_id}:${item.award_code}:${item.level}`,
          item.status,
        ]),
      );
      const attendanceMap = new Map(
        dataset.attendance.map((item) => [
          `${item.session_id}:${item.member_id}`,
          item.status,
        ]),
      );
      return dataset.members
        .filter((item) => squad === "all" || item.squad === squad)
        .filter(
          (item) => member === "all" || member === `${dataset.section}:${item.id}`,
        )
        .map((item) => ({ dataset, member: item, progressMap, attendanceMap }));
    });
    const memberIds = new Set(selected.map((item) => item.member.id));
    const yearMatches = (value: string | number) =>
      reportYear === "all" || String(value).slice(0, 4) === reportYear;
    const sheets: SheetData[] = [];

    if (included.members) {
      sheets.push({
        name: "Members",
        headers: [
          "Member ID",
          "Section",
          "Syllabus",
          "Full Name",
          "Rank",
          "Squad",
          "Joined Year",
          "Service Years",
          "School",
          "Contact Number",
          "Emergency Contact Number",
          "Email",
          "Parents Name",
          "Demo Record",
        ],
        rows: selected.map(({ dataset, member: item }) => [
          item.id,
          sectionLabel(dataset.section),
          dataset.syllabus,
          item.name,
          item.rank,
          item.squad,
          joinedYear(item.joined_at),
          item.service_years,
          item.school,
          item.contact_number,
          item.emergency_contact_number,
          item.email,
          item.parents_name,
          item.is_demo ? "Yes" : "No",
        ]),
      });
    }

    if (included.awards) {
      sheets.push({
        name: "Award Summary",
        headers: [
          "Member ID",
          "Section",
          "Full Name",
          "One-Year Service Awards",
          "Awards Earned",
          "In Progress or Review",
          "Earned Awards",
        ],
        rows: selected.map(({ dataset, member: item, progressMap }) => {
          const earned = dataset.awards.flatMap((award) =>
            (["basic", "advanced"] as const)
              .filter((level) =>
                level === "basic"
                  ? Boolean(award.basic_available)
                  : Boolean(award.advanced_available),
              )
              .filter(
                (level) =>
                  progressMap.get(`${item.id}:${award.code}:${level}`) === "awarded",
              )
              .map(
                (level) =>
                  `${award.name} (${level === "basic" ? "Basic" : "Advanced"})`,
              ),
          );
          const active = [...progressMap.entries()].filter(
            ([key, status]) =>
              key.startsWith(`${item.id}:`) &&
              ["in_progress", "submitted", "verified"].includes(status),
          ).length;
          return [
            item.id,
            sectionLabel(dataset.section),
            item.name,
            item.service_award_count,
            earned.length + item.service_award_count,
            active,
            earned.join("; "),
          ];
        }),
      });
      sheets.push({
        name: "Award Details",
        headers: [
          "Member ID",
          "Section",
          "Full Name",
          "Category",
          "Award",
          "Level",
          "Status",
        ],
        rows: selected.flatMap(({ dataset, member: item, progressMap }) => [
          [
            item.id,
            sectionLabel(dataset.section),
            item.name,
            "Service",
            "One-Year Service Award",
            "Count",
            item.service_award_count,
          ],
          ...dataset.awards
            .filter((award) => award.code !== "one_year_service")
            .flatMap((award) =>
              (["basic", "advanced"] as const)
                .filter((level) =>
                  level === "basic"
                    ? Boolean(award.basic_available)
                    : Boolean(award.advanced_available),
                )
                .map((level) => [
                  item.id,
                  sectionLabel(dataset.section),
                  item.name,
                  award.category,
                  award.name,
                  level === "basic" ? "Basic" : "Advanced",
                  statusLabels[
                    progressMap.get(`${item.id}:${award.code}:${level}`) ??
                      "not_started"
                  ],
                ]),
            ),
        ]),
      });
    }

    if (included.attendance) {
      sheets.push({
        name: "Attendance Summary",
        headers: [
          "Member ID",
          "Section",
          "Full Name",
          "Meetings",
          "Present",
          "Absent",
          "Excused",
          "Unmarked",
          "Attendance Percentage",
        ],
        rows: selected.map(({ dataset, member: item, attendanceMap }) => {
          const sessions = dataset.attendanceSessions.filter((session) =>
            yearMatches(session.meeting_date),
          );
          const statuses = sessions.map(
            (session) =>
              attendanceMap.get(`${session.id}:${item.id}`) ?? "unmarked",
          );
          const count = (status: AttendanceStatus) =>
            statuses.filter((itemStatus) => itemStatus === status).length;
          const present = count("present");
          return [
            item.id,
            sectionLabel(dataset.section),
            item.name,
            sessions.length,
            present,
            count("absent"),
            count("excused"),
            count("unmarked"),
            sessions.length ? Math.round((present / sessions.length) * 100) : 0,
          ];
        }),
      });
      sheets.push({
        name: "Attendance Records",
        headers: [
          "Meeting Date",
          "Meeting Name",
          "Section",
          "Member ID",
          "Full Name",
          "Squad",
          "Status",
        ],
        rows: selected.flatMap(({ dataset, member: item, attendanceMap }) =>
          dataset.attendanceSessions
            .filter((session) => yearMatches(session.meeting_date))
            .map((session) => [
              session.meeting_date,
              session.title,
              sectionLabel(dataset.section),
              item.id,
              item.name,
              item.squad,
              attendanceLabels[
                attendanceMap.get(`${session.id}:${item.id}`) ?? "unmarked"
              ],
            ]),
        ),
      });
    }

    if (included.subscriptions) {
      const selectedYears =
        reportYear === "all" ? years : [Number(reportYear)];
      sheets.push({
        name: "Subscriptions",
        headers: ["Year", "Section", "Member ID", "Full Name", "Squad", "Status"],
        rows: selected.flatMap(({ dataset, member: item }) =>
          selectedYears.map((year) => {
            const paid = dataset.subscriptions.some(
              (record) =>
                record.member_id === item.id && record.year === year && record.paid,
            );
            return [
              year,
              sectionLabel(dataset.section),
              item.id,
              item.name,
              item.squad,
              paid ? "Paid" : "Unpaid",
            ];
          }),
        ),
      });
    }

    if (included.submissions) {
      sheets.push({
        name: "Award Submissions",
        headers: [
          "Submission ID",
          "Member ID",
          "Member Name",
          "Submitted By Email",
          "Award Code",
          "Award",
          "Level",
          "Status",
          "Submitted At",
          "Reviewed At",
          "Reviewed By",
          "Evidence Link",
          "Notes",
        ],
        rows: submissions
          .filter((item) => memberIds.has(item.member_id))
          .filter((item) => yearMatches(item.submitted_at))
          .map((item) => [
            item.id,
            item.member_id,
            item.member_name,
            item.submitted_by_email,
            item.award_code,
            item.award_name,
            item.level === "advanced" ? "Advanced" : "Basic",
            item.status === "approved"
              ? "Verified submission"
              : item.status === "pending"
                ? "Pending review"
                : "Rejected",
            item.submitted_at,
            item.reviewed_at ?? "",
            item.reviewed_by ?? "",
            item.evidence_url,
            item.notes,
          ]),
      });
    }

    if (included.requirements) {
      sheets.push({
        name: "Requirements",
        headers: [
          "Member ID",
          "Section",
          "Full Name",
          "Pathway",
          "Completed Checks",
          "Total Checks",
          "Readiness Percentage",
          "Missing Requirements",
        ],
        rows: selected.map(({ dataset, member: item, progressMap }) => {
          const result = pathwayFor(dataset, item, progressMap);
          const completed = result.checks.filter((check) => check.complete).length;
          return [
            item.id,
            sectionLabel(dataset.section),
            item.name,
            result.pathway,
            completed,
            result.checks.length,
            Math.round((completed / result.checks.length) * 100),
            result.checks
              .filter((check) => !check.complete)
              .map((check) => check.label)
              .join("; "),
          ];
        }),
      });
    }

    if (sheets.length) {
      sheets.unshift({
        name: "Export Overview",
        headers: ["Export Information", "Value"],
        rows: [
          ["Company", "11th Kuching Company, The Boys' Brigade in Malaysia"],
          ["Prepared At", new Date().toLocaleString("en-MY")],
          ["Sections", section === "both" ? "Senior & Junior" : sectionLabel(section)],
          ["Squad", squad === "all" ? "All squads" : squad],
          ["Members", member === "all" ? "All matching members" : "Selected member"],
          ["Reporting Year", reportYear === "all" ? "All years" : reportYear],
          ["Member Count", selected.length],
          ["Included Sheets", sheets.map((sheet) => sheet.name).join(", ")],
        ],
      });
    }
    return { sheets, memberCount: selected.length };
  }

  async function submitExport(event: FormEvent) {
    event.preventDefault();
    const printWindow = format === "print" ? window.open("", "_blank") : null;
    if (format === "print" && !printWindow) {
      window.alert("Allow pop-ups to open the print-ready report.");
      return;
    }
    setSaving(true);
    try {
      const { sheets, memberCount } = makeSheets();
      if (sheets.length <= 1)
        throw new Error("Select at least one dataset to export.");
      if (!memberCount) throw new Error("No members match the selected filters.");
      const date = new Date().toISOString().slice(0, 10);
      if (format === "xlsx") {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "11KCHBB App";
        workbook.created = new Date();
        sheets.forEach((sheet) => {
          const worksheet = workbook.addWorksheet(sheet.name, {
            views: [{ state: "frozen", ySplit: 1 }],
          });
          worksheet.addRow(sheet.headers);
          sheet.rows.forEach((row) => worksheet.addRow(row));
          worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: Math.max(1, worksheet.rowCount), column: sheet.headers.length },
          };
          worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF0B3158" },
            };
            cell.alignment = { vertical: "middle" };
          });
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.eachCell((cell) => {
              const value = String(cell.value ?? "").toLowerCase();
              if (["awarded", "paid", "present", "approved"].includes(value))
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFDDF5E9" },
                };
              if (["unpaid", "absent", "rejected"].includes(value))
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFFE4E4" },
                };
              if (["pending", "submitted", "verified", "in progress"].includes(value))
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFFF1C7" },
                };
            });
          });
          worksheet.columns.forEach((column, index) => {
            const values = [
              sheet.headers[index],
              ...sheet.rows.map((row) => String(row[index] ?? "")),
            ];
            column.width = Math.min(
              45,
              Math.max(12, ...values.map((value) => value.length + 2)),
            );
          });
        });
        const buffer = await workbook.xlsx.writeBuffer();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
          new Blob([buffer as BlobPart], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        link.download = `11kchbb-export-${date}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else if (printWindow) {
        const tables = sheets
          .map(
            (sheet) => `<section><h2>${escapeHtml(sheet.name)}</h2><table><thead><tr>${sheet.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${sheet.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`,
          )
          .join("");
        printWindow.document.write(`<!doctype html><html><head><title>11KCHBB Export ${date}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#14253b}h1{color:#0b3158;margin-bottom:4px}p{color:#607086;margin-top:0}section{break-before:page}section:first-of-type{break-before:auto}h2{color:#1269c7}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#0b3158;color:white}th,td{padding:5px;border:1px solid #ccd5df;text-align:left;vertical-align:top}tr:nth-child(even){background:#f4f7fa}</style></head><body><h1>11KCHBB App · Export Report</h1><p>Prepared ${date} · ${memberCount} member${memberCount === 1 ? "" : "s"} · ${reportYear === "all" ? "All years" : reportYear}</p>${tables}<script>window.onload=()=>window.print()</script></body></html>`);
        printWindow.document.close();
      }
      onComplete(
        format === "xlsx"
          ? "Excel workbook exported successfully."
          : "Print-ready report created. Choose Save as PDF in the print window.",
      );
      onClose();
    } catch (error) {
      printWindow?.close();
      window.alert(error instanceof Error ? error.message : "Unable to export records");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop export-backdrop" role="presentation">
      <section
        className="modal export-centre"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-centre-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">REPORTING & BACKUP</p>
            <h2 id="export-centre-title">Export Centre</h2>
            <small>Create a neat filtered workbook or print-ready report.</small>
          </div>
          <button onClick={onClose} aria-label="Close Export Centre">×</button>
        </div>
        {loading ? (
          <div className="export-loading">Preparing export options…</div>
        ) : (
          <form onSubmit={submitExport}>
            <div className="export-filter-grid">
              <label>
                Section
                <select
                  value={section}
                  onChange={(event) => {
                    setSection(event.target.value);
                    setMember("all");
                  }}
                >
                  <option value="both">Senior & Junior</option>
                  <option value="senior">Senior only</option>
                  <option value="junior">Junior only</option>
                </select>
              </label>
              <label>
                Squad
                <select
                  value={squad}
                  onChange={(event) => {
                    setSquad(event.target.value);
                    setMember("all");
                  }}
                >
                  <option value="all">All squads</option>
                  <option>Alpha</option>
                  <option>Bravo</option>
                  <option>Charlie</option>
                  <option>Delta</option>
                </select>
              </label>
              <label>
                Members
                <select value={member} onChange={(event) => setMember(event.target.value)}>
                  <option value="all">All matching members</option>
                  {availableMembers.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Reporting year
                <select value={reportYear} onChange={(event) => setReportYear(event.target.value)}>
                  <option value="all">All years</option>
                  {years.map((year) => <option key={year}>{year}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="export-datasets">
              <legend>Include in export</legend>
              {[
                ["members", "Member profiles"],
                ["awards", "Awards summary & details"],
                ["attendance", "Attendance summary & records"],
                ["subscriptions", "Yearly subscriptions"],
                ["submissions", "Award submissions"],
                ["requirements", "Award pathway requirements"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={included[key as keyof typeof included]}
                    onChange={(event) =>
                      setIncluded((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <fieldset className="export-formats">
              <legend>Export format</legend>
              <label className={format === "xlsx" ? "selected" : ""}>
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={format === "xlsx"}
                  onChange={() => setFormat("xlsx")}
                />
                <span><strong>Excel workbook</strong><small>Organised into separate filtered sheets</small></span>
              </label>
              <label className={format === "print" ? "selected" : ""}>
                <input
                  type="radio"
                  name="format"
                  value="print"
                  checked={format === "print"}
                  onChange={() => setFormat("print")}
                />
                <span><strong>Print / Save as PDF</strong><small>Landscape report prepared for printing</small></span>
              </label>
            </fieldset>

            <div className="export-actions">
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  await onLegacyCsv();
                  onClose();
                }}
              >
                Quick CSV backup
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Preparing export…" : "Create export"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
