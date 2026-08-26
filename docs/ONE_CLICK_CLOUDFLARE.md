# One-click Cloudflare installation

This method gives each Boys' Brigade company an independent BB App, database, address and GitHub repository. No member data is copied from another company.

For the easiest route, open the [multilingual BB Guide setup assistant](https://nahtanugn.github.io/BB-App/setup/). It remembers progress only in the current browser, checks the finished app without reading company records, and never asks for passwords, tokens or the private setup code.

## Before starting

Use accounts owned by the company wherever possible:

- A Cloudflare account with a verified email address.
- A GitHub account or organisation that will own the copied source repository.
- The email address of the first BB App administrator.
- A new private setup code containing at least 16 characters.

The setup code is not the administrator's password. It is used only to protect creation of the first administrator account.

## Deploy

1. Open the [BB App repository](https://github.com/nahtanugn/BB-App).
2. Select **Deploy to Cloudflare**.
3. Sign in to Cloudflare if requested.
4. Connect the company GitHub account and allow Cloudflare to create a repository copy.
5. Enter a unique Worker name. Use letters, numbers and hyphens only.
6. Keep the D1 binding named `DB`. Cloudflare creates the database automatically.
7. Set `ADMIN_EMAIL` to the exact email that will create the first administrator.
8. Enter the private `SETUP_TOKEN`. Store it securely until setup is complete.
9. Confirm the build command `pnpm run build` and deploy command `pnpm run deploy` if Cloudflare displays them.
10. Select **Deploy**. The initial build may take several minutes because it also creates the database tables.

## Create the first administrator

1. Open the `workers.dev` address shown after deployment.
2. Enter the administrator's name.
3. Confirm the pre-authorised administrator email.
4. Choose a strong password.
5. Enter the same one-time setup code.
6. Select **Create administrator** once and wait for the success message.
7. Complete the onboarding and privacy steps.
8. Open **Manage → Accounts and roles → App branding** and upload the company's name and logo.

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
