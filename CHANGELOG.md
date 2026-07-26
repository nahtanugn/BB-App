# Changelog

All notable changes to 11KCHBB App are recorded here.

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
