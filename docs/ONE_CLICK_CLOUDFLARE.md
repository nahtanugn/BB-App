# One-click Cloudflare installation

This method gives each Boys' Brigade company an independent BB App, database, address and GitHub repository. No member data is copied from another company.

For the easiest route, open the [multilingual BB Guide setup assistant](https://nahtanugn.github.io/BB-App/setup/). It generates the private setup code locally, keeps it only in the current browser session, and checks the finished app without reading company records.

## Before starting

Use accounts owned by the company wherever possible:

- A Cloudflare account with a verified email address.
- A GitHub account or organisation that will own the copied source repository.
- The email address of the first BB App administrator.
- The first administrator's email address. The guide generates the private setup code.

The setup code is not the administrator's password. It protects creation of the first administrator account, never appears in a URL or network request from the guide, and is cleared after the administrator is detected.

## Stage 1 — Deploy company app

1. In the guide, enter the first administrator email.
2. Copy the email and generated setup code using their Copy buttons.
3. Select **Open Cloudflare deployment**, sign in if requested and connect the company GitHub account.
4. Enter a unique Worker name. In the optional technical settings, keep the database binding named `DB`, set `ADMIN_EMAIL` to the copied email and set `SETUP_TOKEN` to the copied code.
5. Start deployment and wait for the build to finish.

## Stage 2 — Create administrator

1. Paste the new `workers.dev` address into the guide and select **Check deployment**.
2. If the database is still building, wait and check again. If it is unavailable, review the Cloudflare build and `DB` binding.
3. When ready, copy the setup code and open the company app.
4. Enter the administrator's name, pre-authorised email, chosen password and one-time setup code.
5. Select **Create administrator** once.

## Stage 3 — Finish company setup

1. Return to the guide and confirm that the administrator was created. The guide checks the public setup state and clears its saved setup code.
2. Open BB App, accept the privacy notice and enter the required company name.
3. Complete the short app tour. The standard BB logo remains unless an optional company logo is uploaded.
4. Add schools, create the first Officer and share the company address now or later. These recommended tasks do not block access and remain visible in the Action Centre.

After the administrator exists, the setup endpoint refuses to create another first administrator. The company can remove or replace the `SETUP_TOKEN` in **Cloudflare → Workers & Pages → BB App → Settings → Variables and Secrets**.

## Ownership and updates

Cloudflare creates a new repository for the company and connects it to Workers Builds. Future pushes to that repository trigger a new build. The company owns its deployment and database; access can be handed over without transferring another company's records.

Before accepting updates from the base BB App repository, create a database backup or encrypted full export, review the changes in a pull request and wait for all automated checks to pass.

## If deployment fails

- Confirm the GitHub repository is connected to the intended Cloudflare account.
- Confirm the build uses Node.js 22 or newer and pnpm.
- Confirm the D1 binding is exactly `DB`.
- Open the failed build and inspect the first red step rather than repeatedly deploying.
- Do not create a second database manually unless the build log specifically reports that automatic provisioning failed.
