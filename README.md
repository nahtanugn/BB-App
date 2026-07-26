# 11KCHBB App

11KCHBB App is an open-source, mobile-first tracker for Boys' Brigade Junior and Senior Sections. It keeps each section's members, awards, submissions and attendance separate while allowing officers to switch between them.

## What is included

- Responsive dashboard for phones, tablets and desktop computers
- Installable Progressive Web App
- Current Senior Section award catalogue from the August 2024 BB Malaysia Members' Handbook
- Junior Section White, Green, Purple, Blue, Red, Silver and Gold award pathway
- Touch-friendly award matrix with five progress states
- Member profiles, ranks, squads and service years
- Editable member details with safeguarded member deletion
- Meeting attendance registers with Present, Absent and Excused statuses
- Automatic President's Award readiness indicator
- CSV export for backups and spreadsheet reporting
- Durable Cloudflare D1 data storage
- Independent email-and-password officer accounts with administrator controls
- Separate Senior and Junior Section records
- Role-based access for officers, NCOs, squad leaders, members and custom roles
- Company and band subscription registers
- Uniform and award stock management

## Status model

Each award record moves through:

`Not started → In progress → Submitted → Verified → Awarded`

## Local development

Requirements:

- Node.js 22 or newer
- pnpm 11 or newer

Install and start the project:

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

## Build

```bash
pnpm run build
```

The app is designed for the OpenAI Sites / Cloudflare Workers runtime and uses a D1 binding named `DB`. The logical binding is declared in `.openai/hosting.json`.

## Desktop editions

The same live app is available as a Tauri desktop application for Apple Silicon
and Intel Macs, Windows and Linux. Desktop installations use the production
service and database, so data stays synchronised with the web and mobile app.

Desktop builds are produced automatically for version tags. See
[Desktop installation](docs/DESKTOP_INSTALLATION.md) for downloads and the
unsigned-app installation notice.

## Independent Cloudflare deployment

The standalone build runs directly on Cloudflare Workers and does not require a ChatGPT account. Its D1 binding and administrator email are configured in `vite.config.ts`; set the `SETUP_TOKEN` Worker secret, then run:

```bash
pnpm run deploy:standalone
```

On first launch, the configured administrator email and one-time setup code create the initial administrator. Administrators can then create or disable officer accounts from inside the app.

## Award syllabus

The built-in catalogue follows the BB Malaysia Senior Section award classification published in the August 2024 Members' Handbook. Companies should verify nationally administered award requirements against the latest official circulars and forms before submission.

11KCHBB App is an independent open-source project and is not an official BB Malaysia product. The project does not include or claim ownership of BB Malaysia logos, badge artwork or handbook content.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes. All development must use fictional test data; live member
records and production credentials must never be committed to GitHub.

Useful contribution areas include:

- Additional eligibility checkers
- Attendance and community-service logging
- Import templates
- PDF reports
- Translations
- Accessibility testing

## Privacy

Only collect information needed to administer awards. Configure deployment access appropriately, limit officer permissions and follow your organisation's data-handling policies. Do not store identity-card numbers or sensitive pastoral notes in this first release.

## Licence

MIT. See [LICENSE](LICENSE).
