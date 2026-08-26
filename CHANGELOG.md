# Changelog

All notable changes to BB Company App are recorded here.

## [Unreleased]

### Added

- Multilingual BB Guide in English, Mandarin Chinese and Bahasa Malaysia, with
  page-aware instructions, role explanations and per-account progress.
- Public GitHub Pages setup assistant for new companies, including privacy-safe
  Worker and D1 availability checks and an eight-step one-click deployment path.
- Guided Action Centre reminders for incomplete branding, the first Officer
  account and the school directory.

- Company operations workspaces for Parade Planning, Duty Rosters, Event
  Committees, Leave Requests, Promotion Readiness, Service Hours, Band Centre
  and Emergency Roll Call.
- Two-stage squad and Officer reviews for leave and service records, with
  attendance conflict protection and verified-hour progress.
- Band member profiles, instrument issue/return history, maintenance alerts,
  rehearsals, performances and proficiency assessments.
- Configurable promotion rules and waivers, with advisory readiness shown in
  staff views and each linked member's journey.
- Role-aware Action Centre reminders for duties, committees, leave, service,
  band maintenance and emergency responses.
- Controlled member access requests from the public sign-in screen.
- Administrator registration approval, rejection, profile matching and
  member-profile creation.
- Guided first-login password change, profile verification, privacy
  acknowledgement and role-specific app checklist.
- Member profile correction requests with officer review and squad-restricted
  NCO and squad-leader review.
- Admin Centre onboarding dashboard with pending badges, incomplete setup,
  versioned privacy notices and approval history.

### Security and accountability

- Server-side section and squad isolation covers every new operations route,
  including direct API access and emergency-contact views.
- Official attendance, leave, service and promotion decisions are never made
  automatically; duplicate submissions are rejected with idempotency keys.
- Every emergency contact view, roll-call change, promotion decision and band
  instrument movement is auditable.
- Pending and rejected accounts cannot create authenticated sessions.
- Requested and temporary passwords remain salted hashes.
- Viewer access is read-only, and temporary/custom access cannot approve
  registrations.
- Registration and correction decisions record reviewer, timestamps, notes and
  before/after profile values.
- Existing active accounts and all live company records are preserved during
  schema initialization.

## [1.1.0] - 2026-07-26

### Added

- Installable desktop editions for Apple Silicon and Intel Macs, Windows and
  Linux.
- Automated GitHub release builds for DMG, EXE, MSI, AppImage and Debian
  packages.
- Desktop installation guide with clear unsigned-app safety instructions.

### Data and security

- Desktop editions connect to the existing production service so all
  authorised users share the same live records.
- The desktop wrapper grants remote content no Tauri commands, plugins or
  operating-system capabilities.

## [1.0.0] - 2026-07-26

### Highlights

- Mobile-first Junior and Senior Section management.
- Member profiles, ranks, squads, service years and contact details.
- Attendance registers with chronological meeting selection.
- Senior and Junior award matrices with progress tracking.
- Member award applications and officer review workflow.
- Company and band subscription registers.
- Uniform and award inventory with member uniform requests.
- Announcements and role-controlled resources.
- Administrator account management and custom operational access roles.
- Full member, attendance, award, subscription and submission exports.
- Installable Progressive Web App for phones, tablets and computers.

### Security and privacy

- Live company records remain in the production Cloudflare D1 database and are
  not stored in the source repository.
- Passwords are stored as salted hashes.
- Production credentials and local environment files are excluded from Git.
- Automated lint, build and application tests run for contributions.
