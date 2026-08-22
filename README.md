# BB App

A reusable, open-source, mobile-first company management app for Boys' Brigade Junior and Senior Sections. Each deployment has its own Cloudflare Worker, D1 database, users and branding.

This repository contains application source, additive database migrations, tests and deployment templates only. It does not contain a production database, member records, passwords, API tokens or private documents.

## Included modules

- Installable Progressive Web App for phones, tablets and desktops
- Configurable app name, company name, subtitle and logo
- Junior and Senior member profiles, awards and attendance
- Role, squad, section, temporary-access and custom-permission controls
- Meetings, programme planning, duty rosters and committees
- Award and uniform requests
- Uniform, award and instrument stock management
- Onboarding, subscriptions, resources and announcements
- Audit history, school reports, full exports and operational automation
- Optional desktop wrappers for macOS, Windows and Linux

## Create a company deployment

1. Select **Use this template** on GitHub, or fork the repository.
2. Create a Cloudflare D1 database.
3. Create a Cloudflare API token that can deploy Workers and manage that D1 database.
4. Add these GitHub repository variables:

   - `APP_URL` — for example `https://your-app.your-subdomain.workers.dev`
   - `WORKER_NAME` — a unique Worker name
   - `D1_DATABASE_NAME` — the Cloudflare D1 database name

5. Add these GitHub Actions secrets:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `D1_DATABASE_ID`
   - `ADMIN_EMAIL` — the email allowed to create the first administrator

6. Add the Worker secret `SETUP_TOKEN` in Cloudflare. Use a long, random, one-time setup code.
7. Run **Actions → Deploy web app → Run workflow → deploy-production**.
8. Open the deployed app and create the first administrator.
9. Open **Manage → Accounts and roles → App branding** to set the company name and logo.

Never commit production values to this repository. `.dev.vars.example` documents the supported local variables without containing usable credentials.

## Local development

Requirements:

- Node.js 22 or newer
- pnpm 11 or newer

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm run dev
```

The placeholder D1 identifier is sufficient for a source build. To connect local development to a real database, put that deployment's values in the ignored `.dev.vars` file or export them in the shell.

## Validation

```bash
pnpm lint
pnpm test
```

`pnpm test` performs a production build and runs the regression, permission, migration and interface checks.

## Data separation

Every company should use a separate Cloudflare account or separate Worker and D1 database. Sharing this GitHub source does not share live data. Do not copy D1 exports, member spreadsheets, `.dev.vars`, Cloudflare tokens, encryption keys or account passwords into GitHub.

## Desktop editions

Official GitHub Releases contain only the generic base desktop app. On first launch, users enter their organisation's deployed app address. The installers do not carry a database, credentials, company branding or a fixed production URL. See [Desktop installation](docs/DESKTOP_INSTALLATION.md).

Companies that want their own branded installers may fork the repository and use `scripts/configure-desktop.mjs` in a separate release workflow. Company-specific installers should be published from that company's fork, not from this base repository.

## Award syllabus

The built-in catalogues provide a starting point for BB Junior and Senior Section tracking. Deploying companies remain responsible for checking their current national handbooks, circulars, safeguarding rules and privacy obligations.

This is an independent open-source project and is not an official Boys' Brigade national product. It does not claim ownership of national badge artwork or handbook content.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes. Use fictional test data only.

## Licence

MIT. See [LICENSE](LICENSE).
