# BB App

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nahtanugn/BB-App)

[Open the multilingual guided company setup](https://nahtanugn.github.io/BB-App/setup/)

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

The recommended installation is the **multilingual guided company setup** above. It reduces setup to three stages:

1. **Deploy company app** — enter the first administrator email, copy the locally generated setup code and open Cloudflare deployment.
2. **Create administrator** — paste the new `workers.dev` address, let the guide check the app and database, then create the first administrator.
3. **Finish company setup** — accept the privacy notice, enter the required company name and take the short tour. The standard BB logo remains unless an optional company logo is uploaded.

The guide keeps the setup code only in the current browser session and clears it after the first administrator is detected. Schools, a first Officer and sharing the company address are recommended next steps, but they do not block normal access.

See [One-click Cloudflare installation](docs/ONE_CLICK_CLOUDFLARE.md) for troubleshooting and handover instructions. Never commit setup codes, passwords, production exports or Cloudflare tokens to GitHub.

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

> [!WARNING]
> **Mac users:** the current DMG is not Apple-signed or notarized. After dragging **BB App** into **Applications**, macOS may report that the app is damaged and may not show **Open Anyway**. Download only from this official repository, then run the following command in Terminal before opening the app:
>
> ```bash
> xattr -dr com.apple.quarantine "/Applications/BB App.app"
> ```
>
> This command removes the download quarantine only from the named BB App installation. See the [complete desktop installation instructions](docs/DESKTOP_INSTALLATION.md#macos).

Companies that want their own branded installers may fork the repository and use `scripts/configure-desktop.mjs` in a separate release workflow. Company-specific installers should be published from that company's fork, not from this base repository.

## Tutorial

The public user guide uses the generic **BB App** name so every company can reuse it: [Download the BB App user guide slides](tutorial-output/BB-App-User-Guide.pptx).

Each deployed company can still set its own name and logo under **Manage → Accounts and roles → App branding**. Those saved settings remain private to that company's Cloudflare deployment.

## Award syllabus

The built-in catalogues provide a starting point for BB Junior and Senior Section tracking. Deploying companies remain responsible for checking their current national handbooks, circulars, safeguarding rules and privacy obligations.

This is an independent open-source project and is not an official Boys' Brigade national product. It does not claim ownership of national badge artwork or handbook content.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes. Use fictional test data only.

## Licence

MIT. See [LICENSE](LICENSE).
