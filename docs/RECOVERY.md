# BB App recovery

## Database

The live D1 database contains private member information. Do not copy it into
GitHub artifacts, pull requests, issue attachments, or public cloud drives.
Use Cloudflare D1 Time Travel from the company Cloudflare account when a
database recovery is required.

Before restoring:

1. Stop production writes or place the app in maintenance mode.
2. Record the incident time and the last known correct operation.
3. Select a restore point before the incorrect write.
4. Restore to a separate database first when practical and verify members,
   accounts, attendance, awards, submissions, stock, and subscriptions.
5. Rebind production only after an administrator approves the verified result.

## Application

Every production release is tied to a Git commit. If a release fails, redeploy
the last successful commit. Database migrations are additive; do not attempt to
reverse a migration by deleting columns or tables.

## Post-recovery checks

- Confirm `/api/health` reports `status: ok`.
- Sign in with a non-administrator test account and an administrator account.
- Verify role restrictions, one recent member, one attendance register, one
  award record, and one stock balance.
- Record the recovery in the repository’s private incident issue.
