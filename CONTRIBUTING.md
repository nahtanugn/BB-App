# Contributing to 11KCHBB App

Thank you for helping improve the app. Changes should be developed and reviewed
without using the live company database.

## Development workflow

1. Create a branch from `main`, using a descriptive name such as
   `feature/attendance-summary` or `fix/mobile-navigation`.
2. Use a local development database with fictional test records.
3. Make the change and run:

   ```bash
   pnpm lint
   pnpm test
   ```

4. Commit the change and open a pull request.
5. Complete the pull-request checklist and describe any database migration.
6. Wait for review and approval before merging.

## Data and security rules

- Never commit `.env`, `.dev.vars`, database files, exports, member records,
  passwords, session cookies, API tokens or deployment credentials.
- Never copy production member data into a development or preview environment.
- Use `.dev.vars.example` only as a template and provide your own local values.
- Treat authentication, role, permission and database migration changes as
  security-sensitive.
- Do not deploy directly to production. Production publishing is performed by
  an authorised maintainer after review.

## Database changes

Update `db/schema.ts`, generate a migration with `pnpm db:generate`, and include
the generated migration in the pull request. Explain how existing records are
preserved and whether a backup is recommended.

## Review expectations

Pull requests must pass the automated checks and receive maintainer approval.
Reviewers may request mobile testing, permission checks, migration changes or
additional automated tests before approval.
