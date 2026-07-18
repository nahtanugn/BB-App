# Anchor Awards

Anchor Awards is an open-source, mobile-first award tracker for Boys' Brigade Senior Section companies. It provides one shared place for officers to manage members, update Basic and Advanced award progress, and monitor President's Award readiness.

## What is included

- Responsive dashboard for phones, tablets and desktop computers
- Installable Progressive Web App
- Current Senior Section award catalogue from the August 2024 BB Malaysia Members' Handbook
- Touch-friendly award matrix with five progress states
- Member profiles, ranks, squads and service years
- Editable member details with safeguarded member deletion
- Meeting attendance registers with Present, Absent and Excused statuses
- Automatic President's Award readiness indicator
- CSV export for backups and spreadsheet reporting
- Durable Cloudflare D1 data storage
- Starter records that can be removed after setup

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

## Award syllabus

The built-in catalogue follows the BB Malaysia Senior Section award classification published in the August 2024 Members' Handbook. Companies should verify nationally administered award requirements against the latest official circulars and forms before submission.

Anchor Awards is an independent open-source project and is not an official BB Malaysia product. The project does not include or claim ownership of BB Malaysia logos, badge artwork or handbook content.

## Contributing

Issues and pull requests are welcome. Useful contribution areas include:

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
