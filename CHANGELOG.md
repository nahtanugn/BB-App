# Changelog

All notable changes to 11KCHBB App are recorded here.

## [Unreleased]

### Added

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
